import { describe, expect, it } from "vitest"
import type { Decision } from "../../src/core/types.js"
import {
  EMPTY_GAME,
  type GameState,
  type RoundView,
} from "../../src/renderer/src/lib/game-state.js"
import { gameSummary } from "../../src/renderer/src/lib/summary.js"

const decision = (source: Decision["source"], tokens = 1_000_000): Decision => ({
  answer: { kind: "choice", index: 0 },
  source,
  confidence: 0.9,
  usage: [{ provider: "typesafe", model: "", inputTokens: tokens, outputTokens: 0 }],
})

const round = (index: number, over: Partial<RoundView> = {}): RoundView => ({
  question: {
    index,
    type: "quiz",
    title: "t",
    choices: [],
    image: null,
    imageAlt: null,
    timeLimitMs: 20000,
  },
  decision: decision("jev"),
  results: {},
  answeredMs: {},
  onPurpose: [],
  ...over,
})

const result = (correct: boolean | null) => ({
  index: 0,
  correct,
  points: 0,
  totalScore: 0,
  rank: 1,
  correctChoices: null,
  answerText: null,
})

describe("gameSummary", () => {
  it("counts right answers, sources, answer time and cost", () => {
    const state: GameState = {
      ...EMPTY_GAME,
      rounds: [
        round(0, { results: { Anna: result(true) }, answeredMs: { Anna: 1000, Ben: 2000 } }),
        round(1, {
          results: { Anna: result(false) },
          decision: decision("fallback"),
          answeredMs: { Anna: 3000 },
        }),
        round(2, { results: { Anna: result(null) }, decision: decision("skip", 0) }),
      ],
    }
    const s = gameSummary(state)
    expect(s).toMatchObject({
      graded: 2,
      correct: 1,
      sources: { jev: 1, fallback: 1 },
      averageMs: 2000,
    })
    expect(s.cost.usd).toBeCloseTo(0.084, 10)
  })

  it("leaves slides out and has no time without answers", () => {
    const slide = round(0, { question: { ...round(0).question, type: "content" }, decision: null })
    expect(gameSummary({ ...EMPTY_GAME, rounds: [slide] })).toEqual({
      graded: 0,
      correct: 0,
      sources: {},
      averageMs: null,
      cost: { usd: 0, complete: true },
    })
  })
})

describe("misses on purpose", () => {
  it("count as right when the other bots got it", () => {
    const state: GameState = {
      ...EMPTY_GAME,
      rounds: [
        round(0, {
          results: { Anna: result(true), Ben: result(false) },
          onPurpose: ["Ben"],
        }),
      ],
    }
    expect(gameSummary(state)).toMatchObject({ graded: 1, correct: 1 })
  })
})
