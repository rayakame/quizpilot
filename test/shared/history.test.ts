import { describe, expect, it } from "vitest"
import type { HistoryQuestion, HistoryResult } from "../../src/shared/api.js"
import { questionOutcome } from "../../src/shared/history.js"

const q = (results: Partial<HistoryResult>[]): HistoryQuestion => ({
  question: {
    index: 0,
    type: "quiz",
    title: "t",
    choices: [],
    image: null,
    imageAlt: null,
    timeLimitMs: 20000,
  },
  imagePath: null,
  correctChoices: null,
  decision: null,
  costUsd: null,
  results: results.map((r) => ({
    bot: "a",
    answeredMs: null,
    correct: null,
    points: null,
    onPurpose: false,
    ...r,
  })),
})

describe("questionOutcome", () => {
  it("grades a question by every bot's result", () => {
    expect(questionOutcome(q([{ correct: true }, { correct: true }]))).toBe("right")
    expect(questionOutcome(q([{ correct: false }]))).toBe("wrong")
    expect(questionOutcome(q([{ correct: true }, { correct: false }]))).toBe("mixed")
    expect(questionOutcome(q([{ correct: null }]))).toBe("open")
    expect(questionOutcome(q([]))).toBe("open")
  })
})

describe("misses on purpose", () => {
  it("are left out of the grade", () => {
    expect(
      questionOutcome(
        q([
          { bot: "Anna", correct: true },
          { bot: "Ben", correct: false, onPurpose: true },
        ]),
      ),
    ).toBe("right")
  })
})
