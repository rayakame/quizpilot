import { describe, expect, it } from "vitest"
import { de } from "../../src/shared/i18n/de.js"
import { en } from "../../src/shared/i18n/en.js"
import { messagesFor, pickLanguage } from "../../src/shared/i18n/index.js"

// Words that read the same in both languages.
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

function strings(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]]
  if (value === null || typeof value !== "object") return []
  return Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k))
}

describe("pickLanguage", () => {
  it("takes the first language QuizPilot speaks", () => {
    expect(pickLanguage(["de-AT", "en-US"])).toBe("de")
    expect(pickLanguage(["fr-FR", "de-DE"])).toBe("de")
    expect(pickLanguage(["en_GB"])).toBe("en")
  })

  it("falls back to English", () => {
    expect(pickLanguage(["fr-FR", "ja"])).toBe("en")
    expect(pickLanguage([])).toBe("en")
  })
})

describe("dictionaries", () => {
  it("hands out the German texts", () => {
    expect(messagesFor("de").menu.settings).toBe("Einstellungen…")
    expect(messagesFor("en").menu.settings).toBe("Settings…")
  })

  it("translates every English text", () => {
    const german = new Map(strings(de))
    const untranslated = strings(en)
      .filter(([path, text]) => path !== "locale" && german.get(path) === text && !SAME.has(text))
      .map(([path]) => path)
    expect(untranslated).toEqual([])
  })

  it("counts in both languages", () => {
    expect(en.dialogs.deleteGames(1)).toBe("Delete the saved game?")
    expect(en.dialogs.deleteGames(3)).toBe("Delete all 3 saved games?")
    expect(de.dialogs.deleteGames(1)).toBe("Das gespeicherte Spiel löschen?")
    expect(de.dialogs.deleteGames(3)).toBe("Alle 3 gespeicherten Spiele löschen?")
  })
})
