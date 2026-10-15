import type { Answer, Choice, Question, QuestionType } from "../types.js"
import { cleanText } from "./text.js"

export type KahootPayload = Record<string, unknown>

export interface QuestionResult {
  index: number | null
  correct: boolean | null
  points: number | null
  totalScore: number
  rank: number
  correctChoices: number[] | null
  answerText: string | null
}

export interface QuizEnd {
  rank: number
  totalScore: number
  correctCount: number | null
  incorrectCount: number | null
}

const MEDIA = "https://media.kahoot.it/"

const TYPES: Record<string, QuestionType> = {
  quiz: "quiz",
  multiple_select_quiz: "multiple_select_quiz",
  jumble: "jumble",
  slider: "slider",
  open_ended: "open_ended",
  survey: "survey",
  multiple_select_poll: "survey",
  word_cloud: "word_cloud",
  content: "content",
}

export function toQuestion(p: KahootPayload): Question {
  let type = TYPES[str(p.gameBlockType) ?? str(p.type) ?? ""] ?? "unknown"
  if (type === "quiz" && p.layout === "TRUE_FALSE") type = "true_false"
  return {
    index: num(p.questionIndex) ?? num(p.gameBlockIndex) ?? 0,
    type,
    title: cleanText(p.title),
    choices: toChoices(p),
    image: str(p.image) ? { url: p.image as string } : null,
    imageAlt: cleanText(obj(p.imageMetadata)?.altText),
    timeLimitMs: num(p.timeAvailable) ?? 0,
    raw: p,
  }
}

export function toUpcoming(p: KahootPayload): { question: Question; startsInMs: number } {
  return { question: toQuestion(p), startsInMs: num(p.getReadyTimeRemaining) ?? 0 }
}

export function toResult(p: KahootPayload): QuestionResult {
  const correctChoices = Array.isArray(p.correctChoices)
    ? p.correctChoices.filter((c): c is number => typeof c === "number")
    : null
  return {
    index: num(obj(p.pointsData)?.lastGameBlockIndex),
    correct: correctChoices ? p.isCorrect === true : null,
    points: num(p.points),
    totalScore: num(p.totalScore) ?? 0,
    rank: num(p.rank) ?? 0,
    correctChoices,
    answerText: cleanText(p.text),
  }
}

export function toQuizEnd(p: KahootPayload): QuizEnd {
  return {
    rank: num(p.rank) ?? 0,
    totalScore: num(p.totalScore) ?? 0,
    correctCount: num(p.correctCount),
    incorrectCount: num(p.incorrectCount),
  }
}

export function toKahootAnswer(answer: Answer): number | number[] | string | null {
  switch (answer.kind) {
    case "choice":
      return answer.index
    case "choices":
      return answer.indices
    case "order":
      return answer.order
    case "number":
      return answer.value
    case "text":
      return answer.value
    case "none":
      return null
  }
}

function toChoices(p: KahootPayload): Choice[] {
  if (Array.isArray(p.choices)) {
    return p.choices.map((c) => {
      const choice = obj(c)
      const id = str(obj(choice?.image)?.id)
      return { text: cleanText(choice?.answer), image: id ? { url: MEDIA + id } : null }
    })
  }
  return Array.from({ length: num(p.numberOfChoices) ?? 0 }, () => ({ text: null, image: null }))
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

function str(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null
}

function obj(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" ? (v as Record<string, unknown>) : null
}
