import { describe, expect, it } from "vitest"
import {
  fromChecks,
  fromChoice,
  fromEstimate,
  fromPositions,
  randomAnswer,
  snap,
} from "../../../src/core/answer/strategies.js"
import type { Question } from "../../../src/core/types.js"

const q = (over: Partial<Question>): Question => ({
  index: 0,
  type: "quiz",
  title: "?",
  choices: ["a", "b", "c", "d"].map((text) => ({ text, image: null })),
  image: null,
  timeLimitMs: 20_000,
  raw: null,
  ...over,
})

describe("fromChoice", () => {
  it("wants a fallback below the threshold", () => {
    expect(fromChoice({ index: 2, confidence: 0.59 }, 0.6)).toEqual({
      answer: { kind: "choice", index: 2 },
      confidence: 0.59,
      wantsFallback: true,
    })
    expect(fromChoice({ index: 2, confidence: 0.6 }, 0.6).wantsFallback).toBe(false)
  })
})

describe("fromChecks", () => {
  it("picks every option at or above 50 %", () => {
    expect(fromChecks([0.9, 0.1, 0.8, 0.2])).toEqual({
      answer: { kind: "choices", indices: [0, 2] },
      confidence: 0.8,
      wantsFallback: false,
    })
  })

  it("keeps at least the most likely option and flags uncertainty", () => {
    const p = fromChecks([0.2, 0.4, 0.1])
    expect(p.answer).toEqual({ kind: "choices", indices: [1] })
    expect(p.wantsFallback).toBe(true)
  })
})

describe("fromPositions", () => {
  it("sorts options by expected position", () => {
    expect(fromPositions([2.1, 0.2, 3, 1.1])).toEqual({
      answer: { kind: "order", order: [1, 3, 0, 2] },
      confidence: null,
      wantsFallback: false,
    })
  })

  it("flags neighbours closer than half a position", () => {
    expect(fromPositions([0.9, 1.2, 2.5, 3.6]).wantsFallback).toBe(true)
  })
})

describe("snap", () => {
  it("rounds to the step and clamps", () => {
    expect(snap(47.3, { min: 0, max: 100, step: 5 })).toBe(45)
    expect(snap(1.26, { min: 0, max: 2, step: 0.1 })).toBe(1.3)
    expect(snap(130, { min: 0, max: 100, step: 1 })).toBe(100)
    expect(snap(-7.4, { min: -10, max: 10, step: 2 })).toBe(-8)
    expect(snap(10, { min: 0, max: 10, step: 3 })).toBe(9)
  })
})

describe("fromEstimate", () => {
  it("snaps the value and always wants a fallback", () => {
    expect(fromEstimate({ value: 47.3, confidence: 0.4 }, { min: 0, max: 100, step: 5 })).toEqual({
      answer: { kind: "number", value: 45 },
      confidence: 0.4,
      wantsFallback: true,
    })
  })
})

describe("randomAnswer", () => {
  it("stays within two options for true/false", () => {
    const tf = q({
      type: "true_false",
      choices: [
        { text: "Wahr", image: null },
        { text: "Falsch", image: null },
      ],
    })
    expect(randomAnswer(tf, () => 0.99)).toEqual({ kind: "choice", index: 1 })
  })

  it("shuffles all positions for puzzles", () => {
    const a = randomAnswer(q({ type: "jumble" }), () => 0)
    expect(a.kind).toBe("order")
    expect(a.kind === "order" && [...a.order].sort()).toEqual([0, 1, 2, 3])
  })

  it("uses the middle of a slider and nothing for free text", () => {
    expect(
      randomAnswer(q({ type: "slider", slider: { min: 0, max: 10, step: 1 } }), Math.random),
    ).toEqual({ kind: "number", value: 5 })
    expect(randomAnswer(q({ type: "open_ended" }), Math.random)).toEqual({ kind: "none" })
  })

  it("assumes four options when Kahoot sent none", () => {
    expect(randomAnswer(q({ choices: [] }), () => 0.99)).toEqual({ kind: "choice", index: 3 })
  })
})
