import { describe, expect, it } from "vitest"
import { formatPrevious } from "../../../src/core/answer/context.js"

describe("formatPrevious", () => {
  it("marks right and wrong answers and adds the correct one when known", () => {
    expect(
      formatPrevious([
        {
          index: 6,
          title: "Wahrzeichen neben der TUM?",
          answer: "Königsplatz",
          correct: true,
          correctAnswer: "Königsplatz",
        },
        {
          index: 7,
          title: "Durchfallquote 80 %?",
          answer: "Analysis 1",
          correct: false,
          correctAnswer: "Lineare Algebra",
        },
        { index: 8, title: "Binärzahl?", answer: "193", correct: null, correctAnswer: null },
      ]),
    ).toEqual([
      "Q7: Wahrzeichen neben der TUM? → Königsplatz ✓",
      "Q8: Durchfallquote 80 %? → Analysis 1 ✗ (correct: Lineare Algebra)",
      "Q9: Binärzahl? → 193",
    ])
  })
})
