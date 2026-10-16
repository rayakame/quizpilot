import { describe, expect, it } from "vitest"
import { gameLine, gameTitle, matches } from "../../src/renderer/src/lib/history-view.js"
import type { HistoryGame, HistoryQuestion } from "../../src/shared/api.js"

const q = (over: Partial<HistoryQuestion> = {}): HistoryQuestion => ({
  question: {
    index: 0,
    type: "quiz",
    title: "t",
    choices: [{ text: "a", image: null }],
    image: null,
    imageAlt: null,
    timeLimitMs: 20000,
  },
  imagePath: null,
  correctChoices: [0],
  decision: { answer: { kind: "choice", index: 0 }, source: "jev", confidence: 0.95, usage: [] },
  costUsd: 0,
  results: [{ bot: "Anna", answeredMs: 500, correct: true, points: 900 }],
  ...over,
})

const game: HistoryGame = {
  id: 1,
  pin: "916240",
  quizTitle: null,
  startedAt: 0,
  endedAt: null,
  questions: 10,
  graded: 9,
  correct: 7,
  costUsd: 0.0123,
  costComplete: true,
}

describe("matches", () => {
  it("finds wrong and mixed questions", () => {
    const wrong = q({ results: [{ bot: "Anna", answeredMs: 1, correct: false, points: 0 }] })
    const mixed = q({
      results: [
        { bot: "Anna", answeredMs: 1, correct: false, points: 0 },
        { bot: "Ben", answeredMs: 1, correct: true, points: 900 },
      ],
    })
    expect(matches(wrong, "wrong", 0.6)).toBe(true)
    expect(matches(mixed, "wrong", 0.6)).toBe(true)
    expect(matches(q(), "wrong", 0.6)).toBe(false)
  })

  it("finds answers the AI was unsure about or guessed", () => {
    const unsure = q({ decision: { ...q().decision!, confidence: 0.4 } })
    const guessed = q({ decision: { ...q().decision!, source: "random", confidence: null } })
    expect(matches(unsure, "unsure", 0.6)).toBe(true)
    expect(matches(guessed, "unsure", 0.6)).toBe(true)
    expect(matches(q(), "unsure", 0.6)).toBe(false)
    expect(matches(q({ decision: null }), "unsure", 0.6)).toBe(false)
  })

  it("finds questions with a picture in the question or the answers", () => {
    const pictured = q({
      question: { ...q().question, image: { url: "https://media.kahoot.it/x" } },
    })
    const pictureAnswers = q({
      question: {
        ...q().question,
        choices: [{ text: null, image: { url: "https://media.kahoot.it/y" } }],
      },
    })
    expect(matches(pictured, "image", 0.6)).toBe(true)
    expect(matches(pictureAnswers, "image", 0.6)).toBe(true)
    expect(matches(q(), "image", 0.6)).toBe(false)
    expect(matches(q(), "all", 0.6)).toBe(true)
  })
})

describe("game labels", () => {
  it("names a game after its quiz or its PIN", () => {
    expect(gameTitle(game)).toBe("Game 916240")
    expect(gameTitle({ ...game, quizTitle: "Geo" })).toBe("Geo")
  })

  it("sums up a game in one line", () => {
    expect(gameLine(game)).toBe("7 of 9 right · ≈ $0.012")
  })
})
