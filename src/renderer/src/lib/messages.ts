import type { JoinErrorCode } from "../../../core/kahoot/adapter.js"
import type { BotStatus } from "../../../core/session/game-session.js"
import type { Decision, QuestionType } from "../../../core/types.js"
import type { KeyCheck, StartProblem } from "../../../shared/api.js"

export const STATUS_TEXT: Record<BotStatus, string> = {
  joining: "Joining",
  twoStep: "Waiting for code",
  lobby: "In lobby",
  playing: "Playing",
  paused: "Paused",
  left: "Left",
  kicked: "Removed by host",
  disconnected: "Disconnected",
  finished: "Finished",
}

export const ERROR_TEXT: Record<StartProblem | JoinErrorCode, string> = {
  pin: "Enter the game PIN or paste the kahoot.it link.",
  bots: "Use between 1 and 5 bots.",
  name_empty: "Every bot needs a name.",
  name_long: "Names can have at most 15 characters.",
  name_taken: "Every bot needs a different name.",
  timing: "Pick a delay between 0 and 30 seconds, the smaller number first.",
  not_found: "There's no game with this PIN.",
  locked: "The host has locked this game.",
  duplicate_name: "Someone in the game already has this name.",
  unknown: "Couldn't join the game.",
}

export const KEY_TEXT: Record<Exclude<KeyCheck, "ok">, string> = {
  invalid: "TypeSafe doesn't accept this key.",
  offline: "Couldn't reach TypeSafe. Check your connection.",
  error: "TypeSafe had a problem. Try again in a moment.",
}

export const TYPE_TEXT: Record<QuestionType, string> = {
  quiz: "Quiz",
  true_false: "True or false",
  multiple_select_quiz: "Multiple choice",
  jumble: "Puzzle",
  slider: "Slider",
  open_ended: "Type answer",
  survey: "Poll",
  word_cloud: "Word cloud",
  content: "Slide",
  unknown: "Unknown",
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function sourceText(decision: Decision): string {
  switch (decision.source) {
    case "jev":
      return decision.confidence === null ? "Jev" : `Jev · ${percent(decision.confidence)}`
    case "fallback":
      return decision.fallback?.model ?? "Fallback"
    case "quiz-link":
      return "Quiz link"
    case "random":
      return "Guessed"
    case "skip":
      return "Skipped"
  }
}
