import { describe, expect, it } from "vitest"
import type { QuizStartInfo } from "../../../src/core/kahoot/normalize.js"
import { AnswerKey } from "../../../src/core/quiz-source/answer-key.js"
import type { KnownQuestion } from "../../../src/core/quiz-source/link.js"
import type { Question } from "../../../src/core/types.js"

const MEDIA = "https://media.kahoot.it/"
const KEEPS_ORDER: QuizStartInfo = { randomQuestions: false, randomAnswers: false, first: null }
const SHUFFLES: QuizStartInfo = { randomQuestions: true, randomAnswers: true, first: null }

const known = (over: KnownQuestion = {}): KnownQuestion => ({
  type: "quiz",
  layout: "CLASSIC",
  question: "Hauptstadt der Schweiz?",
  time: 20000,
  choices: [
    { answer: "Zürich", correct: false },
    { answer: "Bern", correct: true },
    { answer: "Genf", correct: false },
    { answer: "Basel", correct: false },
  ],
  ...over,
})

const live = (over: Partial<Question> = {}): Question => ({
  index: 0,
  type: "quiz",
  title: "Hauptstadt der Schweiz?",
  choices: ["Zürich", "Bern", "Genf", "Basel"].map((text) => ({ text, image: null })),
  image: null,
  timeLimitMs: 20000,
  raw: null,
  ...over,
})

const hidden = (n: number) => Array.from({ length: n }, () => ({ text: null, image: null }))

function key(questions: KnownQuestion[], info: QuizStartInfo | null = KEEPS_ORDER) {
  const k = new AnswerKey(questions)
  if (info) k.start(info)
  return k
}

describe("AnswerKey: finding the question", () => {
  it("answers a question it knows by its title", () => {
    expect(key([known()]).answerFor(live())).toEqual({ kind: "choice", index: 1 })
  })

  it("matches titles despite HTML, entities, case and spacing", () => {
    const k = key([known({ question: "<b>Hauptstadt</b>&nbsp;der  SCHWEIZ?" })])
    expect(k.answerFor(live())).toEqual({ kind: "choice", index: 1 })
  })

  it("finds the question when the host shuffled the questions", () => {
    const k = key([known({ question: "Andere Frage?" }), known()], SHUFFLES)
    expect(k.answerFor(live({ index: 0 }))).toEqual({ kind: "choice", index: 1 })
  })

  it("takes the one at the same position when two questions share a title", () => {
    const genf = ["Zürich", "Bern", "Genf", "Basel"].map((answer) => ({
      answer,
      correct: answer === "Genf",
    }))
    const k = key([known({ choices: genf }), known()])
    expect(k.answerFor(live({ index: 1 }))).toEqual({ kind: "choice", index: 1 })
    expect(k.answerFor(live({ index: 0 }))).toEqual({ kind: "choice", index: 2 })
    expect(k.answerFor(live({ index: 5 }))).toBeNull()
  })

  it("gives up when the title is not in the quiz", () => {
    expect(key([known()]).answerFor(live({ title: "Wer malte die Mona Lisa?" }))).toBeNull()
  })

  it("uses the position when the questions are hidden and the host keeps the order", () => {
    const q = live({ index: 1, title: null, choices: hidden(4) })
    expect(key([known({ question: "Erste" }), known()]).answerFor(q)).toEqual({
      kind: "choice",
      index: 1,
    })
  })

  it("ignores a question at the same position when its time or type differs", () => {
    const q = live({ title: null, choices: hidden(4) })
    expect(key([known({ time: 30000 })]).answerFor(q)).toBeNull()
    expect(key([known({ type: "multiple_select_quiz" })]).answerFor(q)).toBeNull()
    expect(key([known()]).answerFor({ ...q, choices: hidden(2) })).toBeNull()
  })

  it("never uses the position when the host shuffles the questions", () => {
    const q = live({ title: null, choices: hidden(4) })
    expect(key([known()], { ...KEEPS_ORDER, randomQuestions: true }).answerFor(q)).toBeNull()
  })

  it("treats unknown game options like shuffled ones", () => {
    const q = live({ title: null, choices: hidden(4) })
    expect(key([known()], null).answerFor(q)).toBeNull()
    expect(key([known()], null).answerFor(live())).toEqual({ kind: "choice", index: 1 })
  })

  it("knows the first question Kahoot sends at the start", () => {
    const k = key([], { ...KEEPS_ORDER, first: known() })
    expect(k.answerFor(live({ title: null, choices: hidden(4) }))).toEqual({
      kind: "choice",
      index: 1,
    })
    expect(k.answerFor(live({ index: 1, title: null, choices: hidden(4) }))).toBeNull()
  })

  it("forgets the old game's first question when a new game starts", () => {
    const k = key([], { ...KEEPS_ORDER, first: known() })
    k.start({ ...KEEPS_ORDER, first: known({ question: "Neue Frage?" }) })
    expect(k.answerFor(live())).toBeNull()
  })
})

