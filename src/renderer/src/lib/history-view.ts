import type { HistoryGame, HistoryQuestion } from "../../../shared/api.js"
import { questionOutcome } from "../../../shared/history.js"
import { t } from "./i18n.js"
import { costText, DOT } from "./messages.js"

export type HistoryFilter = "all" | "wrong" | "unsure" | "image"

export const HISTORY_FILTERS: HistoryFilter[] = ["all", "wrong", "unsure", "image"]

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
  return g.quizTitle ?? t.history.game(g.pin)
}

export function gameLine(g: HistoryGame): string {
  const cost = costText({ usd: g.costUsd, complete: g.costComplete })
  return `${t.history.right(g.correct, g.graded)}${DOT}${cost}`
}
