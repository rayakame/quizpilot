import { MAX_NAME_LENGTH } from "../core/names/names.js"
import { parseQuizLink } from "../core/quiz-source/link.js"
import { MAX_BOTS } from "../core/session/game-session.js"
import type { StartProblem, StartRequest, Timing } from "./api.js"

export const MAX_DELAY_MS = 30_000

export function parsePin(input: string): string | null {
  const text = input.trim()
  const pin = /[?&]pin=(\d+)/.exec(text)?.[1] ?? text.replace(/\s/g, "")
  return /^\d{4,10}$/.test(pin) ? pin : null
}

export function nameProblem(name: string, others: string[]): StartProblem | null {
  const trimmed = name.trim()
  if (!trimmed) return "name_empty"
  if (trimmed.length > MAX_NAME_LENGTH) return "name_long"
  if (others.some((o) => o.trim().toLowerCase() === trimmed.toLowerCase())) return "name_taken"
  return null
}

export function timingProblem(timing: Timing): StartProblem | null {
  if (timing.mode === "instant") return null
  const { minMs, maxMs } = timing
  const valid = [minMs, maxMs].every((ms) => Number.isInteger(ms) && ms >= 0 && ms <= MAX_DELAY_MS)
  return valid && minMs <= maxMs ? null : "timing"
}

export function startProblem(request: StartRequest): StartProblem | null {
  if (parsePin(request.pin) !== request.pin) return "pin"
  const names = request.names
  if (names.length === 0 || names.length > MAX_BOTS) return "bots"
  for (const [i, name] of names.entries()) {
    const problem = nameProblem(name, names.slice(0, i))
    if (problem) return problem
  }
  if (request.quizLink !== null && parseQuizLink(request.quizLink) === null) return "quiz_link"
  return timingProblem(request.timing)
}

/** The mistake rates the window offers. */
export const MISTAKE_STEPS = [0, 0.1, 0.2, 0.3]
export const MAX_MISTAKES = 0.5
