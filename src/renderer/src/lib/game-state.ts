import { answerText } from "../../../core/answer/describe.js"
import type { JoinErrorCode } from "../../../core/kahoot/adapter.js"
import type { QuestionResult } from "../../../core/kahoot/normalize.js"
import type { BotStatus } from "../../../core/session/game-session.js"
import type { Decision } from "../../../core/types.js"
import type { GameEvent, QuestionView } from "../../../shared/api.js"

export interface BotView {
  name: string
  status: BotStatus
  detail: string | null
  joinError: JoinErrorCode | null
  totalScore: number
  rank: number | null
}

export interface RoundView {
  question: QuestionView
  decision: Decision | null
  results: Record<string, QuestionResult>
  answeredMs: Record<string, number>
}

export interface GameState {
  bots: BotView[]
  rounds: RoundView[]
  twoStep: "none" | "asking" | "wrong"
}

export interface ChoiceRow {
  index: number
  text: string | null
  image: string | null
  probability: number | null
  chosen: boolean
  position: number | null
  correct: boolean | null
}

export const EMPTY_GAME: GameState = { bots: [], rounds: [], twoStep: "none" }

const DONE: BotStatus[] = ["finished", "left", "kicked", "disconnected"]
const ACTIVE: BotStatus[] = ["lobby", "playing", "paused"]

export function reduce(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    case "status":
      return withBot(state, event.bot, (b) => ({
        ...b,
        status: event.status,
        detail: event.detail ?? null,
        joinError: event.status === "joining" ? null : b.joinError,
      }))
    case "joinFailed":
      return withBot(state, event.bot, (b) => ({
        ...b,
        joinError: event.code,
        detail: event.message,
      }))
    case "twoStepRequired":
      return { ...state, twoStep: "asking" }
    case "twoStepResult":
      return { ...state, twoStep: event.ok ? "none" : "wrong" }
    case "question": {
      const others = state.rounds.filter((r) => r.question.index !== event.question.index)
      const round: RoundView = {
        question: event.question,
        decision: null,
        results: {},
        answeredMs: {},
      }
      return { ...state, rounds: [...others, round] }
    }
    case "decision":
      return withRound(state, event.index, (r) => ({ ...r, decision: event.decision }))
    case "answered":
      return withRound(state, event.index, (r) => ({
        ...r,
        answeredMs: { ...r.answeredMs, [event.bot]: event.afterMs },
      }))
    case "result": {
      const { result } = event
      const scored = withBot(state, event.bot, (b) => ({
        ...b,
        totalScore: result.totalScore,
        rank: result.rank,
      }))
      const index = result.index ?? state.rounds.at(-1)?.question.index
      if (index === undefined) return scored
      return withRound(scored, index, (r) => ({
        ...r,
        results: { ...r.results, [event.bot]: result },
      }))
    }
    case "ended":
      return withBot(state, event.bot, (b) => ({
        ...b,
        totalScore: event.end.totalScore,
        rank: event.end.rank,
      }))
    case "gameReset":
      return {
        ...state,
        rounds: [],
        bots: state.bots.map((b) => ({ ...b, totalScore: 0, rank: null })),
      }
  }
}

export function removeBot(state: GameState, name: string): GameState {
  return { ...state, bots: state.bots.filter((b) => b.name !== name) }
}

export function currentRound(state: GameState): RoundView | null {
  return state.rounds.at(-1) ?? null
}

export function pastRounds(state: GameState): RoundView[] {
  return state.rounds.slice(0, -1).reverse()
}

export function isOver(state: GameState): boolean {
  const played = state.bots.filter((b) => b.joinError === null)
  return played.length > 0 && played.every((b) => DONE.includes(b.status))
}

export function canPause(bot: BotView): boolean {
  return ACTIVE.includes(bot.status)
}

export function canLeave(bot: BotView): boolean {
  return !DONE.includes(bot.status)
}

export function choiceRows(round: RoundView): ChoiceRow[] {
  const answer = round.decision?.answer
  const probabilities = round.decision?.jev?.probabilities
  const correct = Object.values(round.results).find((r) => r.correctChoices)?.correctChoices
  const ordered = round.question.type === "jumble"
  return round.question.choices.map((choice, index) => ({
    index,
    text: choice.text,
    image: choice.image?.url ?? null,
    probability: probabilities?.[index] ?? null,
    chosen:
      answer?.kind === "choice"
        ? answer.index === index
        : answer?.kind === "choices" && answer.indices.includes(index),
    position: answer?.kind === "order" ? answer.order.indexOf(index) + 1 || null : null,
    correct: correct && !ordered ? correct.includes(index) : null,
  }))
}

export function answerSummary(round: RoundView): string | null {
  if (!round.decision) return null
  return answerText(round.decision.answer, { ...round.question, raw: null })
}

export function outcome(round: RoundView): "right" | "wrong" | "mixed" | "open" {
  const marks = Object.values(round.results)
    .map((r) => r.correct)
    .filter((c) => c !== null)
  if (marks.length === 0) return "open"
  if (marks.every((c) => c)) return "right"
  return marks.some((c) => c) ? "mixed" : "wrong"
}

function withBot(state: GameState, name: string, change: (bot: BotView) => BotView): GameState {
  const known = state.bots.some((b) => b.name === name)
  const bots = known ? state.bots : [...state.bots, newBot(name)]
  return { ...state, bots: bots.map((b) => (b.name === name ? change(b) : b)) }
}

function withRound(
  state: GameState,
  index: number,
  change: (round: RoundView) => RoundView,
): GameState {
  const rounds = state.rounds.map((r) => (r.question.index === index ? change(r) : r))
  return { ...state, rounds }
}

function newBot(name: string): BotView {
  return { name, status: "joining", detail: null, joinError: null, totalScore: 0, rank: null }
}
