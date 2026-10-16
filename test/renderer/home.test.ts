import { afterEach, describe, expect, it } from "vitest"
import { recentGames, setupRows } from "../../src/renderer/src/lib/home.js"
import { setLanguage } from "../../src/renderer/src/lib/i18n.js"
import type { HistoryGame, PublicSettings } from "../../src/shared/api.js"

afterEach(() => setLanguage("en"))

const settings = (over: Partial<PublicSettings> = {}): PublicSettings => ({
  hasTypesafeKey: true,
  timing: { mode: "instant", minMs: 1000, maxMs: 5000 },
  includePrevious: true,
  reconnect: true,
  notify: true,
  mistakes: 0,
  theme: "system",
  language: "en",
  saveHistory: true,
  fallback: {
    provider: "anthropic",
    webSearch: true,
    below: 0.6,
    imageInstantAt: 0.9,
    savedKeys: [],
    choices: {
      anthropic: { model: "claude-sonnet-5-5", effort: "low" },
      openai: { model: "gpt-6.1-sol", effort: "low" },
      gemini: { model: "gemini-3.8-flash", effort: "low" },
    },
  },
  ...over,
})

describe("setupRows", () => {
  it("sums up the setup and says where to change it", () => {
    expect(setupRows(settings()).map((r) => [r.label, r.value, r.section])).toEqual([
      ["Answers", "Jev only", "backup"],
      ["Timing", "Right away", "behavior"],
      ["Wrong on purpose", "Off", "behavior"],
      ["History", "Saved", "history"],
      ["Language", "English", "appearance"],
    ])
  })

  it("names the backup AI and the human delay", () => {
    const rows = setupRows(
      settings({
        timing: { mode: "human", minMs: 1500, maxMs: 4000 },
        mistakes: 0.2,
        saveHistory: false,
        fallback: { ...settings().fallback, savedKeys: ["anthropic"] },
      }),
    )
    expect(rows.map((r) => r.value)).toEqual([
      "Jev + Claude Sonnet 5.5",
      "Like a human, 1.5–4 s",
      "About 20%",
      "Off",
      "English",
    ])
  })

  it("speaks German", () => {
    setLanguage("de")
    const rows = setupRows(
      settings({ language: "de", timing: { mode: "human", minMs: 1500, maxMs: 4000 } }),
    )
    expect(rows.map((r) => r.value)).toEqual([
      "Nur Jev",
      "Wie ein Mensch, 1,5–4 s",
      "Aus",
      "Wird gespeichert",
      "Deutsch",
    ])
  })

  it("puts the seconds unit the Japanese way", () => {
    setLanguage("ja")
    const rows = setupRows(settings({ timing: { mode: "human", minMs: 1500, maxMs: 4000 } }))
    expect(rows.find((r) => r.id === "timing")?.value).toBe("人間らしく、1.5–4秒")
  })
})

describe("recentGames", () => {
  const game = (id: number): HistoryGame => ({
    id,
    pin: "916240",
    quizTitle: null,
    startedAt: id,
    endedAt: null,
    questions: 0,
    graded: 0,
    correct: 0,
    costUsd: 0,
    costComplete: true,
  })

  it("keeps the first four", () => {
    expect(recentGames([1, 2, 3, 4, 5, 6].map(game)).map((g) => g.id)).toEqual([1, 2, 3, 4])
    expect(recentGames([])).toEqual([])
  })
})
