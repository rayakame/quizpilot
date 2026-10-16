import type { JoinErrorCode } from "../core/kahoot/adapter.js"
import type { QuizLoadProblem } from "../core/quiz-source/link.js"
import type { FallbackProviderId } from "../core/providers/fallback/ids.js"
import type { Effort, ModelChoice } from "../core/providers/fallback/models.js"
import type { JoinOutcome, SessionEvent, SessionSettings } from "../core/session/game-session.js"
import type { Decision, Question } from "../core/types.js"
import type { Language } from "./i18n/index.js"

export type Timing = SessionSettings["timing"]
export type QuestionView = Omit<Question, "raw">
export type GameNotice = "jev_key"
export type GameEvent =
  | Exclude<SessionEvent, { type: "question" }>
  | { type: "question"; question: QuestionView }
  | { type: "notice"; notice: GameNotice }
export interface HistoryGame {
  id: number
  pin: string
  quizTitle: string | null
  startedAt: number
  endedAt: number | null
  questions: number
  graded: number
  correct: number
  costUsd: number
  costComplete: boolean
}

export interface HistoryBot {
  name: string
  status: string | null
  totalScore: number | null
  rank: number | null
}

export interface HistoryResult {
  bot: string
  answeredMs: number | null
  correct: boolean | null
  points: number | null
}

export interface HistoryQuestion {
  question: QuestionView
  imagePath: string | null
  correctChoices: number[] | null
  decision: Decision | null
  costUsd: number | null
  results: HistoryResult[]
}

export interface HistoryRecord {
  game: HistoryGame & {
    context: string | null
    quizLink: string | null
    timing: Timing
    includePrevious: boolean
  }
  bots: HistoryBot[]
  questions: HistoryQuestion[]
}

export interface NewGame {
  pin: string
  quizTitle: string | null
  quizId: string | null
  context: string | null
  quizLink: string | null
  timing: Timing
  includePrevious: boolean
  startedAt: number
}

export type ExportResult = "saved" | "cancelled" | "missing"

export type KeyCheck = "ok" | "invalid" | "offline" | "error"
export type Theme = "system" | "light" | "dark"

export const THEMES: Theme[] = ["system", "light", "dark"]

export interface PublicSettings {
  hasTypesafeKey: boolean
  timing: Timing
  includePrevious: boolean
  reconnect: boolean
  notify: boolean
  theme: Theme
  language: Language
  saveHistory: boolean
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
  notify?: boolean
  theme?: Theme
  language?: Language
  fallbackBelow?: number
  imageInstantAt?: number
  saveHistory?: boolean
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
  quizLink: string | null
}

export type QuizLinkProblem = QuizLoadProblem

export type QuizCheck =
  { ok: true; title: string; questions: number } | { ok: false; error: QuizLinkProblem }

export type StartProblem =
  "pin" | "bots" | "name_empty" | "name_long" | "name_taken" | "timing" | "quiz_link"

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
  checkQuizLink(link: string): Promise<QuizCheck>
  startGame(request: StartRequest): Promise<StartResult>
  addBot(name: string): Promise<JoinOutcome>
  submitTwoStep(sequence: number[]): Promise<void>
  pause(bot: string | null, paused: boolean): Promise<void>
  leave(bot: string | null): Promise<void>
  endGame(): Promise<void>
  openExternal(url: string): Promise<void>
  listHistory(): Promise<HistoryGame[]>
  getHistory(id: number): Promise<HistoryRecord | null>
  deleteHistory(id: number): Promise<boolean>
  clearHistory(): Promise<boolean>
  exportHistory(id: number | null): Promise<ExportResult>
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
  checkQuizLink: "quiz:check",
  startGame: "game:start",
  addBot: "game:add-bot",
  submitTwoStep: "game:two-step",
  pause: "game:pause",
  leave: "game:leave",
  endGame: "game:end",
  openExternal: "app:open-external",
  listHistory: "history:list",
  getHistory: "history:get",
  deleteHistory: "history:delete",
  clearHistory: "history:clear",
  exportHistory: "history:export",
} as const satisfies Record<Invokable, string>

export const GAME_EVENT_CHANNEL = "game:event"
export const OPEN_SETTINGS_CHANNEL = "app:open-settings"
