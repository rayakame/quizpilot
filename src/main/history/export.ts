import { answerText, correctAnswer } from "../../core/answer/describe.js"
import type { Question } from "../../core/types.js"
import type { HistoryQuestion, HistoryRecord } from "../../shared/api.js"
import { questionOutcome } from "../../shared/history.js"

const HEADER = [
  "question",
  "type",
  "title",
  "answer",
  "correct_answer",
  "result",
  "source",
  "confidence",
  "average_ms",
  "cost_usd",
]

export function toJson(record: HistoryRecord): string {
  return JSON.stringify(record, null, 2) + "\n"
}

export function toCsv(record: HistoryRecord): string {
  const rows = record.questions.filter((h) => h.question.type !== "content").map(row)
  return [HEADER, ...rows].map((cells) => cells.map(cell).join(",")).join("\r\n") + "\r\n"
}

export function exportName(record: HistoryRecord): string {
  const day = new Date(record.game.startedAt).toISOString().slice(0, 10)
  const name = (record.game.quizTitle ?? record.game.pin)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return `quizpilot-${name || record.game.pin}-${day}`
}

function row(h: HistoryQuestion): (string | number | null)[] {
  const q: Question = { ...h.question, raw: null }
  const times = h.results.flatMap((r) => (r.answeredMs === null ? [] : [r.answeredMs]))
  return [
    q.index + 1,
    q.type,
    q.title,
    h.decision ? answerText(h.decision.answer, q) : null,
    h.correctChoices ? answerText(correctAnswer(q, h.correctChoices), q) : null,
    questionOutcome(h),
    h.decision?.source ?? null,
    h.decision?.confidence ?? null,
    times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
    h.costUsd === null ? null : Number(h.costUsd.toPrecision(3)),
  ]
}

function cell(value: string | number | null): string {
  if (value === null) return ""
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
