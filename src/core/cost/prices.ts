import type { Usage } from "../types.js"

export interface Price {
  input: number
  output: number
}

export interface Cost {
  usd: number
  complete: boolean
}

const JEV: Price = { input: 0.042, output: 0 }

// USD per million tokens, checked 2026-10-16.
const MODELS: Record<string, Price> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "gpt-6-astra": { input: 10, output: 50 },
  "gpt-6.1-sol": { input: 2, output: 10 },
  "gpt-6-luna": { input: 0.1, output: 0.5 },
  "gemini-4-argon": { input: 4, output: 20 },
  "gemini-3.8-flash": { input: 0.75, output: 3.75 },
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
}

const BY_LENGTH = Object.keys(MODELS).sort((a, b) => b.length - a.length)

export function priceFor(usage: Usage): Price | null {
  if (usage.provider === "typesafe") return JEV
  const id = BY_LENGTH.find((m) => usage.model.startsWith(m))
  return id ? MODELS[id]! : null
}

export function costOf(usage: Usage[]): Cost {
  let usd = 0
  let complete = true
  for (const u of usage) {
    const price = priceFor(u)
    if (!price || u.inputTokens === null || u.outputTokens === null) {
      complete = false
      continue
    }
    usd += (u.inputTokens * price.input + u.outputTokens * price.output) / 1_000_000
  }
  return { usd, complete }
}
