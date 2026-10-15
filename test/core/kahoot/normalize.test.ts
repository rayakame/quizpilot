import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  toKahootAnswer,
  toQuestion,
  toQuizEnd,
  toResult,
  toUpcoming,
} from "../../../src/core/kahoot/normalize.js"

const A = "test/fixtures/kahoot/2026-10-15T20-44-39-567Z"
const B = "test/fixtures/kahoot/2026-10-15T20-48-24-699Z"
const load = (dir: string, file: string) => JSON.parse(readFileSync(join(dir, file), "utf8"))
const MEDIA = "https://media.kahoot.it/"

describe("toUpcoming / toQuestion", () => {
  it("reads a text question and its get-ready time", () => {
    expect(toUpcoming(load(A, "0025-event-QuestionReady.json"))).toMatchObject({
      startsInMs: 5000,
      question: {
        index: 0,
        type: "quiz",
        title: "Hauptstadt der Schweiz?",
        choices: ["Zürich", "Bern", "Genf", "Basel"].map((text) => ({ text, image: null })),
        image: null,
        imageAlt: null,
        timeLimitMs: 20000,
      },
    })
  })

  it("reads the question image and its description", () => {
    expect(toQuestion(load(A, "0037-event-QuestionReady.json"))).toMatchObject({
      image: { url: `${MEDIA}5acaaf64-b131-4968-a951-afde14c526bf` },
      imageAlt: "Paris skyline with Eiffel Tower on a sunny day, wide angle view, France",
    })
  })

  it("turns image answers into media URLs", () => {
    const q = toQuestion(load(A, "0049-event-QuestionReady.json"))
    expect(q.choices).toHaveLength(4)
    expect(q.choices[0]).toEqual({
      text: null,
      image: { url: `${MEDIA}c3db673e-7756-4dff-a821-b0eefd57b2d2` },
    })
  })

  it("maps true/false, multiple select, puzzle, word cloud and slides", () => {
    const files = ["0061", "0073", "0085", "0095", "0105"].map((n) =>
      toQuestion(load(A, `${n}-event-QuestionReady.json`)),
    )
    expect(files.map((q) => q.type)).toEqual([
      "true_false",
      "multiple_select_quiz",
      "jumble",
      "word_cloud",
      "content",
    ])
    expect(files[1]?.timeLimitMs).toBe(5000)
    expect(files[2]?.choices.map((c) => c.text)).toEqual(["Elefant", "Pferd", "Maus", "Katze"])
  })

  it("uses the block index when QuestionStart has no question index", () => {
    expect(toQuestion(load(A, "0040-event-QuestionStart.json"))).toMatchObject({
      index: 1,
      title: "Welches Land?",
    })
  })

  it("keeps the number of answers when the host hides the question", () => {
    expect(toQuestion(load(B, "0061-event-QuestionReady.json"))).toMatchObject({
      type: "true_false",
      title: null,
      choices: [
        { text: null, image: null },
        { text: null, image: null },
      ],
    })
  })

  it("decodes text and marks unknown types", () => {
    const q = toQuestion({ type: "quiz", title: "I = 0 &amp; U = Bel.", choices: [{ answer: "&lt;5" }] })
    expect(q.title).toBe("I = 0 & U = Bel.")
    expect(q.choices[0]?.text).toBe("<5")
    expect(toQuestion({ type: "drop_pin" }).type).toBe("unknown")
  })
})

describe("toResult / toQuizEnd", () => {
  it("reads a wrong single answer", () => {
    expect(toResult(load(A, "0032-event-QuestionEnd.json"))).toEqual({
      index: 0,
      correct: false,
      points: 0,
      totalScore: 0,
      rank: 1,
      correctChoices: [1],
      answerText: "Zürich",
    })
  })

  it("reads partial points, puzzle order and word clouds", () => {
    expect(toResult(load(A, "0080-event-QuestionEnd.json"))).toMatchObject({
      points: 500,
      correct: false,
      correctChoices: [0, 2],
    })
    expect(toResult(load(A, "0092-event-QuestionEnd.json"))).toMatchObject({
      correctChoices: [2, 3, 1, 0],
      answerText: "Elefant|Pferd|Maus|Katze",
    })
    expect(toResult(load(A, "0102-event-QuestionEnd.json"))).toMatchObject({
      index: 6,
      correct: null,
      points: null,
      correctChoices: null,
    })
  })

  it("reads the podium", () => {
    expect(toQuizEnd(load(A, "0108-event-Podium.json"))).toEqual({
      rank: 1,
      totalScore: 500,
      correctCount: 0,
      incorrectCount: 6,
    })
  })
})

describe("toKahootAnswer", () => {
  it("maps every answer kind to what kahoot.js expects", () => {
    expect(toKahootAnswer({ kind: "choice", index: 2 })).toBe(2)
    expect(toKahootAnswer({ kind: "choices", indices: [0, 2] })).toEqual([0, 2])
    expect(toKahootAnswer({ kind: "order", order: [1, 0, 3, 2] })).toEqual([1, 0, 3, 2])
    expect(toKahootAnswer({ kind: "number", value: 16 })).toBe(16)
    expect(toKahootAnswer({ kind: "text", value: "Paris" })).toBe("Paris")
    expect(toKahootAnswer({ kind: "none" })).toBeNull()
  })
})
