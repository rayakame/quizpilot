import { Image, type RequestOptions, type SystemOneRequest } from "@typesafe-ai/sdk"
import { describe, expect, it } from "vitest"
import { NO_CONTEXT } from "../../../src/core/answer/context.js"
import { createJev, type JevInput, type SystemOne } from "../../../src/core/providers/jev.js"

type Sent = { request: SystemOneRequest; options?: RequestOptions }
type Q = { instructions: unknown; criteria: Record<string, unknown> | unknown[] }

function fake(answers: Record<string, unknown>) {
  const sent: Sent[] = []
  const client: SystemOne = {
    systemOne(request, options) {
      sent.push({ request, options })
      return Promise.resolve({
        model: "jev-test",
        answers,
        usage: { input_tokens: 120, output_tokens: 1 },
      }) as never
    },
  }
  return { jev: createJev(client), sent }
}

const signal = new AbortController().signal
const bytes = new Uint8Array([1, 2, 3])

const input = (over: Partial<JevInput> = {}): JevInput => ({
  question: "Hauptstadt der Schweiz",
  options: ["Zürich", "Bern", "Genf", "Basel"],
  questionImage: null,
  questionImageAlt: null,
  optionImages: [null, null, null, null],
  context: NO_CONTEXT,
  ...over,
})

const state = (s: Sent) => s.request.state as Record<string, unknown>
const question = (s: Sent, key: string) => s.request.questions[key] as unknown as Q

describe("chooseOne", () => {
  it("asks a choice over the option texts and maps the result", async () => {
    const { jev, sent } = fake({
      answer: {
        type: "choice",
        choice: "1",
        confidence: 0.97,
        probabilities: { "0": 0.02, "1": 0.97, "2": 0.01, "3": 0 },
      },
    })
    const r = await jev.chooseOne(input(), { signal })

    expect(r).toEqual({
      index: 1,
      confidence: 0.97,
      probabilities: [0.02, 0.97, 0.01, 0],
      usage: { provider: "typesafe", model: "jev-test", inputTokens: 120, outputTokens: 1 },
    })
    const s = sent[0]!
    expect(question(s, "answer").criteria).toEqual({
      "0": "Zürich",
      "1": "Bern",
      "2": "Genf",
      "3": "Basel",
    })
    expect(state(s)).toEqual({
      question: "Hauptstadt der Schweiz",
      options: ["Zürich", "Bern", "Genf", "Basel"],
    })
    expect(s.options?.headers).toBeUndefined()
    expect(s.options?.signal).toBe(signal)
  })

  it("works with two options", async () => {
    const { jev, sent } = fake({
      answer: { type: "choice", choice: "0", confidence: 0.8, probabilities: { "0": 0.8, "1": 0.2 } },
    })
    const r = await jev.chooseOne(input({ options: ["Wahr", "Falsch"], optionImages: [null, null] }), {
      signal,
    })
    expect(r.index).toBe(0)
    expect(Object.keys(question(sent[0]!, "answer").criteria)).toEqual(["0", "1"])
  })

  it("sends image-only options as images with the image header", async () => {
    const { jev, sent } = fake({
      answer: { type: "choice", choice: "0", confidence: 0.6, probabilities: { "0": 0.6, "1": 0.4 } },
    })
    await jev.chooseOne(input({ options: [null, null], optionImages: [bytes, bytes] }), { signal })
    const s = sent[0]!
    const criteria = question(s, "answer").criteria as Record<string, unknown>
    expect(criteria["0"]).toBeInstanceOf(Image)
    expect(state(s).options).toEqual(["(image)", "(image)"])
    expect(s.options?.headers).toEqual({ "TypeSafe-Danger-Zone-Images": "true" })
  })

  it("puts the question image and context into the state", async () => {
    const { jev, sent } = fake({
      answer: { type: "choice", choice: "0", confidence: 1, probabilities: { "0": 1 } },
    })
    await jev.chooseOne(
      input({
        options: ["Sylt"],
        optionImages: [null],
        questionImage: bytes,
        context: {
          quizContext: "TUM-Erstsemester-Quiz",
          previous: [
            {
              index: 0,
              title: "Fluss durch München?",
              answer: "Isar",
              correct: true,
              correctAnswer: "Isar",
            },
          ],
        },
      }),
      { signal },
    )
    const s = sent[0]!
    expect(state(s).image).toBeInstanceOf(Image)
    expect(state(s).quiz_context).toBe("TUM-Erstsemester-Quiz")
    expect(state(s).previous_questions).toEqual(["Q1: Fluss durch München? → Isar ✓"])
    expect(String(question(s, "answer").instructions)).toContain("`quiz_context`")
    expect(String(question(s, "answer").instructions)).toContain("`previous_questions`")
  })

  it("describes the question image when Kahoot provides alt text", async () => {
    const { jev, sent } = fake({
      answer: { type: "choice", choice: "2", confidence: 0.9, probabilities: { "2": 0.9 } },
    })
    await jev.chooseOne(input({ questionImageAlt: "Paris skyline with Eiffel Tower" }), { signal })
    const s = sent[0]!
    expect(state(s).image_description).toBe("Paris skyline with Eiffel Tower")
    expect(String(question(s, "answer").instructions)).toContain("`image_description`")
  })

  it("rejects labels outside the options", async () => {
    const { jev } = fake({
      answer: { type: "choice", choice: "7", confidence: 0.9, probabilities: { "7": 0.9 } },
    })
    await expect(jev.chooseOne(input(), { signal })).rejects.toThrow("unknown option")
  })
})

describe("checkEach", () => {
  it("asks one yes/no question per option", async () => {
    const { jev, sent } = fake({
      o0: { type: "noul", noul: 0.9 },
      o1: { type: "noul", noul: 0.1 },
      o2: { type: "noul", noul: 0.7 },
      o3: { type: "noul", noul: 0.2 },
    })
    const r = await jev.checkEach(input(), { signal })
    expect(r.probabilities).toEqual([0.9, 0.1, 0.7, 0.2])
    expect(Object.keys(sent[0]!.request.questions)).toEqual(["o0", "o1", "o2", "o3"])
    expect(String(question(sent[0]!, "o1").instructions)).toContain('"Bern"')
  })
})

describe("placeEach", () => {
  it("scores each option on positions 1..n", async () => {
    const { jev, sent } = fake({
      o0: { type: "score", score: 2.1, confidence: 0.8 },
      o1: { type: "score", score: 0.2, confidence: 0.9 },
      o2: { type: "score", score: 3, confidence: 0.9 },
      o3: { type: "score", score: 1.1, confidence: 0.7 },
    })
    const r = await jev.placeEach(input(), { signal })
    expect(r.positions).toEqual([2.1, 0.2, 3, 1.1])
    expect(question(sent[0]!, "o0").criteria).toHaveLength(4)
  })
})

describe("estimateNumber", () => {
  it("maps the expected bin to the center of its range", async () => {
    const { jev, sent } = fake({ answer: { type: "score", score: 4.5, confidence: 0.4 } })
    const r = await jev.estimateNumber(
      input({ options: [], optionImages: [] }),
      { min: 0, max: 100, step: 1 },
      { signal },
    )
    expect(r.value).toBe(50)
    expect(r.confidence).toBe(0.4)
    const levels = question(sent[0]!, "answer").criteria as string[]
    expect(levels).toHaveLength(10)
    expect(levels[0]).toBe("between 0 and 10")
  })
})
