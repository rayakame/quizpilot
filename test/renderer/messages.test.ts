import { describe, expect, it } from "vitest"
import type { Decision } from "../../src/core/types.js"
import {
  keyText,
  QUIZ_LINK_TEXT,
  quizLinkText,
  sourceText,
  statusText,
} from "../../src/renderer/src/lib/messages.js"

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
      "Claude · 72% · 2.1 s",
    )
    expect(sourceText(decision({ source: "fallback", confidence: null, fallback }))).toBe(
      "Claude · 2.1 s",
    )
    expect(sourceText(decision({ source: "jev", confidence: 0.9 }))).toBe("Jev · 90%")
  })
})

describe("keyText", () => {
  it("names the service whose key failed", () => {
    expect(keyText("invalid", "Gemini")).toBe("Gemini doesn't accept this key.")
    expect(keyText("offline", "TypeSafe")).toBe("Couldn't reach TypeSafe. Check your connection.")
  })
})

describe("statusText", () => {
  it("tells reconnecting bots from joining ones", () => {
    expect(statusText("joining", null)).toBe("Joining")
    expect(statusText("joining", "reconnecting")).toBe("Reconnecting")
    expect(statusText("lobby", "reconnecting")).toBe("In lobby")
  })
})

describe("quizLinkText", () => {
  it("shows what the check found", () => {
    expect(quizLinkText({ link: "x", result: null })).toBe("Checking…")
    expect(quizLinkText({ link: "x", result: { ok: true, title: "Geo", questions: 10 } })).toBe(
      "Geo · 10 questions",
    )
    expect(quizLinkText({ link: "x", result: { ok: true, title: "Geo", questions: 1 } })).toBe(
      "Geo · 1 question",
    )
    expect(quizLinkText({ link: "x", result: { ok: false, error: "private" } })).toBe(
      QUIZ_LINK_TEXT.private,
    )
  })

  it("calls answers from a known quiz known", () => {
    expect(
      sourceText({
        answer: { kind: "choice", index: 0 },
        source: "quiz-link",
        confidence: 1,
        usage: [],
      }),
    ).toBe("Known answer")
  })
})
