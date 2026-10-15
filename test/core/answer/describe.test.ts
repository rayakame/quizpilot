import { describe, expect, it } from "vitest"
import { answerText, correctAnswer } from "../../../src/core/answer/describe.js"
import type { Question } from "../../../src/core/types.js"

const q = (over: Partial<Question> = {}): Question => ({
  index: 0,
  type: "quiz",
  title: "?",
  choices: ["Zürich", "Bern", "Genf", "Basel"].map((text) => ({ text, image: null })),
  image: null,
  timeLimitMs: 20_000,
  raw: null,
  ...over,
})

describe("answerText", () => {
  it("names every answer kind", () => {
    expect(answerText({ kind: "choice", index: 1 }, q())).toBe("Bern")
    expect(answerText({ kind: "choices", indices: [0, 2] }, q())).toBe("Zürich, Genf")
    expect(answerText({ kind: "order", order: [3, 1] }, q())).toBe("Basel → Bern")
    expect(answerText({ kind: "number", value: 16 }, q())).toBe("16")
    expect(answerText({ kind: "text", value: "Isar" }, q())).toBe("Isar")
    expect(answerText({ kind: "none" }, q())).toBe("–")
  })

  it("numbers answers that have no text", () => {
    const images = q({
      choices: [
        { text: null, image: { url: "u" } },
        { text: null, image: { url: "v" } },
      ],
    })
    expect(answerText({ kind: "choice", index: 1 }, images)).toBe("#2")
  })
})

describe("correctAnswer", () => {
  it("reads Kahoot's correct choices per question type", () => {
    expect(correctAnswer(q(), [1])).toEqual({ kind: "choice", index: 1 })
    expect(correctAnswer(q({ type: "multiple_select_quiz" }), [0, 2])).toEqual({
      kind: "choices",
      indices: [0, 2],
    })
    expect(correctAnswer(q({ type: "jumble" }), [2, 3, 1, 0])).toEqual({
      kind: "order",
      order: [2, 3, 1, 0],
    })
  })
})
