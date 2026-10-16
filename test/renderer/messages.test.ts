import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Decision } from "../../src/core/types.js"
import {
  costText,
  dayText,
  keyText,
  mistakesText,
  percent,
  quizLinkText,
  secondsText,
  sourceCounts,
  sourceText,
  statusText,
} from "../../src/renderer/src/lib/messages.js"
import { setLanguage } from "../../src/renderer/src/lib/i18n.js"

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
      "Claude ·\u00a072% ·\u00a02.1\u00a0s",
    )
    expect(sourceText(decision({ source: "fallback", confidence: null, fallback }))).toBe(
      "Claude ·\u00a02.1\u00a0s",
    )
    expect(sourceText(decision({ source: "jev", confidence: 0.9 }))).toBe("Jev ·\u00a090%")
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
      "Geo ·\u00a010 questions",
    )
    expect(quizLinkText({ link: "x", result: { ok: true, title: "Geo", questions: 1 } })).toBe(
      "Geo ·\u00a01 question",
    )
    expect(quizLinkText({ link: "x", result: { ok: false, error: "private" } })).toBe(
      "This quiz is private. Only public quizzes work.",
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

describe("game over texts", () => {
  it("shows costs as an estimate", () => {
    expect(costText({ usd: 0.0123, complete: true })).toBe("≈\u00a0$0.012")
    expect(costText({ usd: 0.0000126, complete: true })).toBe("<\u00a0$0.001")
    expect(costText({ usd: 0, complete: true })).toBe("$0")
    expect(costText({ usd: 1.5, complete: false })).toBe("≈\u00a0$1.50 or more")
  })

  it("lists where the answers came from", () => {
    // Each count stays with its name when the line wraps.
    expect(sourceCounts({ jev: 8, fallback: 2, "quiz-link": 1, random: 1 })).toBe(
      "Jev\u00a08 ·\u00a0Backup AI\u00a02 ·\u00a0Known\u00a01 ·\u00a0Guessed\u00a01",
    )
    expect(sourceCounts({})).toBe("–")
  })

  it("shows seconds with one decimal", () => {
    expect(secondsText(1234)).toBe("1.2\u00a0s")
  })
})

describe("Japanese", () => {
  beforeEach(() => setLanguage("ja"))
  afterEach(() => setLanguage("en"))

  it("puts the seconds unit right after the number", () => {
    expect(secondsText(1234)).toBe("1.2\u2060秒")
  })
})

describe("German", () => {
  beforeEach(() => setLanguage("de"))
  afterEach(() => setLanguage("en"))

  it("writes numbers the German way", () => {
    expect(secondsText(2100)).toBe("2,1\u00a0s")
    expect(percent(0.72)).toBe("72\u00a0%")
    expect(costText({ usd: 0.0042, complete: true })).toBe("≈\u00a00,0042\u00a0$")
    expect(costText({ usd: 0.0000126, complete: false })).toBe("<\u00a00,001\u00a0$ oder mehr")
  })

  it("names statuses and sources", () => {
    expect(statusText("kicked", null)).toBe("Vom Host entfernt")
    expect(statusText("joining", "reconnecting")).toBe("Verbindet neu")
    expect(sourceText(decision({ source: "random" }))).toBe("Geraten")
    expect(keyText("invalid", "Gemini")).toBe("Gemini akzeptiert diesen Key nicht.")
  })

  it("counts questions", () => {
    const result = { ok: true as const, title: "Campus", questions: 1 }
    expect(quizLinkText({ link: "x", result })).toBe("Campus ·\u00a01 Frage")
  })
})

describe("mistakesText", () => {
  afterEach(() => setLanguage("en"))

  it("says off or roughly how often", () => {
    expect(mistakesText(0)).toBe("Off")
    expect(mistakesText(0.2)).toBe("About 20%")
    setLanguage("de")
    expect(mistakesText(0)).toBe("Aus")
    expect(mistakesText(0.2)).toBe("Etwa 20\u00a0%")
  })
})

describe("dayText", () => {
  afterEach(() => setLanguage("en"))

  it("names the day without the year", () => {
    const day = new Date(2026, 9, 16, 18, 30).getTime()
    expect(dayText(day)).toBe("Oct 16")
    setLanguage("de")
    expect(dayText(day)).toBe("16. Okt.")
  })
})
