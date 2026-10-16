import { describe, expect, it } from "vitest"
import { MODELS, resolveChoice } from "../../../../src/core/providers/fallback/models.js"

describe("resolveChoice", () => {
  it("starts with the default model at low effort", () => {
    expect(resolveChoice("anthropic")).toEqual({ model: "claude-sonnet-5-5", effort: "low" })
    expect(resolveChoice("openai")).toEqual({ model: "gpt-6.1-sol", effort: "low" })
    expect(resolveChoice("gemini")).toEqual({ model: "gemini-3.8-flash", effort: "low" })
  })

  it("keeps a valid choice", () => {
    expect(resolveChoice("anthropic", "claude-sonnet-5-5", "high")).toEqual({
      model: "claude-sonnet-5-5",
      effort: "high",
    })
    expect(resolveChoice("gemini", "gemini-3.5-flash-lite", "minimal")).toEqual({
      model: "gemini-3.5-flash-lite",
      effort: "minimal",
    })
  })

  it("repairs efforts a model doesn't take", () => {
    expect(resolveChoice("anthropic", "claude-haiku-4-5", "high")).toEqual({
      model: "claude-haiku-4-5",
      effort: null,
    })
    expect(resolveChoice("openai", "gpt-6-luna", "minimal")).toEqual({
      model: "gpt-6-luna",
      effort: "low",
    })
  })

  it("falls back to the default for unknown models", () => {
    expect(resolveChoice("gemini", "gemini-2.5-pro", "high")).toEqual({
      model: "gemini-3.8-flash",
      effort: "high",
    })
  })

  it("offers three models per provider, fastest last", () => {
    for (const options of Object.values(MODELS)) {
      expect(options.map((o) => o.note)).toEqual(["most accurate", "balanced", "fastest"])
    }
  })
})
