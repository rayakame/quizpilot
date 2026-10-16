import { describe, expect, it } from "vitest"
import { wrongAnswer } from "../../../src/core/answer/mistakes.js"
import type { Answer, Question } from "../../../src/core/types.js"

const q = (over: Partial<Question>): Question => ({
  index: 0,
  type: "quiz",
  title: "Q",
  choices: [
    { text: "A", image: null },
    { text: "B", image: null },
    { text: "C", image: null },
    { text: "D", image: null },
  ],
  image: null,
  timeLimitMs: 20000,
  raw: null,
  ...over,
})
const at = (value: number) => () => value

describe("wrongAnswer", () => {
  it("picks another choice", () => {
    for (const r of [0, 0.3, 0.6, 0.99]) {
      const wrong = wrongAnswer({ kind: "choice", index: 2 }, q({}), at(r))
      expect(wrong?.kind).toBe("choice")
      if (wrong?.kind !== "choice") continue
      expect(wrong.index).not.toBe(2)
      expect(wrong.index).toBeGreaterThanOrEqual(0)
      expect(wrong.index).toBeLessThan(4)
    }
  })

  it("flips true and false", () => {
    const tf = q({ type: "true_false", choices: q({}).choices.slice(0, 2) })
    expect(wrongAnswer({ kind: "choice", index: 0 }, tf, at(0.5))).toEqual({
      kind: "choice",
      index: 1,
    })
  })

  it("changes exactly one pick of a multiple choice and never empties it", () => {
    const multi = q({ type: "multiple_select_quiz" })
    for (const r of [0, 0.4, 0.99]) {
      const wrong = wrongAnswer({ kind: "choices", indices: [1] }, multi, at(r))
      expect(wrong?.kind).toBe("choices")
      if (wrong?.kind !== "choices") continue
      expect(wrong.indices.length).toBeGreaterThan(0)
      expect([...wrong.indices].sort()).not.toEqual([1])
      const changed = [0, 1, 2, 3].filter((i) => wrong.indices.includes(i) !== [1].includes(i))
      expect(changed).toHaveLength(1)
    }
  })

  it("swaps two neighbouring puzzle pieces", () => {
    const jumble = q({ type: "jumble" })
    const wrong = wrongAnswer({ kind: "order", order: [3, 1, 0, 2] }, jumble, at(0.5))
    expect(wrong?.kind).toBe("order")
    if (wrong?.kind !== "order") return
    expect([...wrong.order].sort()).toEqual([0, 1, 2, 3])
    expect(wrong.order).not.toEqual([3, 1, 0, 2])
    const moved = wrong.order.flatMap((v, i) => (v === [3, 1, 0, 2][i] ? [] : [i]))
    expect(moved).toHaveLength(2)
    expect(moved[1]! - moved[0]!).toBe(1)
    const two = wrongAnswer({ kind: "order", order: [1, 0] }, q({ type: "jumble" }), at(0.9))
    expect(two).toEqual({ kind: "order", order: [0, 1] })
  })

  it("moves a slider answer within the range and onto the step", () => {
    const slider = q({ type: "slider", choices: [], slider: { min: 0, max: 100, step: 5 } })
    for (const r of [0, 0.5, 0.99]) {
      const wrong = wrongAnswer({ kind: "number", value: 40 }, slider, at(r))
      expect(wrong?.kind).toBe("number")
      if (wrong?.kind !== "number") continue
      expect(wrong.value).not.toBe(40)
      expect(wrong.value).toBeGreaterThanOrEqual(0)
      expect(wrong.value).toBeLessThanOrEqual(100)
      expect(wrong.value % 5).toBe(0)
      expect(Math.abs(wrong.value - 40)).toBeGreaterThanOrEqual(15)
    }
  })

  it("goes the other way at the edge of the slider", () => {
    const slider = q({ type: "slider", choices: [], slider: { min: 0, max: 100, step: 1 } })
    const up = () => 0.99
    const wrong = wrongAnswer({ kind: "number", value: 100 }, slider, up)
    expect(wrong?.kind === "number" && wrong.value < 100).toBe(true)
  })

  it("leaves answers alone where wrong makes no sense", () => {
    const cases: [Answer, Partial<Question>][] = [
      [
        { kind: "text", value: "Isar" },
        { type: "open_ended", choices: [] },
      ],
      [{ kind: "none" }, { type: "content", choices: [] }],
      [{ kind: "choice", index: 0 }, { type: "survey" }],
      [
        { kind: "text", value: "Isar" },
        { type: "word_cloud", choices: [] },
      ],
      [
        { kind: "choice", index: 0 },
        { type: "quiz", choices: q({}).choices.slice(0, 1) },
      ],
    ]
    for (const [answer, over] of cases) expect(wrongAnswer(answer, q(over), at(0.5))).toBeNull()
  })
})
