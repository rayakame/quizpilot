import { describe, expect, it } from "vitest"
import { NO_CONTEXT } from "../../../../src/core/answer/context.js"
import type { FallbackInput } from "../../../../src/core/answer/engine.js"
import { buildRequest, parseAnswer } from "../../../../src/core/providers/fallback/request.js"
import type { Question } from "../../../../src/core/types.js"

const question = (over: Partial<Question> = {}): Question => ({
  index: 2,
  type: "quiz",
  title: "Hauptstadt der Schweiz?",
  choices: ["Zürich", "Bern", "Genf", "Basel"].map((text) => ({ text, image: null })),
  image: null,
  timeLimitMs: 20_000,
  raw: null,
  ...over,
})

const input = (over: Partial<FallbackInput> = {}): FallbackInput => ({
  question: question(),
  questionImage: null,
  optionImages: [null, null, null, null],
  context: NO_CONTEXT,
  jev: null,
  ...over,
})

const textOf = (i: FallbackInput, webSearch = false) => {
  const first = buildRequest(i, webSearch).parts[0]
  return first?.type === "text" ? first.text : ""
}

describe("buildRequest", () => {
  it("lists the options by number and asks for one of them", () => {
    const r = buildRequest(input(), false)
    expect(textOf(input())).toBe(
      [
        "Question 3: Hauptstadt der Schweiz?",
        "Options:",
        "1: Zürich",
        "2: Bern",
        "3: Genf",
        "4: Basel",
        'Exactly one option is correct. Put its number in "choice".',
      ].join("\n"),
    )
    expect(r.schema).toEqual({
      type: "object",
      properties: { choice: { type: "integer" }, confidence: { type: "number" } },
      required: ["choice", "confidence"],
      additionalProperties: false,
    })
    expect(r.system).not.toContain("search")
  })

  it("adds quiz context, earlier questions and Jev's guess", () => {
    const text = textOf(
      input({
        context: {
          quizContext: "TUM-Erstsemester-Quiz",
          previous: [
            { index: 0, title: "Fluss?", answer: "Isar", correct: true, correctAnswer: "Isar" },
          ],
        },
        jev: { answer: { kind: "choice", index: 2 }, confidence: 0.41, wantsFallback: true },
      }),
    )
    expect(text).toContain("Quiz context: TUM-Erstsemester-Quiz")
    expect(text).toContain("Earlier questions in this quiz:\nQ1: Fluss? → Isar ✓")
    expect(text).toContain("A quicker model suggested: Genf (41% sure)")
  })

  it("sends image answers as labeled pictures in order", () => {
    const a = new Uint8Array([1])
    const c = new Uint8Array([3])
    const q = question({
      title: "Welches Tier?",
      choices: [0, 1, 2].map(() => ({ text: null, image: { url: "https://media.kahoot.it/x" } })),
    })
    const r = buildRequest(
      input({ question: q, questionImage: a, optionImages: [null, null, c] }),
      false,
    )
    expect(textOf(input({ question: q, optionImages: [null, null, c] }))).toContain(
      "1: (no text)\n2: (no text)\n3: (picture 3, see below)",
    )
    expect(r.parts.slice(1)).toEqual([
      { type: "text", text: "Question image:" },
      { type: "image", jpeg: a },
      { type: "text", text: "Picture 3:" },
      { type: "image", jpeg: c },
    ])
  })

  it("asks for the right shape per question type", () => {
    const keys = (q: Question) =>
      Object.keys(
        (buildRequest(input({ question: q }), false).schema as { properties: object }).properties,
      )
    expect(keys(question({ type: "multiple_select_quiz" }))).toEqual(["choices", "confidence"])
    expect(keys(question({ type: "jumble" }))).toEqual(["order", "confidence"])
    expect(
      keys(question({ type: "slider", choices: [], slider: { min: 0, max: 10, step: 1 } })),
    ).toEqual(["value", "confidence"])
    expect(
      textOf(
        input({
          question: question({ type: "slider", choices: [], slider: { min: 0, max: 10, step: 1 } }),
        }),
      ),
    ).toContain("from 0 to 10 in steps of 1")
    expect(keys(question({ type: "open_ended", choices: [] }))).toEqual(["text", "confidence"])
    expect(() => buildRequest(input({ question: question({ type: "survey" }) }), false)).toThrow()
  })

  it("mentions web search only when it is allowed", () => {
    expect(buildRequest(input(), true).system).toContain("search the web once")
  })
})

describe("parseAnswer", () => {
  it("reads plain JSON and JSON wrapped in text", () => {
    expect(parseAnswer(question(), '{"choice":2,"confidence":0.8}')).toEqual({
      answer: { kind: "choice", index: 1 },
      confidence: 0.8,
    })
    expect(
      parseAnswer(question(), 'Sure!\n```json\n{"choice": 3, "confidence": 1.4}\n```').confidence,
    ).toBe(1)
  })

  it("rejects answers that don't fit the question", () => {
    expect(() => parseAnswer(question(), '{"choice":5,"confidence":0.9}')).toThrow()
    expect(() => parseAnswer(question(), '{"choice":0,"confidence":0.9}')).toThrow()
    expect(() => parseAnswer(question(), '{"choice":"1","confidence":0.9}')).toThrow()
    expect(() => parseAnswer(question(), "no idea")).toThrow()
    expect(() =>
      parseAnswer(question({ type: "jumble" }), '{"order":[1,1,2,3],"confidence":1}'),
    ).toThrow()
    expect(() =>
      parseAnswer(question({ type: "jumble" }), '{"order":[1,2,3],"confidence":1}'),
    ).toThrow()
    expect(() =>
      parseAnswer(question({ type: "multiple_select_quiz" }), '{"choices":[],"confidence":1}'),
    ).toThrow()
    expect(() =>
      parseAnswer(question({ type: "open_ended" }), '{"text":"  ","confidence":1}'),
    ).toThrow()
  })

  it("turns every question type into a Kahoot answer", () => {
    expect(
      parseAnswer(
        question({ type: "multiple_select_quiz" }),
        '{"choices":[4,2,4],"confidence":0.5}',
      ).answer,
    ).toEqual({
      kind: "choices",
      indices: [1, 3],
    })
    expect(
      parseAnswer(question({ type: "jumble" }), '{"order":[3,1,4,2],"confidence":null}'),
    ).toEqual({
      answer: { kind: "order", order: [2, 0, 3, 1] },
      confidence: null,
    })
    const slider = question({ type: "slider", choices: [], slider: { min: 0, max: 100, step: 5 } })
    expect(parseAnswer(slider, '{"value":47.2,"confidence":0.3}').answer).toEqual({
      kind: "number",
      value: 45,
    })
    expect(parseAnswer(slider, '{"value":470,"confidence":0.3}').answer).toEqual({
      kind: "number",
      value: 100,
    })
    expect(
      parseAnswer(
        question({ type: "open_ended", choices: [] }),
        '{"text":" Ludwig II von Bayern, König ","confidence":0.7}',
      ).answer,
    ).toEqual({
      kind: "text",
      value: "Ludwig II von Bayern",
    })
  })
})
