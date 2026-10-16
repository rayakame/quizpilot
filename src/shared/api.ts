import type { JoinErrorCode } from "../core/kahoot/adapter.js"
import type { FallbackProviderId } from "../core/providers/fallback/ids.js"
import type { Effort, ModelChoice } from "../core/providers/fallback/models.js"
import type { JoinOutcome, SessionEvent, SessionSettings } from "../core/session/game-session.js"
import type { Question } from "../core/types.js"

export type Timing = SessionSettings["timing"]
export type QuestionView = Omit<Question, "raw">
export type GameEvent =
  Exclude<SessionEvent, { type: "question" }> | { type: "question"; question: QuestionView }
export type KeyCheck = "ok" | "invalid" | "offline" | "error"
export type Theme = "system" | "light" | "dark"

export const THEMES: Theme[] = ["system", "light", "dark"]

export interface PublicSettings {
  hasTypesafeKey: boolean
  timing: Timing
  includePrevious: boolean
  reconnect: boolean
  theme: Theme
  fallback: {
    provider: FallbackProviderId
    webSearch: boolean
    below: number
    imageInstantAt: number
    savedKeys: FallbackProviderId[]
    choices: Record<FallbackProviderId, ModelChoice>
  }
}

export interface FallbackSetup {
  provider: FallbackProviderId
  key: string
  webSearch: boolean
  model: string
  effort: Effort | null
}

export interface SettingsPatch {
  timing?: Timing
  includePrevious?: boolean
  reconnect?: boolean
  theme?: Theme
  fallbackBelow?: number
  imageInstantAt?: number
}

export interface AppInfo {
  version: string
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
  readonly platform: string
  getSettings(): Promise<PublicSettings>
  saveSettings(patch: SettingsPatch): Promise<PublicSettings>
  getAppInfo(): Promise<AppInfo>
  saveTypesafeKey(key: string): Promise<KeyCheck>
  saveFallback(setup: FallbackSetup): Promise<KeyCheck>
  removeFallback(): Promise<void>
  startGame(request: StartRequest): Promise<StartResult>
  addBot(name: string): Promise<JoinOutcome>
  submitTwoStep(sequence: number[]): Promise<void>
  pause(bot: string | null, paused: boolean): Promise<void>
  leave(bot: string | null): Promise<void>
  endGame(): Promise<void>
  openExternal(url: string): Promise<void>
  onGameEvent(listener: (event: GameEvent) => void): () => void
  onOpenSettings(listener: () => void): () => void
}

export type Invokable = Exclude<keyof QuizPilotApi, "platform" | "onGameEvent" | "onOpenSettings">

export const CHANNELS = {
  getSettings: "settings:get",
  saveSettings: "settings:save",
  getAppInfo: "app:info",
  saveTypesafeKey: "settings:typesafe-key",
  saveFallback: "settings:fallback",
  removeFallback: "settings:fallback-remove",
  startGame: "game:start",
  addBot: "game:add-bot",
  submitTwoStep: "game:two-step",
  pause: "game:pause",
  leave: "game:leave",
  endGame: "game:end",
  openExternal: "app:open-external",
} as const satisfies Record<Invokable, string>

export const GAME_EVENT_CHANNEL = "game:event"
export const OPEN_SETTINGS_CHANNEL = "app:open-settings"
