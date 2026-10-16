import { describe, expect, it } from "vitest"
import type { QuestionResult } from "../../src/core/kahoot/normalize.js"
import type { Decision } from "../../src/core/types.js"
import {
  answerSummary,
  choiceRows,
  currentRound,
  EMPTY_GAME,
  isOver,
  outcome,
  pastRounds,
  reduce,
  removeBot,
  type GameState,
} from "../../src/renderer/src/lib/game-state.js"
import type { GameEvent, QuestionView } from "../../src/shared/api.js"

const question = (index: number, over: Partial<QuestionView> = {}): QuestionView => ({
  index,
  type: "quiz",
  title: `Q${index + 1}`,
  choices: ["Zürich", "Bern", "Genf", "Basel"].map((text) => ({ text, image: null })),
  image: null,
  timeLimitMs: 20_000,
  ...over,
})

const decision = (over: Partial<Decision> = {}): Decision => ({
  answer: { kind: "choice", index: 1 },
  source: "jev",
  confidence: 0.9,
  jev: {
    answer: { kind: "choice", index: 1 },
    confidence: 0.9,
    probabilities: [0.05, 0.9, 0.03, 0.02],
  },
  usage: [],
  ...over,
})

const result = (over: Partial<QuestionResult> = {}): QuestionResult => ({
  index: 0,
  correct: true,
  points: 950,
  totalScore: 950,
  rank: 1,
  correctChoices: [1],
  answerText: null,
  ...over,
})

const play = (...events: GameEvent[]) => events.reduce<GameState>(reduce, EMPTY_GAME)

describe("reduce", () => {
  it("tracks each bot's status, score and rank", () => {
    const state = play(
      { type: "status", bot: "Anna", status: "joining" },
      { type: "status", bot: "Ben", status: "joining" },
      { type: "status", bot: "Anna", status: "lobby" },
      { type: "question", question: question(0) },
      { type: "result", bot: "Anna", result: result() },
    )
    expect(state.bots).toEqual([
      {
        name: "Anna",
        status: "lobby",
        detail: null,
        cause: null,
        joinError: null,
        totalScore: 950,
        rank: 1,
      },
      {
        name: "Ben",
        status: "joining",
        detail: null,
        cause: null,
        joinError: null,
        totalScore: 0,
        rank: null,
      },
    ])
  })

  it("remembers why a join failed until the bot tries again", () => {
    const failed = play(
      { type: "status", bot: "Anna", status: "joining" },
      { type: "status", bot: "Anna", status: "disconnected", detail: "Name is already taken" },
      { type: "joinFailed", bot: "Anna", code: "duplicate_name", message: "Name is already taken" },
    )
    expect(failed.bots[0]).toMatchObject({ joinError: "duplicate_name", status: "disconnected" })
    const retry = reduce(failed, { type: "status", bot: "Anna", status: "joining" })
    expect(retry.bots[0]).toMatchObject({ joinError: null, detail: null })
    expect(removeBot(failed, "Anna").bots).toEqual([])
  })

  it("collects decision, answers and results per question", () => {
    const state = play(
      { type: "question", question: question(0) },
      { type: "decision", index: 0, decision: decision() },
      { type: "answered", bot: "Anna", index: 0, afterMs: 1200 },
      { type: "result", bot: "Anna", result: result() },
      { type: "question", question: question(1) },
    )
    const first = state.rounds[0]!
    expect(first.decision?.source).toBe("jev")
    expect(first.answeredMs).toEqual({ Anna: 1200 })
    expect(first.results["Anna"]?.correct).toBe(true)
    expect(currentRound(state)?.question.index).toBe(1)
    expect(pastRounds(state).map((r) => r.question.index)).toEqual([0])
  })

  it("puts a result without question number on the latest question", () => {
    const state = play(
      { type: "question", question: question(4) },
      { type: "result", bot: "Anna", result: result({ index: null }) },
    )
    expect(state.rounds[0]!.results["Anna"]).toBeDefined()
  })

  it("opens and closes the two-step prompt", () => {
    const asking = play({ type: "twoStepRequired" })
    expect(asking.twoStep).toBe("asking")
    expect(reduce(asking, { type: "twoStepResult", ok: false }).twoStep).toBe("wrong")
    expect(reduce(asking, { type: "twoStepResult", ok: true }).twoStep).toBe("none")
  })

  it("starts over when the host plays again", () => {
    const state = play(
      { type: "status", bot: "Anna", status: "lobby" },
      { type: "question", question: question(0) },
      { type: "result", bot: "Anna", result: result() },
      { type: "gameReset" },
    )
    expect(state.rounds).toEqual([])
    expect(state.bots[0]).toMatchObject({ totalScore: 0, rank: null })
  })
})

