import { describe, expect, it } from "vitest"
import { isRight } from "../../../src/core/answer/grade.js"

describe("isRight", () => {
  it("grades single answers", () => {
    expect(isRight({ kind: "choice", index: 1 }, "quiz", [1])).toBe(true)
    expect(isRight({ kind: "choice", index: 0 }, "quiz", [1, 2])).toBe(false)
    expect(isRight({ kind: "choice", index: 2 }, "quiz", [1, 2])).toBe(true)
  })

  it("needs every answer of a multiple select question", () => {
    expect(isRight({ kind: "choices", indices: [3, 1] }, "multiple_select_quiz", [1, 3])).toBe(true)
    expect(isRight({ kind: "choices", indices: [1] }, "multiple_select_quiz", [1, 3])).toBe(false)
  })

  it("needs the exact puzzle order", () => {
    expect(isRight({ kind: "order", order: [2, 3, 1, 0] }, "jumble", [2, 3, 1, 0])).toBe(true)
    expect(isRight({ kind: "order", order: [3, 2, 1, 0] }, "jumble", [2, 3, 1, 0])).toBe(false)
  })

  it("cannot grade numbers, texts or skipped questions", () => {
    expect(isRight({ kind: "number", value: 4 }, "slider", [4])).toBeNull()
    expect(isRight({ kind: "text", value: "x" }, "open_ended", [0])).toBeNull()
    expect(isRight({ kind: "none" }, "quiz", [0])).toBeNull()
  })
})
