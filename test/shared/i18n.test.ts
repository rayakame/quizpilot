import { describe, expect, it } from "vitest"
import { de } from "../../src/shared/i18n/de.js"
import { en } from "../../src/shared/i18n/en.js"
import {
  LANGUAGE_NAMES,
  LANGUAGES,
  messagesFor,
  pickLanguage,
  type Language,
} from "../../src/shared/i18n/index.js"

// Words that read the same in English and most other languages.
const SAME = new Set([
  "Bot",
  "Bots",
  "Quiz",
  "Puzzle",
  "Jev",
  "Host",
  "OK",
  "Name",
  "Text",
  "Minimal",
])
// Words that only read the same in one language.
const ALSO_SAME: Partial<Record<Language, string[]>> = {}

// Lists for the functions that take bot names, numbers for everything else.
const LISTS = new Set(["notify.lostBody", "notify.kickedBody"])

function strings(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]]
  if (value === null || typeof value !== "object") return []
  return Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k))
}

type Fn = (...args: unknown[]) => string

function functions(value: unknown, path = ""): [string, Fn][] {
  if (typeof value === "function") return [[path, value as Fn]]
  if (value === null || typeof value !== "object") return []
  return Object.entries(value).flatMap(([k, v]) => functions(v, path ? `${path}.${k}` : k))
}

describe("pickLanguage", () => {
  it("takes the first language QuizPilot speaks", () => {
    expect(pickLanguage(["de-AT", "en-US"])).toBe("de")
    expect(pickLanguage(["sv-SE", "de-DE"])).toBe("de")
    expect(pickLanguage(["en_GB"])).toBe("en")
  })

  it("falls back to English", () => {
    expect(pickLanguage(["sv-SE", "ko"])).toBe("en")
    expect(pickLanguage(["zh-Hant-TW"])).toBe("en")
    expect(pickLanguage([])).toBe("en")
  })
})

describe("dictionaries", () => {
  it("hands out the German texts", () => {
    expect(messagesFor("de").menu.settings).toBe("Einstellungen…")
    expect(messagesFor("en").menu.settings).toBe("Settings…")
  })

  it("counts in both languages", () => {
    expect(en.dialogs.deleteGames(1)).toBe("Delete the saved game?")
    expect(en.dialogs.deleteGames(3)).toBe("Delete all 3 saved games?")
    expect(de.dialogs.deleteGames(1)).toBe("Das gespeicherte Spiel löschen?")
    expect(de.dialogs.deleteGames(3)).toBe("Alle 3 gespeicherten Spiele löschen?")
  })
})

describe.each(LANGUAGES.filter((l) => l !== "en"))("%s", (language) => {
  const messages = messagesFor(language)

  it("translates every English text", () => {
    const same = new Set([...SAME, ...(ALSO_SAME[language] ?? [])])
    const translated = new Map(strings(messages))
    const untranslated = strings(en)
      .filter(([path, text]) => path !== "locale" && translated.get(path) === text && !same.has(text))
      .map(([path]) => path)
    expect(untranslated).toEqual([])
  })

  it("keeps every value it is given", () => {
    const own = new Map(functions(messages))
    const lost = functions(en).flatMap(([path, fn]) => {
      const args = LISTS.has(path) ? [["Ada", "Bo"]] : [7, 8].slice(0, fn.length)
      const text = own.get(path)?.(...args) ?? ""
      return args.flat().filter((value) => !text.includes(String(value))).map(() => path)
    })
    expect(lost).toEqual([])
  })

  it("has a name and a matching locale", () => {
    expect(LANGUAGE_NAMES[language]).not.toBe("")
    expect(new Intl.Locale(messages.locale).language).toBe(language)
  })
})
