import { MODELS } from "../../../core/providers/fallback/models.js"
import { LANGUAGE_NAMES } from "../../../shared/i18n/index.js"
import type { HistoryGame, PublicSettings, Timing } from "../../../shared/api.js"
import { t } from "./i18n.js"
import { mistakesText } from "./messages.js"

export const SETTINGS_SECTIONS = [
  "keys",
  "backup",
  "behavior",
  "history",
  "appearance",
  "about",
] as const

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

export interface SetupRow {
  id: string
  label: string
  value: string
  section: SettingsSection
}

function answersText({ fallback }: PublicSettings): string {
  if (!fallback.savedKeys.includes(fallback.provider)) return t.home.jevOnly
  const { model } = fallback.choices[fallback.provider]
  const name = MODELS[fallback.provider].find((m) => m.id === model)?.name ?? model
  return t.home.jevWith(name)
}

function timingText({ mode, minMs, maxMs }: Timing): string {
  if (mode === "instant") return t.home.instant
  const seconds = new Intl.NumberFormat(t.locale, { maximumFractionDigits: 1 })
  return t.home.human(`${seconds.format(minMs / 1000)}–${seconds.format(maxMs / 1000)} s`)
}

export function setupRows(s: PublicSettings): SetupRow[] {
  const rows = t.home.rows
  return [
    { id: "answers", label: rows.answers, value: answersText(s), section: "backup" },
    { id: "timing", label: rows.timing, value: timingText(s.timing), section: "behavior" },
    { id: "mistakes", label: rows.mistakes, value: mistakesText(s.mistakes), section: "behavior" },
    {
      id: "history",
      label: rows.history,
      value: s.saveHistory ? t.home.saved : t.home.off,
      section: "history",
    },
    {
      id: "language",
      label: rows.language,
      value: LANGUAGE_NAMES[s.language],
      section: "appearance",
    },
  ]
}

export function recentGames(games: HistoryGame[], n = 4): HistoryGame[] {
  return games.slice(0, n)
}
