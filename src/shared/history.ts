import type { HistoryQuestion } from "./api.js"

export function questionOutcome(q: HistoryQuestion): "right" | "wrong" | "mixed" | "open" {
  const marks = q.results.map((r) => r.correct).filter((c) => c !== null)
  if (marks.length === 0) return "open"
  if (marks.every((c) => c)) return "right"
  return marks.some((c) => c) ? "mixed" : "wrong"
}
