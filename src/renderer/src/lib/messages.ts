import { PROVIDER_NAMES, type FallbackProviderId } from "../../../core/providers/fallback/ids.js"
import type { BotStatus } from "../../../core/session/game-session.js"
import type { Cost } from "../../../core/cost/prices.js"
import type { Decision, DecisionSource } from "../../../core/types.js"
import type { KeyCheck } from "../../../shared/api.js"
import { t } from "./i18n.js"
import type { LinkCheck } from "./start-form.js"

export function statusText(status: BotStatus, detail: string | null): string {
  return status === "joining" && detail === "reconnecting"
    ? t.status.reconnecting
    : t.status[status]
}

export function quizLinkText({ result }: LinkCheck): string {
  if (result === null) return t.start.checking
  if (!result.ok) return t.quizLink[result.error]
  return `${result.title} · ${t.start.questions(result.questions)}`
}

export function keyText(problem: Exclude<KeyCheck, "ok">, service: string): string {
  return t.keys[problem](service)
}

export function percent(value: number): string {
  return new Intl.NumberFormat(t.locale, { style: "percent", maximumFractionDigits: 0 }).format(
    value,
  )
}

export function secondsText(ms: number): string {
  const seconds = new Intl.NumberFormat(t.locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  return t.common.inSeconds(seconds.format(ms / 1000))
}

export function dateText(ms: number): string {
  return new Intl.DateTimeFormat(t.locale, { dateStyle: "medium", timeStyle: "short" }).format(ms)
}

export function dayText(ms: number): string {
  return new Intl.DateTimeFormat(t.locale, { day: "numeric", month: "short" }).format(ms)
}

export function sourceText(decision: Decision): string {
  switch (decision.source) {
    case "jev":
      return decision.confidence === null ? "Jev" : `Jev · ${percent(decision.confidence)}`
    case "fallback": {
      const id = decision.fallback?.provider as FallbackProviderId | undefined
      const name = (id && PROVIDER_NAMES[id]) ?? t.sources.backupAi
      const sure = decision.confidence === null ? [] : [percent(decision.confidence)]
      const ms = decision.fallback?.latencyMs
      const time = ms === undefined ? [] : [secondsText(ms)]
      return [name, ...sure, ...time].join(" · ")
    }
    case "quiz-link":
      return t.sources.knownAnswer
    case "random":
      return t.sources.guessed
    case "skip":
      return t.sources.skipped
  }
}

function sourceName(source: DecisionSource): string {
  switch (source) {
    case "jev":
      return "Jev"
    case "fallback":
      return t.sources.backupAi
    case "quiz-link":
      return t.sources.known
    case "random":
      return t.sources.guessed
    case "skip":
      return t.sources.skipped
  }
}

const COUNTED: DecisionSource[] = ["jev", "fallback", "quiz-link", "random"]

export function sourceCounts(sources: Partial<Record<DecisionSource, number>>): string {
  const parts = COUNTED.flatMap((id) =>
    sources[id] ? [`${sourceName(id)}\u00a0${sources[id]}`] : [],
  )
  return parts.length > 0 ? parts.join(" · ") : "–"
}

function money(usd: number, digits = 2): string {
  const precision =
    usd === 0
      ? { maximumFractionDigits: 0 }
      : usd < 1
        ? { minimumSignificantDigits: digits, maximumSignificantDigits: digits }
        : { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  return new Intl.NumberFormat(t.locale, {
    style: "currency",
    currency: "USD",
    ...precision,
  }).format(usd)
}

export function costText({ usd, complete }: Cost): string {
  const more = complete ? "" : t.cost.orMore
  if (usd === 0) return complete ? money(0) : t.cost.unknown
  // A narrow column must not leave "≈" alone at the end of a line.
  if (usd < 0.001) return `<\u00a0${money(0.001, 1)}${more}`
  return `≈\u00a0${money(usd)}${more}`
}

export function mistakesText(rate: number): string {
  return rate === 0 ? t.mistakes.off : t.mistakes.about(percent(rate))
}
