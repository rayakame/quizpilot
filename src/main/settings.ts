import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { FALLBACK_PROVIDERS, type FallbackProviderId } from "../core/providers/fallback/ids.js"
import { resolveChoice, type ModelChoice } from "../core/providers/fallback/models.js"
import {
  THEMES,
  type PublicSettings,
  type SettingsPatch,
  type Theme,
  type Timing,
} from "../shared/api.js"
import { LANGUAGES, type Language } from "../shared/i18n/index.js"
import { MAX_DELAY_MS, MAX_MISTAKES, timingProblem } from "../shared/start.js"

export interface Config {
  version: 1
  keys: { typesafe: string; anthropic: string; openai: string; gemini: string }
  fallback: {
    provider: FallbackProviderId
    models: Record<string, string>
    efforts: Record<string, string>
    below: number
    imageInstantAt: number
    webSearch: boolean
  }
  context: { includePrevious: boolean }
  behavior: { timing: Timing; reconnect: boolean; notify: boolean; mistakes: number }
  ui: { language: Language; theme: Theme }
  history: { enabled: boolean }
}

export const DEFAULT_CONFIG: Config = {
  version: 1,
  keys: { typesafe: "", anthropic: "", openai: "", gemini: "" },
  fallback: {
    provider: "anthropic",
    models: {},
    efforts: {},
    below: 0.6,
    imageInstantAt: 0.9,
    webSearch: true,
  },
  context: { includePrevious: true },
  behavior: {
    timing: { mode: "instant", minMs: 1000, maxMs: 5000 },
    reconnect: true,
    notify: true,
    mistakes: 0,
  },
  ui: { language: "en", theme: "system" },
  history: { enabled: true },
}

export type LoadResult = { ok: true; config: Config } | { ok: false; error: string }

export function freshConfig(language: Language): Config {
  const config = structuredClone(DEFAULT_CONFIG)
  config.ui.language = language
  return config
}

