import Anthropic from "@anthropic-ai/sdk"
import { ApiError } from "@google/genai"
import OpenAI from "openai"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"
import type { FallbackInput } from "../../src/core/answer/engine.js"
import {
  checkFallbackKey,
  fallbackFor,
  logFailures,
  removeFallback,
  saveFallback,
  type KeyProbe,
} from "../../src/main/fallback.js"
import { DEFAULT_CONFIG, SettingsStore, toPublic } from "../../src/main/settings.js"

function probes(error?: unknown) {
  const probe = vi.fn<KeyProbe>(() => (error ? Promise.reject(error) : Promise.resolve([])))
  return { probe, all: { anthropic: probe, openai: probe, gemini: probe } }
}

async function store() {
  const dir = await mkdtemp(join(tmpdir(), "quizpilot-"))
  return new SettingsStore(join(dir, "config.json"), structuredClone(DEFAULT_CONFIG))
}

describe("checkFallbackKey", () => {
  it("accepts a key the provider knows and trims it", async () => {
    const { probe, all } = probes()
    expect(await checkFallbackKey("openai", " sk-1 ", all)).toBe("ok")
    expect(probe).toHaveBeenCalledWith("sk-1")
    expect(await checkFallbackKey("openai", "  ", all)).toBe("invalid")
  })

  it("tells wrong keys, missing connections and other errors apart", async () => {
    const headers = new Headers()
    const cases: [unknown, string][] = [
      [new Anthropic.AuthenticationError(401, undefined, "invalid x-api-key", headers), "invalid"],
      [new OpenAI.AuthenticationError(401, undefined, "Incorrect API key", headers), "invalid"],
      [new ApiError({ message: "API key not valid", status: 400 }), "invalid"],
      [new OpenAI.APIConnectionError({ message: "Connection error." }), "offline"],
      [new TypeError("fetch failed"), "offline"],
      [new ApiError({ message: "Internal", status: 500 }), "error"],
    ]
    for (const [error, expected] of cases) {
      expect(await checkFallbackKey("gemini", "key", probes(error).all)).toBe(expected)
    }
  })
})

describe("saveFallback", () => {
  it("checks and saves a new key with provider and web search", async () => {
    const s = await store()
    const check = vi.fn(async () => "ok" as const)
    expect(
      await saveFallback(s, { provider: "gemini", key: " AIza ", webSearch: false }, check),
    ).toBe("ok")
    expect(check).toHaveBeenCalledWith("gemini", "AIza")
    expect(s.get().keys.gemini).toBe("AIza")
    expect(toPublic(s.get()).fallback).toEqual({
      provider: "gemini",
      webSearch: false,
      savedKeys: ["gemini"],
    })
  })

  it("keeps everything when the key doesn't work", async () => {
    const s = await store()
    const check = vi.fn(async () => "invalid" as const)
    expect(await saveFallback(s, { provider: "openai", key: "sk-x", webSearch: true }, check)).toBe(
      "invalid",
    )
    expect(s.get()).toEqual(DEFAULT_CONFIG)
  })

  it("switches to a provider with a saved key without asking for it again", async () => {
    const s = await store()
    await s.update((c) => ({ ...c, keys: { ...c.keys, openai: "sk-1" } }))
    const check = vi.fn(async () => "ok" as const)
    expect(await saveFallback(s, { provider: "openai", key: "", webSearch: true }, check)).toBe(
      "ok",
    )
    expect(check).not.toHaveBeenCalled()
    expect(s.get().fallback.provider).toBe("openai")
    expect(await saveFallback(s, { provider: "gemini", key: "", webSearch: true }, check)).toBe(
      "invalid",
    )
    expect(s.get().fallback.provider).toBe("openai")
  })

  it("forgets the key of the active provider on removal", async () => {
    const s = await store()
    await s.update((c) => ({ ...c, keys: { ...c.keys, anthropic: "sk-ant", openai: "sk-1" } }))
    await removeFallback(s)
    expect(s.get().keys).toMatchObject({ anthropic: "", openai: "sk-1" })
  })
})

describe("fallbackFor", () => {
  it("builds the chosen provider only when its key is saved", () => {
    expect(fallbackFor(DEFAULT_CONFIG)).toBeNull()
    const config = { ...DEFAULT_CONFIG, keys: { ...DEFAULT_CONFIG.keys, anthropic: "sk-ant" } }
    expect(fallbackFor(config)).toHaveProperty("decide")
  })
})

describe("logFailures", () => {
  const input = {} as FallbackInput

  it("logs why the backup AI failed, but not when the engine cancelled it", async () => {
    const log = vi.fn()
    const provider = logFailures({ decide: () => Promise.reject(new Error("HTTP 400")) }, log)
    await expect(
      provider.decide(input, { signal: new AbortController().signal, webSearch: true }),
    ).rejects.toThrow()
    expect(log).toHaveBeenCalledWith("Backup AI failed: HTTP 400")
    const cancelled = new AbortController()
    cancelled.abort()
    await expect(
      provider.decide(input, { signal: cancelled.signal, webSearch: true }),
    ).rejects.toThrow()
    expect(log).toHaveBeenCalledTimes(1)
  })
})
