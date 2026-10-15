import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { FALLBACK_PROVIDERS, type FallbackProviderId } from "../core/providers/fallback/ids.js"
import type { PublicSettings, Timing } from "../shared/api.js"
import { MAX_DELAY_MS } from "../shared/start.js"

export interface Config {
  version: 1
  keys: { typesafe: string; anthropic: string; openai: string; gemini: string }
  fallback: {
    provider: FallbackProviderId
    models: Record<string, string>
    below: number
    imageInstantAt: number
    webSearch: boolean
  }
  context: { includePrevious: boolean }
  behavior: { timing: Timing; reconnect: boolean }
  ui: { language: "en" | "de"; theme: "system" | "light" | "dark" }
}

export const DEFAULT_CONFIG: Config = {
  version: 1,
  keys: { typesafe: "", anthropic: "", openai: "", gemini: "" },
  fallback: { provider: "anthropic", models: {}, below: 0.6, imageInstantAt: 0.9, webSearch: true },
  context: { includePrevious: true },
  behavior: { timing: { mode: "instant", minMs: 1000, maxMs: 5000 }, reconnect: true },
  ui: { language: "en", theme: "system" },
}

export type LoadResult = { ok: true; config: Config } | { ok: false; error: string }

export async function loadConfig(file: string): Promise<LoadResult> {
  let text: string
  try {
    text = await readFile(file, "utf8")
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: true, config: structuredClone(DEFAULT_CONFIG) }
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
      models: Object.fromEntries(
        Object.entries(obj(fallback.models)).filter(
          (e): e is [string, string] => typeof e[1] === "string",
        ),
      ),
      below: num(fallback.below, d.fallback.below, 0, 1),
      imageInstantAt: num(fallback.imageInstantAt, d.fallback.imageInstantAt, 0, 1),
      webSearch: bool(fallback.webSearch, d.fallback.webSearch),
    },
    context: { includePrevious: bool(context.includePrevious, d.context.includePrevious) },
    behavior: {
      timing: timing(behavior.timing) ?? { ...d.behavior.timing },
      reconnect: bool(behavior.reconnect, d.behavior.reconnect),
    },
    ui: {
      language: oneOf(ui.language, ["en", "de"], d.ui.language),
      theme: oneOf(ui.theme, ["system", "light", "dark"], d.ui.theme),
    },
  }
}

export function toPublic(config: Config): PublicSettings {
  return {
    hasTypesafeKey: config.keys.typesafe !== "",
    timing: config.behavior.timing,
    includePrevious: config.context.includePrevious,
    fallback: {
      provider: config.fallback.provider,
      webSearch: config.fallback.webSearch,
      savedKeys: FALLBACK_PROVIDERS.filter((p) => config.keys[p] !== ""),
    },
  }
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

type Obj = Record<string, unknown>

function isObject(value: unknown): value is Obj {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function obj(value: unknown): Obj {
  return isObject(value) ? value : {}
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
