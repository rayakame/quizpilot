import type { HistoryGame, HistoryQuestion } from "../../../shared/api.js"
import { questionOutcome } from "../../../shared/history.js"
import { costText } from "./messages.js"

export type HistoryFilter = "all" | "wrong" | "unsure" | "image"

export const FILTERS: { id: HistoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "wrong", label: "Wrong" },
  { id: "unsure", label: "Unsure" },
  { id: "image", label: "Pictures" },
]

export function matches(q: HistoryQuestion, filter: HistoryFilter, below: number): boolean {
  switch (filter) {
    case "all":
      return true
    case "wrong": {
      const result = questionOutcome(q)
      return result === "wrong" || result === "mixed"
    }
    case "unsure": {
      const d = q.decision
      if (!d) return false
      return d.source === "random" || (d.confidence !== null && d.confidence < below)
    }
    case "image":
      return q.question.image !== null || q.question.choices.some((c) => c.image !== null)
  }
}

export function gameTitle(g: HistoryGame): string {
  return g.quizTitle ?? `Game ${g.pin}`
}

export function gameLine(g: HistoryGame): string {
  return `${g.correct} of ${g.graded} right · ${costText({ usd: g.costUsd, complete: g.costComplete })}`
}