describe("AnswerKey: choosing the answer", () => {
  it("finds the right answer by its text when the host shuffles the answers", () => {
    const q = live({
      choices: ["Basel", "Genf", "Bern", "Zürich"].map((text) => ({ text, image: null })),
    })
    expect(key([known()], SHUFFLES).answerFor(q)).toEqual({ kind: "choice", index: 2 })
  })

  it("finds image answers by their picture", () => {
    const choices = [
      { image: { id: "cat" }, correct: false },
      { image: { id: "dog" }, correct: true },
    ]
    const q = live({
      choices: [
        { text: null, image: { url: MEDIA + "dog" } },
        { text: null, image: { url: MEDIA + "cat" } },
      ],
    })
    expect(key([known({ choices })], SHUFFLES).answerFor(q)).toEqual({ kind: "choice", index: 0 })
  })

  it("does not trust positions of hidden answers when the host shuffles them", () => {
    const q = live({ title: null, choices: hidden(4) })
    expect(key([known()], { ...KEEPS_ORDER, randomAnswers: true }).answerFor(q)).toBeNull()
  })

  it("picks every right answer of a multiple select question", () => {
    const choices = [
      { answer: "2", correct: true },
      { answer: "4", correct: false },
      { answer: "5", correct: true },
      { answer: "9", correct: false },
    ]
    const q = live({
      type: "multiple_select_quiz",
      choices: ["9", "5", "4", "2"].map((text) => ({ text, image: null })),
    })
    expect(key([known({ type: "multiple_select_quiz", choices })], SHUFFLES).answerFor(q)).toEqual({
      kind: "choices",
      indices: [3, 1],
    })
  })

  it("puts puzzle pieces in the right order by their texts", () => {
    const choices = ["Maus", "Katze", "Pferd", "Elefant"].map((answer) => ({
      answer,
      correct: false,
    }))
    const q = live({
      type: "jumble",
      choices: ["Elefant", "Pferd", "Maus", "Katze"].map((text) => ({ text, image: null })),
    })
    expect(key([known({ type: "jumble", choices })]).answerFor(q)).toEqual({
      kind: "order",
      order: [2, 3, 1, 0],
    })
  })

  it("cannot order hidden puzzle pieces because Kahoot shuffles them", () => {
    const choices = ["Maus", "Katze"].map((answer) => ({ answer, correct: false }))
    const q = live({ type: "jumble", title: null, choices: hidden(2) })
    expect(key([known({ type: "jumble", choices })]).answerFor(q)).toBeNull()
  })

  it("answers a slider with the right number", () => {
    const k = key([
      known({
        type: "slider",
        choices: undefined,
        choiceRange: { start: 2010, end: 2024, step: 1, correct: 2014 },
      }),
    ])
    expect(k.answerFor(live({ type: "slider", choices: [] }))).toEqual({
      kind: "number",
      value: 2014,
    })
  })

  it("types the first accepted answer of an open question", () => {
    const k = key([
      known({
        type: "open_ended",
        choices: [
          { answer: "<i>WiFi</i>", correct: true },
          { answer: "Wi-Fi", correct: true },
        ],
      }),
    ])
    expect(k.answerFor(live({ type: "open_ended", choices: [] }))).toEqual({
      kind: "text",
      value: "WiFi",
    })
  })

  it("leaves polls and word clouds to the engine", () => {
    const poll = known({ type: "survey", choices: [{ answer: "Ja", correct: false }] })
    expect(
      key([poll]).answerFor(live({ type: "survey", choices: [{ text: "Ja", image: null }] })),
    ).toBeNull()
    expect(
      key([known({ type: "word_cloud", choices: [] })]).answerFor(
        live({ type: "word_cloud", choices: [] }),
      ),
    ).toBeNull()
  })
})

describe("AnswerKey: guarding against the wrong quiz", () => {
  const genf = ["Zürich", "Bern", "Genf", "Basel"].map((answer) => ({
    answer,
    correct: answer === "Genf",
  }))

  it("trusts Kahoot's own first question over the link", () => {
    const k = key([known({ choices: genf })], { ...KEEPS_ORDER, first: known() })
    expect(k.answerFor(live({ title: null, choices: hidden(4) }))).toEqual({
      kind: "choice",
      index: 1,
    })
    expect(k.answerFor(live())).toEqual({ kind: "choice", index: 1 })
  })

  it("drops a link whose quiz does not contain the first question", () => {
    const link = [known({ question: "Andere Frage?" }), known({ question: "Noch eine?" })]
    const k = key(link, { ...KEEPS_ORDER, first: known() })
    expect(k.answerFor(live({ index: 1, title: null, choices: hidden(4) }))).toBeNull()
    expect(k.answerFor(live({ index: 1, title: "Noch eine?" }))).toBeNull()
  })

  it("keeps a dropped link dropped when the quiz start arrives again without data", () => {
    const k = key([known({ question: "Andere Frage?" })], { ...KEEPS_ORDER, first: known() })
    k.start(KEEPS_ORDER)
    expect(k.answerFor(live({ title: "Andere Frage?" }))).toBeNull()
  })

  it("does not pick between same-titled questions by position when the host shuffles them", () => {
    const k = key([known(), known({ choices: genf })], SHUFFLES)
    expect(k.answerFor(live({ index: 0 }))).toBeNull()
  })

  it("answers same-titled questions that share the answer", () => {
    const k = key([known(), known()], SHUFFLES)
    expect(k.answerFor(live({ index: 5 }))).toEqual({ kind: "choice", index: 1 })
  })

  it("ignores a same-titled question whose answers differ from the game's", () => {
    const q = live({
      choices: ["Bern", "Wien", "Prag", "Rom"].map((text) => ({ text, image: null })),
    })
    expect(key([known()]).answerFor(q)).toBeNull()
  })
})