export async function loadConfig(
  file: string,
  fresh: () => Config = () => structuredClone(DEFAULT_CONFIG),
): Promise<LoadResult> {
  let text: string
  try {
    text = await readFile(file, "utf8")
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: true, config: fresh() }
    }
    return { ok: false, error: String(err) }
  }
  try {
    return { ok: true, config: parseConfig(JSON.parse(text)) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function saveConfig(file: string, config: Config): Promise<void> {
  const tmp = `${file}.tmp`
  await mkdir(dirname(file), { recursive: true })
  await writeFile(tmp, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 })
  await chmod(tmp, 0o600)
  await rename(tmp, file)
}

export function parseConfig(raw: unknown): Config {
  if (!isObject(raw)) throw new Error("Settings are not a JSON object")
  if (raw.version !== 1) throw new Error(`Unknown settings version: ${String(raw.version)}`)
  const d = DEFAULT_CONFIG
  const keys = obj(raw.keys)
  const fallback = obj(raw.fallback)
  const context = obj(raw.context)
  const behavior = obj(raw.behavior)
  const ui = obj(raw.ui)
  const history = obj(raw.history)
  return {
    version: 1,
    keys: {
      typesafe: str(keys.typesafe, d.keys.typesafe),
      anthropic: str(keys.anthropic, d.keys.anthropic),
      openai: str(keys.openai, d.keys.openai),
      gemini: str(keys.gemini, d.keys.gemini),
    },
    fallback: {
      provider: oneOf(fallback.provider, FALLBACK_PROVIDERS, d.fallback.provider),
      models: strings(fallback.models),
      efforts: strings(fallback.efforts),
      below: num(fallback.below, d.fallback.below, 0, 1),
      imageInstantAt: num(fallback.imageInstantAt, d.fallback.imageInstantAt, 0, 1),
      webSearch: bool(fallback.webSearch, d.fallback.webSearch),
    },
    context: { includePrevious: bool(context.includePrevious, d.context.includePrevious) },
    behavior: {
      timing: timing(behavior.timing) ?? { ...d.behavior.timing },
      reconnect: bool(behavior.reconnect, d.behavior.reconnect),
      notify: bool(behavior.notify, d.behavior.notify),
      mistakes: num(behavior.mistakes, d.behavior.mistakes, 0, MAX_MISTAKES),
    },
    ui: {
      language: oneOf(ui.language, LANGUAGES, d.ui.language),
      theme: oneOf(ui.theme, THEMES, d.ui.theme),
    },
    history: { enabled: bool(history.enabled, d.history.enabled) },
  }
}

export function toPublic(config: Config): PublicSettings {
  return {
    hasTypesafeKey: config.keys.typesafe !== "",
    timing: config.behavior.timing,
    includePrevious: config.context.includePrevious,
    reconnect: config.behavior.reconnect,
    notify: config.behavior.notify,
    mistakes: config.behavior.mistakes,
    theme: config.ui.theme,
    language: config.ui.language,
    saveHistory: config.history.enabled,
    fallback: {
      provider: config.fallback.provider,
      webSearch: config.fallback.webSearch,
      below: config.fallback.below,
      imageInstantAt: config.fallback.imageInstantAt,
      savedKeys: FALLBACK_PROVIDERS.filter((p) => config.keys[p] !== ""),
      choices: Object.fromEntries(
        FALLBACK_PROVIDERS.map((p) => [p, choiceFor(config, p)]),
      ) as Record<FallbackProviderId, ModelChoice>,
    },
  }
}

export function applyPatch(config: Config, patch: SettingsPatch): Config {
  const next = structuredClone(config)
  const { timing, reconnect, includePrevious, theme, fallbackBelow, imageInstantAt } = patch
  // The delay range is kept even in instant mode, so check it like human mode.
  if (timing && timingProblem({ ...timing, mode: "human" }) === null) {
    next.behavior.timing = {
      mode: timing.mode === "human" ? "human" : "instant",
      minMs: timing.minMs,
      maxMs: timing.maxMs,
    }
  }
  if (typeof reconnect === "boolean") next.behavior.reconnect = reconnect
  if (typeof patch.notify === "boolean") next.behavior.notify = patch.notify
  const { mistakes } = patch
  if (typeof mistakes === "number" && mistakes >= 0 && mistakes <= MAX_MISTAKES) {
    next.behavior.mistakes = mistakes
  }
  if (typeof includePrevious === "boolean") next.context.includePrevious = includePrevious
  if (theme && THEMES.includes(theme)) next.ui.theme = theme
  if (isShare(fallbackBelow)) next.fallback.below = fallbackBelow
  if (isShare(imageInstantAt)) next.fallback.imageInstantAt = imageInstantAt
  if (patch.language && LANGUAGES.includes(patch.language)) next.ui.language = patch.language
  if (typeof patch.saveHistory === "boolean") next.history.enabled = patch.saveHistory
  return next
}

export function choiceFor(config: Config, provider: FallbackProviderId): ModelChoice {
  return resolveChoice(
    provider,
    config.fallback.models[provider],
    config.fallback.efforts[provider],
  )
}

export class SettingsStore {
  private saving: Promise<void> = Promise.resolve()

  constructor(
    private readonly file: string,
    private config: Config,
  ) {}

  get(): Config {
    return this.config
  }

  update(change: (config: Config) => Config): Promise<void> {
    this.config = change(this.config)
    const snapshot = this.config
    this.saving = this.saving.catch(() => {}).then(() => saveConfig(this.file, snapshot))
    return this.saving
  }
}

function timing(value: unknown): Timing | null {
  const t = obj(value)
  const mode = oneOf(t.mode, ["instant", "human"], null)
  const minMs = num(t.minMs, null, 0, MAX_DELAY_MS)
  const maxMs = num(t.maxMs, null, 0, MAX_DELAY_MS)
  if (mode === null || minMs === null || maxMs === null || minMs > maxMs) return null
  return { mode, minMs, maxMs }
}

function isShare(value: unknown): value is number {
  return typeof value === "number" && value >= 0 && value <= 1
}

type Obj = Record<string, unknown>

function isObject(value: unknown): value is Obj {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function obj(value: unknown): Obj {
  return isObject(value) ? value : {}
}

function strings(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(obj(value)).filter((e): e is [string, string] => typeof e[1] === "string"),
  )
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

function num<F>(value: unknown, fallback: F, min: number, max: number): number | F {
  return typeof value === "number" && value >= min && value <= max ? value : fallback
}

function oneOf<T extends string, F>(value: unknown, options: readonly T[], fallback: F): T | F {
  return options.includes(value as T) ? (value as T) : fallback
}
