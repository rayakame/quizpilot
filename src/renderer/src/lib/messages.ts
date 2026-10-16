import type { JoinErrorCode } from "../../../core/kahoot/adapter.js"
import { PROVIDER_NAMES, type FallbackProviderId } from "../../../core/providers/fallback/ids.js"
import type { BotStatus } from "../../../core/session/game-session.js"
import type { Cost } from "../../../core/cost/prices.js"
import type { Decision, DecisionSource, QuestionType } from "../../../core/types.js"
import type { KeyCheck, QuizLinkProblem, StartProblem, Theme } from "../../../shared/api.js"
import type { LinkCheck } from "./start-form.js"

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

export function statusText(status: BotStatus, detail: string | null): string {
  return status === "joining" && detail === "reconnecting" ? "Reconnecting" : STATUS_TEXT[status]
}

export const THEME_TEXT: Record<Theme, string> = {
  system: "Like the system",
  light: "Light",
  dark: "Dark",
}

export const ERROR_TEXT: Record<StartProblem | JoinErrorCode, string> = {
  pin: "Enter the game PIN or paste the kahoot.it link.",
  bots: "Use between 1 and 5 bots.",
  name_empty: "Every bot needs a name.",
  name_long: "Names can have at most 15 characters.",
  name_taken: "Every bot needs a different name.",
  timing: "Pick a delay between 0 and 30 seconds, the smaller number first.",
  quiz_link: "Couldn't use this quiz link.",
  not_found: "There's no game with this PIN.",
  locked: "The host has locked this game.",
  duplicate_name: "Someone in the game already has this name.",
  unknown: "Couldn't join the game.",
}

export const QUIZ_LINK_TEXT: Record<QuizLinkProblem, string> = {
  link: "This doesn't look like a Kahoot quiz link.",
  not_found: "There's no quiz behind this link.",
  private: "This quiz is private. Only public quizzes work.",
  offline: "Couldn't reach Kahoot. Check your connection.",
  unknown: "Couldn't load the quiz.",
}

export function quizLinkText({ result }: LinkCheck): string {
  if (result === null) return "Checking…"
  if (!result.ok) return QUIZ_LINK_TEXT[result.error]
  return `${result.title} · ${result.questions} ${result.questions === 1 ? "question" : "questions"}`
}

export function keyText(problem: Exclude<KeyCheck, "ok">, service: string): string {
  switch (problem) {
    case "invalid":
      return `${service} doesn't accept this key.`
    case "offline":
      return `Couldn't reach ${service}. Check your connection.`
    case "error":
      return `${service} had a problem. Try again in a moment.`
  }
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
    case "fallback": {
      const id = decision.fallback?.provider as FallbackProviderId | undefined
      const name = (id && PROVIDER_NAMES[id]) ?? "Backup AI"
      const sure = decision.confidence === null ? [] : [percent(decision.confidence)]
      const ms = decision.fallback?.latencyMs
      const time = ms === undefined ? [] : [`${(ms / 1000).toFixed(1)} s`]
      return [name, ...sure, ...time].join(" · ")
    }
    case "quiz-link":
      return "Known answer"
    case "random":
      return "Guessed"
    case "skip":
      return "Skipped"
  }
}

const SOURCE_NAMES: [DecisionSource, string][] = [
  ["jev", "Jev"],
  ["fallback", "Backup AI"],
  ["quiz-link", "Known"],
  ["random", "Guessed"],
]

export function costText({ usd, complete }: Cost): string {
  const more = complete ? "" : " or more"
  if (usd === 0) return complete ? "$0" : "unknown"
  if (usd < 0.001) return `< $0.001${more}`
  return `≈ $${usd < 1 ? usd.toPrecision(2) : usd.toFixed(2)}${more}`
}

export function sourceCounts(sources: Partial<Record<DecisionSource, number>>): string {
  const parts = SOURCE_NAMES.flatMap(([id, name]) =>
    sources[id] ? [`${name} ${sources[id]}`] : [],
  )
  return parts.length > 0 ? parts.join(" · ") : "–"
}

export function secondsText(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`
}
