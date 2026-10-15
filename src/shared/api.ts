import type { JoinErrorCode } from "../core/kahoot/adapter.js"
import type { FallbackProviderId } from "../core/providers/fallback/ids.js"
import type { JoinOutcome, SessionEvent, SessionSettings } from "../core/session/game-session.js"
import type { Question } from "../core/types.js"

export type Timing = SessionSettings["timing"]
export type QuestionView = Omit<Question, "raw">
export type GameEvent =
  Exclude<SessionEvent, { type: "question" }> | { type: "question"; question: QuestionView }
export type KeyCheck = "ok" | "invalid" | "offline" | "error"

export interface PublicSettings {
  hasTypesafeKey: boolean
  timing: Timing
  includePrevious: boolean
  fallback: { provider: FallbackProviderId; webSearch: boolean; savedKeys: FallbackProviderId[] }
}

export interface FallbackSetup {
  provider: FallbackProviderId
  key: string
  webSearch: boolean
}

export interface StartRequest {
  pin: string
  names: string[]
  timing: Timing
  quizContext: string | null
  includePrevious: boolean
}

export type StartProblem = "pin" | "bots" | "name_empty" | "name_long" | "name_taken" | "timing"

export type StartResult =
  { ok: true } | { ok: false; error: StartProblem | JoinErrorCode; message: string }

export interface QuizPilotApi {
  getSettings(): Promise<PublicSettings>
  saveTypesafeKey(key: string): Promise<KeyCheck>
  startGame(request: StartRequest): Promise<StartResult>
  addBot(name: string): Promise<JoinOutcome>
  submitTwoStep(sequence: number[]): Promise<void>
  pause(bot: string | null, paused: boolean): Promise<void>
  leave(bot: string | null): Promise<void>
  endGame(): Promise<void>
  openExternal(url: string): Promise<void>
  onGameEvent(listener: (event: GameEvent) => void): () => void
}

export type Invokable = Exclude<keyof QuizPilotApi, "onGameEvent">

export const CHANNELS = {
  getSettings: "settings:get",
  saveTypesafeKey: "settings:typesafe-key",
  startGame: "game:start",
  addBot: "game:add-bot",
  submitTwoStep: "game:two-step",
  pause: "game:pause",
  leave: "game:leave",
  endGame: "game:end",
  openExternal: "app:open-external",
} as const satisfies Record<Invokable, string>

export const GAME_EVENT_CHANNEL = "game:event"
