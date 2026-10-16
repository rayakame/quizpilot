import Anthropic from "@anthropic-ai/sdk"
import { ApiError } from "@google/genai"
import OpenAI from "openai"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"
import type { FallbackInput, FallbackProvider } from "../../src/core/answer/engine.js"
import {
  checkFallbackKey,
  fallbackFor,
  logFailures,
  removeFallback,
  retryWithoutSearch,
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
      await saveFallback(
        s,
        {
          provider: "gemini",
          key: " AIza ",
          webSearch: false,
          model: "gemini-4-argon",
          effort: "high",
        },
        check,
      ),
    ).toBe("ok")
    expect(check).toHaveBeenCalledWith("gemini", "AIza")
    expect(s.get().keys.gemini).toBe("AIza")
    expect(toPublic(s.get()).fallback).toMatchObject({
      provider: "gemini",
      webSearch: false,
      savedKeys: ["gemini"],
    })
    expect(toPublic(s.get()).fallback.choices.gemini).toEqual({
      model: "gemini-4-argon",
      effort: "high",
    })
  })

  it("keeps everything when the key doesn't work", async () => {
    const s = await store()
    const check = vi.fn(async () => "invalid" as const)
    expect(
      await saveFallback(
        s,
        { provider: "openai", key: "sk-x", webSearch: true, model: "gpt-6.1-sol", effort: "low" },
        check,
      ),
    ).toBe("invalid")
    expect(s.get()).toEqual(DEFAULT_CONFIG)
  })

  it("switches to a provider with a saved key without asking for it again", async () => {
    const s = await store()
    await s.update((c) => ({ ...c, keys: { ...c.keys, openai: "sk-1" } }))
    const check = vi.fn(async () => "ok" as const)
    expect(
      await saveFallback(
        s,
        { provider: "openai", key: "", webSearch: true, model: "gpt-6-luna", effort: "medium" },
        check,
      ),
    ).toBe("ok")
    expect(check).not.toHaveBeenCalled()
    expect(s.get().fallback.provider).toBe("openai")
    expect(toPublic(s.get()).fallback.choices.openai).toEqual({
      model: "gpt-6-luna",
      effort: "medium",
    })
    expect(
      await saveFallback(
        s,
        { provider: "gemini", key: "", webSearch: true, model: "gemini-3.8-flash", effort: "low" },
        check,
      ),
    ).toBe("invalid")
    expect(s.get().fallback.provider).toBe("openai")
  })

  it("stores no effort for models without one and repairs unknown models", async () => {
    const s = await store()
    const check = vi.fn(async () => "ok" as const)
    const setup = { provider: "anthropic" as const, webSearch: true, effort: "high" as const }
    await saveFallback(s, { ...setup, key: "sk-ant", model: "claude-haiku-4-5" }, check)
    expect(toPublic(s.get()).fallback.choices.anthropic).toEqual({
      model: "claude-haiku-4-5",
      effort: null,
    })
    await saveFallback(s, { ...setup, key: "", model: "claude-3" }, check)
    expect(toPublic(s.get()).fallback.choices.anthropic).toEqual({
      model: "claude-sonnet-5-5",
      effort: "high",
    })
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

describe("retryWithoutSearch", () => {
  const input = {} as FallbackInput
  const answer = {
    answer: { kind: "choice" as const, index: 1 },
    confidence: 0.8,
    provider: "openai",
    model: "gpt-6.1-sol",
    usage: { provider: "openai", model: "gpt-6.1-sol", inputTokens: 1, outputTokens: 1 },
  }

  it("asks without web search when the provider rejects the request, from then on", async () => {
    const rejected = new OpenAI.BadRequestError(
      400,
      undefined,
      "web_search with json_schema",
      new Headers(),
    )
    const decide = vi.fn<FallbackProvider["decide"]>(async (_input, opts) => {
      if (opts.webSearch) throw rejected
      return answer
    })
    const signal = new AbortController().signal
    const provider = retryWithoutSearch({ decide })
    await expect(provider.decide(input, { signal, webSearch: true })).resolves.toBe(answer)
    await expect(provider.decide(input, { signal, webSearch: true })).resolves.toBe(answer)
    expect(decide.mock.calls.map((c) => c[1].webSearch)).toEqual([true, false, false])
  })

  it("doesn't retry answers that failed for other reasons", async () => {
    const decide = vi.fn<FallbackProvider["decide"]>(() =>
      Promise.reject(new Error("Claude declined the question")),
    )
    const signal = new AbortController().signal
    await expect(
      retryWithoutSearch({ decide }).decide(input, { signal, webSearch: true }),
    ).rejects.toThrow()
    expect(decide).toHaveBeenCalledTimes(1)
  })

  it("doesn't retry without search, or after the engine gave up", async () => {
    const decide = vi.fn<FallbackProvider["decide"]>(() =>
      Promise.reject(new ApiError({ message: "bad request", status: 400 })),
    )
    const live = new AbortController().signal
    await expect(
      retryWithoutSearch({ decide }).decide(input, { signal: live, webSearch: false }),
    ).rejects.toThrow()
    const cancelled = new AbortController()
    cancelled.abort()
    await expect(
      retryWithoutSearch({ decide }).decide(input, { signal: cancelled.signal, webSearch: true }),
    ).rejects.toThrow()
    expect(decide).toHaveBeenCalledTimes(2)
  })
})
