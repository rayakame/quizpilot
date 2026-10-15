import { describe, expect, it } from "vitest"
import type { Decision } from "../../src/core/types.js"
import { keyText, sourceText } from "../../src/renderer/src/lib/messages.js"

const decision = (over: Partial<Decision>): Decision => ({
  answer: { kind: "choice", index: 0 },
  source: "jev",
  confidence: 0.9,
  usage: [],
  ...over,
})

describe("sourceText", () => {
  it("names the backup AI and how sure it was", () => {
    const fallback = { provider: "anthropic", model: "claude-opus-5-5", latencyMs: 2100 }
    expect(sourceText(decision({ source: "fallback", confidence: 0.72, fallback }))).toBe(
      "Claude · 72%",
    )
    expect(sourceText(decision({ source: "fallback", confidence: null, fallback }))).toBe("Claude")
    expect(sourceText(decision({ source: "jev", confidence: 0.9 }))).toBe("Jev · 90%")
  })
})

describe("keyText", () => {
  it("names the service whose key failed", () => {
    expect(keyText("invalid", "Gemini")).toBe("Gemini doesn't accept this key.")
    expect(keyText("offline", "TypeSafe")).toBe("Couldn't reach TypeSafe. Check your connection.")
  })
})
