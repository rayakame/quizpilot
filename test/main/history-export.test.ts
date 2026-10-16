import { describe, expect, it } from "vitest"
import { exportName, toCsv, toJson } from "../../src/main/history/export.js"
import type { HistoryQuestion, HistoryRecord } from "../../src/shared/api.js"

const q = (over: Partial<HistoryQuestion> = {}): HistoryQuestion => ({
  question: {
    index: 0,
    type: "quiz",
    title: 'Capital, "really"?\nPick one',
    choices: ["Bern", "Zürich, CH"].map((text) => ({ text, image: null })),
    image: null,
    imageAlt: null,
    timeLimitMs: 20000,
  },
  imagePath: null,
  correctChoices: [0],
  decision: { answer: { kind: "choice", index: 1 }, source: "jev", confidence: 0.62, usage: [] },
  costUsd: 0.0000126,
  results: [
    { bot: "Anna", answeredMs: 800, correct: false, points: 0 },
    { bot: "Ben", answeredMs: 1200, correct: false, points: 0 },
  ],
  ...over,
})

const record = (questions: HistoryQuestion[]): HistoryRecord => ({
  game: {
    id: 7,
    pin: "916240",
    quizTitle: "Geo",
    startedAt: Date.UTC(2026, 9, 16, 18, 30),
    endedAt: null,
    questions: questions.length,
    graded: 1,
    correct: 0,
    costUsd: 0.0000126,
    costComplete: true,
    context: null,
    quizLink: null,
    timing: { mode: "instant", minMs: 0, maxMs: 0 },
    includePrevious: true,
  },
  bots: [],
  questions,
})

describe("toCsv", () => {
  it("writes one row per question and quotes what needs quoting", () => {
    const [header, row, ...rest] = toCsv(record([q()])).split("\r\n")
    expect(header).toBe(
      "question,type,title,answer,correct_answer,result,source,confidence,average_ms,cost_usd",
    )
    expect(row).toBe(
      '1,quiz,"Capital, ""really""?\nPick one","Zürich, CH",Bern,wrong,jev,0.62,1000,0.0000126',
    )
    expect(rest).toEqual([""])
  })

  it("keeps questions without text or answers", () => {
    const hidden = q({
      question: { ...q().question, title: null, choices: [] },
      correctChoices: null,
      decision: null,
      costUsd: null,
      results: [],
    })
    expect(toCsv(record([hidden])).split("\r\n")[1]).toBe("1,quiz,,,,open,,,,")
  })

  it("leaves slides out", () => {
    const slide = q({ question: { ...q().question, type: "content" } })
    expect(toCsv(record([slide])).split("\r\n")).toHaveLength(2)
  })
})

describe("toJson / exportName", () => {
  it("exports the whole record", () => {
    expect(JSON.parse(toJson(record([q()])))).toEqual(record([q()]))
  })

  it("names the file after the quiz and the day", () => {
    expect(exportName(record([]))).toBe("quizpilot-geo-2026-10-16")
    expect(exportName({ ...record([]), game: { ...record([]).game, quizTitle: null } })).toBe(
      "quizpilot-916240-2026-10-16",
    )
  })
})
