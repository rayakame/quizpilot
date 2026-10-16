import { describe, expect, it, vi } from "vitest"
import type { Decision } from "../../src/core/types.js"
import { HistoryRecorder, type RecorderDeps } from "../../src/main/history/recorder.js"
import { HistoryStore } from "../../src/main/history/store.js"
import type { GameEvent, QuestionView, StartRequest } from "../../src/shared/api.js"

const request: StartRequest = {
  pin: "916240",
  names: ["Anna", "Ben"],
  timing: { mode: "instant", minMs: 0, maxMs: 0 },
  quizContext: "TUM",
  includePrevious: true,
  quizLink: null,
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
  usage: [{ provider: "typesafe", model: "", inputTokens: 1_000_000, outputTokens: 0 }],
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function setup(over: Partial<RecorderDeps> = {}) {
  const store = HistoryStore.open(":memory:")
  let clock = 1000
  const deps: RecorderDeps = {
    store,
    enabled: () => true,
    saveImage: vi.fn(async (game: number, index: number) => `/history/${game}/${index}.jpg`),
    now: () => (clock += 1000),
    log: vi.fn(),
    ...over,
  }
  return { store, deps, recorder: new HistoryRecorder(deps) }
}

const round = (index: number): GameEvent[] => [
  { type: "question", question: question(index) },
  { type: "decision", index, decision },
  { type: "answered", bot: "Anna", index, afterMs: 700 },
  {
    type: "result",
    bot: "Anna",
    result: {
      index,
      correct: true,
      points: 900,
      totalScore: 900,
      rank: 1,
      correctChoices: [1],
      answerText: "Bern",
    },
  },
]

describe("HistoryRecorder", () => {
  it("writes a whole game", async () => {
    const { store, recorder } = setup()
    recorder.begin(request, { id: "q-1", title: "Geo", questions: [] })
    for (const e of round(0)) recorder.event(e)
    recorder.event({
      type: "ended",
      bot: "Anna",
      end: { rank: 1, totalScore: 900, correctCount: 1, incorrectCount: 0 },
    })
    recorder.finish()
    await flush()
    const record = store.getGame(store.latestGameId()!)!
    expect(record.game).toMatchObject({
      pin: "916240",
      quizTitle: "Geo",
      context: "TUM",
      graded: 1,
      correct: 1,
    })
    expect(record.game.costUsd).toBeCloseTo(0.042, 10)
    expect(record.bots.map((b) => b.name)).toEqual(["Anna", "Ben"])
    expect(record.questions[0]).toMatchObject({
      decision,
      results: [{ bot: "Anna", answeredMs: 700, correct: true, points: 900 }],
    })
  })

  it("saves the question picture next to the game", async () => {
    const { store, deps, recorder } = setup()
    recorder.begin(request, null)
    const id = store.latestGameId()!
    recorder.event({
      type: "question",
      question: question(0, { image: { url: "https://media.kahoot.it/x" } }),
    })
    await flush()
    expect(deps.saveImage).toHaveBeenCalledWith(id, 0, "https://media.kahoot.it/x")
    expect(store.getGame(id)!.questions[0]!.imagePath).toBe(`/history/${id}/0.jpg`)
  })

  it("books a result without index on the last question", () => {
    const { store, recorder } = setup()
    recorder.begin(request, null)
    recorder.event({ type: "question", question: question(4) })
    recorder.event({
      type: "result",
      bot: "Ben",
      result: {
        index: null,
        correct: false,
        points: 0,
        totalScore: 0,
        rank: 2,
        correctChoices: null,
        answerText: null,
      },
    })
    const [q] = store.getGame(store.latestGameId()!)!.questions
    expect(q!.results).toEqual([{ bot: "Ben", answeredMs: null, correct: false, points: 0 }])
  })

  it("starts a new entry when the host plays the quiz again", () => {
    const { store, recorder } = setup()
    recorder.begin(request, null)
    for (const e of round(0)) recorder.event(e)
    recorder.event({ type: "gameReset" })
    for (const e of round(0)) recorder.event(e)
    const games = store.listGames()
    expect(games).toHaveLength(2)
    expect(games.every((g) => g.questions === 1)).toBe(true)
    expect(store.getGame(games[1]!.id)!.game.endedAt).not.toBeNull()
  })

  it("writes nothing when the history is turned off", () => {
    const { store, recorder } = setup({ enabled: () => false })
    recorder.begin(request, null)
    for (const e of round(0)) recorder.event(e)
    recorder.finish()
    expect(store.listGames()).toEqual([])
  })

  it("keeps the game going when the database fails and logs it once", () => {
    const { store, deps, recorder } = setup()
    recorder.begin(request, null)
    store.close()
    expect(() => {
      for (const e of round(0)) recorder.event(e)
      recorder.finish()
    }).not.toThrow()
    expect(deps.log).toHaveBeenCalledTimes(1)
  })

  it("ignores events before a game starts", () => {
    const { store, recorder } = setup()
    for (const e of round(0)) recorder.event(e)
    expect(store.listGames()).toEqual([])
  })
})
