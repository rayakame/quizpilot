import { describe, expect, it } from "vitest"
import { costOf, priceFor } from "../../../src/core/cost/prices.js"
import type { Usage } from "../../../src/core/types.js"

const use = (
  provider: string,
  model: string,
  input: number | null,
  output: number | null,
): Usage => ({
  provider,
  model,
  inputTokens: input,
  outputTokens: output,
})

describe("priceFor", () => {
  it("prices Jev by provider whatever the model is called", () => {
    expect(priceFor(use("typesafe", "", 0, 0))).toEqual({ input: 0.042, output: 0 })
    expect(priceFor(use("typesafe", "jev-2", 0, 0))).toEqual({ input: 0.042, output: 0 })
  })

  it("matches dated model ids by their prefix", () => {
    expect(priceFor(use("openai", "gpt-6.1-sol-2026-10-01", 0, 0))).toEqual({
      input: 2,
      output: 10,
    })
    expect(priceFor(use("gemini", "gemini-3.5-flash-lite-001", 0, 0))).toEqual({
      input: 0.3,
      output: 2.5,
    })
  })

  it("does not confuse a model with a longer sibling", () => {
    expect(priceFor(use("gemini", "gemini-3.8-flash", 0, 0))).toEqual({ input: 0.75, output: 3.75 })
  })

  it("knows nothing about other models", () => {
    expect(priceFor(use("anthropic", "claude-unknown", 0, 0))).toBeNull()
  })
})

describe("costOf", () => {
  it("adds up every call", () => {
    const cost = costOf([
      use("typesafe", "", 1_000_000, 0),
      use("anthropic", "claude-sonnet-5-5", 1000, 100),
    ])
    expect(cost.complete).toBe(true)
    expect(cost.usd).toBeCloseTo(0.042 + 0.002 + 0.001, 10)
  })

  it("marks the sum incomplete when a model or a count is unknown", () => {
    expect(costOf([use("anthropic", "claude-unknown", 10, 10)])).toEqual({
      usd: 0,
      complete: false,
    })
    expect(costOf([use("typesafe", "", null, 0)])).toEqual({ usd: 0, complete: false })
  })

  it("costs nothing without calls", () => {
    expect(costOf([])).toEqual({ usd: 0, complete: true })
  })
})
