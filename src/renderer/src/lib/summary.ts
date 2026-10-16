import { costOf, type Cost } from "../../../core/cost/prices.js"
import type { DecisionSource, Usage } from "../../../core/types.js"
import { outcome, type GameState } from "./game-state.js"

export interface GameSummary {
  graded: number
  correct: number
  sources: Partial<Record<DecisionSource, number>>
  averageMs: number | null
  cost: Cost
}

export function gameSummary(state: GameState): GameSummary {
  let graded = 0
  let correct = 0
  const sources: GameSummary["sources"] = {}
  const times: number[] = []
  const usage: Usage[] = []
  for (const round of state.rounds) {
    if (round.question.type === "content") continue
    const result = outcome(round)
    if (result !== "open") graded += 1
    if (result === "right") correct += 1
    const d = round.decision
    if (d) {
      usage.push(...d.usage)
      if (d.source !== "skip") sources[d.source] = (sources[d.source] ?? 0) + 1
    }
    times.push(...Object.values(round.answeredMs))
  }
  const averageMs = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : null
  return { graded, correct, sources, averageMs, cost: costOf(usage) }
}
