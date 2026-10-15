import Anthropic from "@anthropic-ai/sdk"
import { ApiError, GoogleGenAI } from "@google/genai"
import OpenAI from "openai"
import type { FallbackProvider } from "../core/answer/engine.js"
import { createFallback } from "../core/providers/fallback/create.js"
import type { FallbackProviderId } from "../core/providers/fallback/ids.js"
import type { FallbackSetup, KeyCheck } from "../shared/api.js"
import type { Config, SettingsStore } from "./settings.js"

export type KeyProbe = (apiKey: string) => Promise<unknown>

const PROBES: Record<FallbackProviderId, KeyProbe> = {
  anthropic: (apiKey) => new Anthropic({ apiKey, maxRetries: 0, timeout: 8000 }).models.list(),
  openai: (apiKey) => new OpenAI({ apiKey, maxRetries: 0, timeout: 8000 }).models.list(),
  gemini: (apiKey) => new GoogleGenAI({ apiKey, httpOptions: { timeout: 8000 } }).models.list(),
}

export async function checkFallbackKey(
  provider: FallbackProviderId,
  key: string,
  probes: Record<FallbackProviderId, KeyProbe> = PROBES,
): Promise<KeyCheck> {
  const apiKey = key.trim()
  if (!apiKey) return "invalid"
  try {
    await probes[provider](apiKey)
    return "ok"
  } catch (err) {
    return classify(err)
  }
}

export async function saveFallback(
  store: SettingsStore,
  setup: FallbackSetup,
  check: typeof checkFallbackKey = checkFallbackKey,
): Promise<KeyCheck> {
  const key = setup.key.trim()
  if (!key && !store.get().keys[setup.provider]) return "invalid"
  if (key) {
    const result = await check(setup.provider, key)
    if (result !== "ok") return result
  }
  await store.update((c) => ({
    ...c,
    keys: key ? { ...c.keys, [setup.provider]: key } : c.keys,
    fallback: { ...c.fallback, provider: setup.provider, webSearch: setup.webSearch },
  }))
  return "ok"
}

export async function removeFallback(store: SettingsStore): Promise<void> {
  await store.update((c) => ({ ...c, keys: { ...c.keys, [c.fallback.provider]: "" } }))
}

export function fallbackFor(config: Config): FallbackProvider | null {
  const provider = config.fallback.provider
  const key = config.keys[provider]
  if (!key) return null
  return retryWithoutSearch(
    logFailures(createFallback(provider, key, config.fallback.models[provider])),
  )
}

// Not every provider is confirmed to take web search and a JSON schema together.
export function retryWithoutSearch(provider: FallbackProvider): FallbackProvider {
  return {
    decide: (input, opts) =>
      provider.decide(input, opts).catch((err: unknown) => {
        if (!opts.webSearch || opts.signal.aborted) throw err
        return provider.decide(input, { ...opts, webSearch: false })
      }),
  }
}

// The engine treats a failed backup answer like a missing one; keep the reason visible.
export function logFailures(
  provider: FallbackProvider,
  log: (message: string) => void = console.warn,
): FallbackProvider {
  return {
    decide: (input, opts) =>
      provider.decide(input, opts).catch((err: unknown) => {
        if (!opts.signal.aborted)
          log(`Backup AI failed: ${err instanceof Error ? err.message : err}`)
        throw err
      }),
  }
}

function classify(err: unknown): KeyCheck {
  if (
    err instanceof Anthropic.AuthenticationError ||
    err instanceof Anthropic.PermissionDeniedError ||
    err instanceof OpenAI.AuthenticationError ||
    err instanceof OpenAI.PermissionDeniedError
  ) {
    return "invalid"
  }
  // Gemini answers a bad key with 400 "API key not valid".
  if (err instanceof ApiError && [400, 401, 403].includes(err.status)) return "invalid"
  if (
    err instanceof Anthropic.APIConnectionError ||
    err instanceof OpenAI.APIConnectionError ||
    err instanceof TypeError
  ) {
    return "offline"
  }
  return "error"
}
