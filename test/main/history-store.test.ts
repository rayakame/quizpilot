import { describe, expect, it } from "vitest"
import type { QuestionResult } from "../../src/core/kahoot/normalize.js"
import type { Decision } from "../../src/core/types.js"
import { HistoryStore } from "../../src/main/history/store.js"
import type { NewGame, QuestionView } from "../../src/shared/api.js"

const game: NewGame = {
  pin: "916240",
  quizTitle: "Geo",
  quizId: "q-1",
  context: "TUM",
  quizLink: "https://create.kahoot.it/details/q-1",
  timing: { mode: "human", minMs: 1000, maxMs: 3000 },
  includePrevious: false,
  startedAt: 1000,
}

const question = (index: number, over: Partial<QuestionView> = {}): QuestionView => ({
  index,
  type: "quiz",
  title: `Frage ${index + 1}`,
  choices: ["Zürich", "Bern"].map((text) => ({ text, image: null })),
  image: null,
  imageAlt: null,
  timeLimitMs: 20000,
  ...over,
})

const decision: Decision = {
  answer: { kind: "choice", index: 1 },
  source: "jev",
  confidence: 0.9,
  jev: { answer: { kind: "choice", index: 1 }, confidence: 0.9, probabilities: [0.1, 0.9] },
  usage: [{ provider: "typesafe", model: "", inputTokens: 300, outputTokens: 0 }],
}

const result = (over: Partial<QuestionResult> = {}): QuestionResult => ({
  index: 0,
  correct: true,
  points: 950,
  totalScore: 950,
  rank: 1,
  correctChoices: [1],
  answerText: "Bern",
  ...over,
})

function played() {
  const store = HistoryStore.open(":memory:")
  const id = store.startGame(game)
  store.saveBot(id, "Anna", "lobby")
  store.saveBot(id, "Ben", "lobby")
  store.saveQuestion(id, question(0))
  store.saveDecision(id, 0, decision, { usd: 0.0000126, complete: true })
  store.saveAnswered(id, 0, "Anna", 800)
  store.saveResult(id, 0, "Anna", result())
  store.saveResult(id, 0, "Ben", result({ correct: false, points: 0 }))
  store.saveQuestion(id, question(1, { title: null, choices: [] }))
  store.saveResult(id, 1, "Anna", result({ index: 1, correct: true }))
  store.saveQuestion(id, question(2, { type: "content" }))
  store.endBot(id, "Anna", { rank: 1, totalScore: 1900, correctCount: 2, incorrectCount: 0 })
  store.endGame(id, 9000)
  return { store, id }
}

describe("HistoryStore", () => {
  it("keeps everything that happened in a game", () => {
    const { store, id } = played()
    const record = store.getGame(id)!
    expect(record.game).toMatchObject({
      pin: "916240",
      quizTitle: "Geo",
      context: "TUM",
      quizLink: "https://create.kahoot.it/details/q-1",
      timing: { mode: "human", minMs: 1000, maxMs: 3000 },
      includePrevious: false,
      startedAt: 1000,
      endedAt: 9000,
    })
    expect(record.bots).toEqual([
      { name: "Anna", status: "lobby", totalScore: 1900, rank: 1 },
      { name: "Ben", status: "lobby", totalScore: null, rank: null },
    ])
    const [first, second] = record.questions
    expect(first).toMatchObject({
      question: question(0),
      correctChoices: [1],
      decision,
      costUsd: 0.0000126,
      results: [
        { bot: "Anna", answeredMs: 800, correct: true, points: 950 },
        { bot: "Ben", answeredMs: null, correct: false, points: 0 },
      ],
    })
    expect(second!.question).toEqual(question(1, { title: null, choices: [] }))
  })

  it("summarises games, newest first, without counting slides", () => {
    const { store } = played()
    const later = store.startGame({ ...game, startedAt: 5000, quizTitle: null })
    expect(store.listGames().map((g) => g.id)).toEqual([later, 1])
    expect(store.listGames()[1]).toMatchObject({
      questions: 2,
      graded: 2,
      correct: 1,
      costUsd: 0.0000126,
      costComplete: true,
    })
    expect(store.latestGameId()).toBe(later)
  })

  it("updates a question when Kahoot sends it again", () => {
    const store = HistoryStore.open(":memory:")
    const id = store.startGame(game)
    store.saveQuestion(id, question(0, { title: null }))
    store.setImagePath(id, 0, "/tmp/0.jpg")
    store.saveQuestion(id, question(0))
    const [q] = store.getGame(id)!.questions
    expect(q).toMatchObject({ question: question(0), imagePath: "/tmp/0.jpg" })
  })

  it("keeps the first end time", () => {
    const { store, id } = played()
    store.endGame(id, 12000)
    expect(store.getGame(id)!.game.endedAt).toBe(9000)
  })

  it("marks the cost incomplete when one decision had an unknown price", () => {
    const { store, id } = played()
    store.saveQuestion(id, question(3))
    store.saveDecision(id, 3, { ...decision, source: "fallback" }, { usd: 0, complete: false })
    expect(store.listGames()[0]).toMatchObject({ costComplete: false })
  })

  it("deletes one game or all of them", () => {
    const { store, id } = played()
    const other = store.startGame(game)
    expect(store.deleteGame(id)).toBe(true)
    expect(store.getGame(id)).toBeNull()
    expect(store.deleteGame(id)).toBe(false)
    expect(store.deleteAll()).toEqual([other])
    expect(store.listGames()).toEqual([])
    expect(store.latestGameId()).toBeNull()
  })
})
