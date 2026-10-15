import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  DEFAULT_CONFIG,
  loadConfig,
  parseConfig,
  saveConfig,
  SettingsStore,
  toPublic,
} from "../../src/main/settings.js"

async function tempFile() {
  return join(await mkdtemp(join(tmpdir(), "quizpilot-")), "config.json")
}

describe("parseConfig", () => {
  it("keeps every valid value", () => {
    const config = {
      version: 1,
      keys: { typesafe: "ts-1", anthropic: "sk-2", openai: "", gemini: "" },
      fallback: {
        provider: "openai",
        models: { openai: "gpt-x" },
        below: 0.5,
        imageInstantAt: 0.8,
        webSearch: false,
      },
      context: { includePrevious: false },
      behavior: { timing: { mode: "human", minMs: 500, maxMs: 2000 }, reconnect: false },
      ui: { language: "de", theme: "dark" },
    }
    expect(parseConfig(config)).toEqual(config)
  })

  it("repairs single broken values with defaults", () => {
    const config = parseConfig({
      version: 1,
      keys: { typesafe: 42 },
      fallback: { below: 7, models: { openai: 3, gemini: "g" } },
      behavior: { timing: { mode: "human", minMs: 4000, maxMs: 1000 } },
      ui: { theme: "pink" },
    })
    expect(config.keys.typesafe).toBe("")
    expect(config.fallback.below).toBe(0.6)
    expect(config.fallback.models).toEqual({ gemini: "g" })
    expect(config.behavior.timing).toEqual(DEFAULT_CONFIG.behavior.timing)
    expect(config.ui.theme).toBe("system")
  })

  it("rejects files that are not settings", () => {
    expect(() => parseConfig([])).toThrow("not a JSON object")
    expect(() => parseConfig({ version: 2 })).toThrow("Unknown settings version: 2")
  })
})

describe("loadConfig and saveConfig", () => {
  it("starts with defaults when there is no file", async () => {
    expect(await loadConfig(await tempFile())).toEqual({ ok: true, config: DEFAULT_CONFIG })
  })

  it("reports a broken file instead of throwing", async () => {
    const file = await tempFile()
    await writeFile(file, "{ nope")
    const result = await loadConfig(file)
    expect(result.ok).toBe(false)
  })

  it("writes a file only the user can read", async () => {
    const file = await tempFile()
    const config = { ...DEFAULT_CONFIG, keys: { ...DEFAULT_CONFIG.keys, typesafe: "ts-1" } }
    await saveConfig(file, config)
    expect(await loadConfig(file)).toEqual({ ok: true, config })
    if (process.platform !== "win32") expect((await stat(file)).mode & 0o777).toBe(0o600)
  })
})

describe("SettingsStore", () => {
  it("applies changes in order and saves the last state", async () => {
    const file = await tempFile()
    const store = new SettingsStore(file, structuredClone(DEFAULT_CONFIG))
    const first = store.update((c) => ({ ...c, keys: { ...c.keys, typesafe: "ts-1" } }))
    const second = store.update((c) => ({ ...c, context: { includePrevious: false } }))
    await Promise.all([first, second])
    expect(store.get().keys.typesafe).toBe("ts-1")
    const saved = JSON.parse(await readFile(file, "utf8")) as typeof DEFAULT_CONFIG
    expect(saved.keys.typesafe).toBe("ts-1")
    expect(saved.context.includePrevious).toBe(false)
  })
})

describe("toPublic", () => {
  it("tells the window whether a key exists, never the key itself", () => {
    const keys = { ...DEFAULT_CONFIG.keys, typesafe: "ts-secret", openai: "sk-secret" }
    const view = toPublic({ ...DEFAULT_CONFIG, keys })
    expect(view).toEqual({
      hasTypesafeKey: true,
      timing: DEFAULT_CONFIG.behavior.timing,
      includePrevious: true,
      fallback: { provider: "anthropic", webSearch: true, savedKeys: ["openai"] },
    })
    expect(JSON.stringify(view)).not.toContain("secret")
  })
})