describe("isOver", () => {
  it("is over once no bot is playing anymore", () => {
    const state = play(
      { type: "status", bot: "Anna", status: "finished" },
      { type: "status", bot: "Ben", status: "playing" },
    )
    expect(isOver(EMPTY_GAME)).toBe(false)
    expect(isOver(state)).toBe(false)
    expect(isOver(reduce(state, { type: "status", bot: "Ben", status: "kicked" }))).toBe(true)
  })
})

describe("isOver after a failed join", () => {
  it("is not over while a bot only failed to join", () => {
    const state = play(
      { type: "status", bot: "Anna", status: "joining" },
      { type: "status", bot: "Anna", status: "disconnected", detail: "Name is already taken" },
      { type: "joinFailed", bot: "Anna", code: "duplicate_name", message: "Name is already taken" },
    )
    expect(isOver(state)).toBe(false)
  })
})

describe("choiceRows", () => {
  it("marks our pick, Jev's probabilities and the right answer", () => {
    const state = play(
      { type: "question", question: question(0) },
      { type: "decision", index: 0, decision: decision() },
      { type: "result", bot: "Anna", result: result({ correctChoices: [2] }) },
    )
    const rows = choiceRows(state.rounds[0]!)
    expect(rows[1]).toMatchObject({ text: "Bern", chosen: true, probability: 0.9, correct: false })
    expect(rows[2]).toMatchObject({ chosen: false, correct: true })
  })

  it("shows image answers as images", () => {
    const image = (id: string) => ({ text: null, image: { url: `https://media.kahoot.it/${id}` } })
    const state = play({
      type: "question",
      question: question(0, { choices: [image("a"), image("b")] }),
    })
    expect(choiceRows(state.rounds[0]!).map((r) => [r.text, r.image])).toEqual([
      [null, "https://media.kahoot.it/a"],
      [null, "https://media.kahoot.it/b"],
    ])
  })

  it("shows the order for puzzles", () => {
    const state = play(
      { type: "question", question: question(0, { type: "jumble" }) },
      {
        type: "decision",
        index: 0,
        decision: decision({ answer: { kind: "order", order: [2, 0, 3, 1] }, jev: undefined }),
      },
    )
    expect(choiceRows(state.rounds[0]!).map((r) => r.position)).toEqual([2, 4, 1, 3])
  })
})

describe("answerSummary and outcome", () => {
  it("describes our answer and how it went for the bots", () => {
    const state = play(
      { type: "question", question: question(0) },
      { type: "decision", index: 0, decision: decision() },
      { type: "result", bot: "Anna", result: result() },
      { type: "result", bot: "Ben", result: result({ correct: false }) },
    )
    const round = state.rounds[0]!
    expect(answerSummary(round)).toBe("Bern")
    expect(outcome(round)).toBe("mixed")
  })
})

describe("notices", () => {
  it("remembers a notice once", () => {
    const once = reduce(EMPTY_GAME, { type: "notice", notice: "jev_key" })
    const twice = reduce(once, { type: "notice", notice: "jev_key" })
    expect(twice.notices).toEqual(["jev_key"])
  })
})

describe("disconnects", () => {
  it("keeps why a bot was disconnected", () => {
    const state = play({ type: "status", bot: "Ada", status: "disconnected", cause: "ended" })
    expect(state.bots[0]?.cause).toBe("ended")
    const back = reduce(state, { type: "status", bot: "Ada", status: "joining" })
    expect(back.bots[0]?.cause).toBeNull()
  })
})
