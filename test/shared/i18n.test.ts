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
  "Zoom",
])
// Words that only read the same in one language.
const ALSO_SAME: Partial<Record<Language, string[]>> = {
  fr: ["Services", "Options"],
  id: ["File", "Edit", "Model", "Slide"],
  it: ["File"],
  nl: ["Model"],
  pl: ["Model"],
  pt: ["Slide"],
  tr: ["Model"],
}

type Fn = (...args: unknown[]) => string

// Functions that give the same text as in English.
const SAME_FUNCTIONS = new Set([
  "home.jevWith",
  "history.pin",
  "common.inSeconds",
  "common.range",
  "common.rank",
  "common.pair",
  "common.list",
])
const ALSO_SAME_FUNCTIONS: Partial<Record<Language, string[]>> = {
  de: ["about.version"],
  fr: ["common.points", "start.questions", "game.question", "about.version"],
}

// Lists for the functions that take bot names, numbers for everything else.
const LISTS = new Set(["notify.lostBody", "notify.kickedBody", "common.list"])

function samples(path: string, fn: Fn): unknown[][] {
  if (LISTS.has(path)) return [[["Ada"]], [["Ada", "Bo", "Cy"]]]
  expect(fn.length, path).toBeGreaterThan(0)
  // 1, 2, 5 and 22 hit every plural form here; no second value contains the first.
  const pairs = [
    [1, 30],
    [2, 40],
    [5, 70],
    [22, 90],
    [3, 1],
  ]
  return pairs.map((pair) => pair.slice(0, fn.length))
}

function strings(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]]
  if (value === null || typeof value !== "object") return []
  return Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k))
}

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

  it("knows regional variants", () => {
    expect(pickLanguage(["es-419"])).toBe("es")
    expect(pickLanguage(["pt-PT"])).toBe("pt")
    expect(pickLanguage(["fr-CA", "de"])).toBe("fr")
    expect(pickLanguage(["nl-BE"])).toBe("nl")
    expect(pickLanguage(["ja-JP"])).toBe("ja")
    expect(pickLanguage(["id-ID"])).toBe("id")
    expect(pickLanguage(["tr"])).toBe("tr")
  })

  it("falls back to English", () => {
    expect(pickLanguage(["sv-SE", "ko"])).toBe("en")
    expect(pickLanguage(["zh-Hant-TW"])).toBe("en")
    expect(pickLanguage(["in-ID"])).toBe("en")
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

  it("counts in Spanish, Portuguese and French", () => {
    const { es, pt, fr } = { es: messagesFor("es"), pt: messagesFor("pt"), fr: messagesFor("fr") }
    expect(es.dialogs.deleteGames(1)).toBe("¿Borrar la partida guardada?")
    expect(es.dialogs.deleteGames(3)).toBe("¿Borrar las 3 partidas guardadas?")
    expect(pt.dialogs.deleteGames(1)).toBe("Excluir a partida salva?")
    expect(pt.dialogs.deleteGames(3)).toBe("Excluir as 3 partidas salvas?")
    expect(fr.dialogs.deleteGames(1)).toBe("Supprimer la partie enregistrée\u00a0?")
    expect(fr.dialogs.deleteGames(3)).toBe("Supprimer les 3 parties enregistrées\u00a0?")
    expect(fr.settings.gamesSaved(0)).toBe("0 partie enregistrée")
  })

  it("counts in Polish", () => {
    const pl = messagesFor("pl")
    expect([1, 2, 5, 12, 22].map((n) => pl.start.questions(n))).toEqual([
      "1\u00a0pytanie",
      "2\u00a0pytania",
      "5\u00a0pytań",
      "12\u00a0pytań",
      "22\u00a0pytania",
    ])
    expect([1, 2, 5].map((n) => pl.common.points(n))).toEqual([
      "1\u00a0punkt",
      "2\u00a0punkty",
      "5\u00a0punktów",
    ])
  })

  it("counts in Italian and Dutch", () => {
    expect(messagesFor("it").start.questions(1)).toBe("1 domanda")
    expect(messagesFor("it").start.questions(3)).toBe("3 domande")
    expect(messagesFor("nl").start.questions(1)).toBe("1 vraag")
    expect(messagesFor("nl").start.questions(3)).toBe("3 vragen")
  })

  it("counts without plural endings in Turkish, Indonesian and Japanese", () => {
    expect(messagesFor("tr").start.questions(3)).toBe("3 soru")
    expect(messagesFor("id").start.questions(3)).toBe("3 pertanyaan")
    expect(messagesFor("ja").start.questions(3)).toBe("3\u2060問")
    expect(messagesFor("ja").start.questions(1)).toBe("1\u2060問")
  })

  it("writes ranks and ranges the local way", () => {
    expect(en.common.rank(1)).toBe("#1")
    expect(messagesFor("tr").common.rank(1)).toBe("1.")
    expect(messagesFor("ja").common.rank(1)).toBe("1\u2060位")
    expect(messagesFor("ja").common.points(3)).toBe("3\u2060ポイント")
    expect(en.common.range("1.5", "4")).toBe("1.5–4")
    expect(messagesFor("ja").common.range("1.5", "4")).toBe("1.5〜4")
  })

  it("keeps numbers with their words and labels with their values", () => {
    expect(en.common.points(950)).toBe("950\u00a0points")
    expect(en.common.pair("Ada", "right")).toBe("Ada: right")
    expect(messagesFor("fr").common.pair("Ada", "juste")).toBe("Ada\u00a0: juste")
    expect(en.common.list(["Ada", "Bo"])).toBe("Ada, Bo")
    expect(messagesFor("ja").common.list(["Ada", "Bo"])).toBe("Ada、Bo")
  })

  it("elides the Italian article before 8 and 0", () => {
    const backup = messagesFor("it").backup
    expect(backup.below("60%")).toContain("sotto il 60%")
    expect(backup.below("80%")).toContain("sotto l’80%")
    expect(backup.below("0%")).toContain("sotto lo 0%")
    expect(backup.instantAt("90%")).toContain("almeno del 90%")
    expect(backup.instantAt("85%")).toContain("almeno dell’85%")
  })

  it("says a Polish bot is reconnecting itself", () => {
    expect(messagesFor("pl").status.reconnecting).toBe("Łączy się ponownie")
  })

  it("offers every language it has a name for", () => {
    expect([...LANGUAGES].sort()).toEqual(Object.keys(LANGUAGE_NAMES).sort())
  })
})

describe.each(LANGUAGES.filter((l) => l !== "en"))("%s", (language) => {
  const messages = messagesFor(language)

  it("translates every English text", () => {
    const same = new Set([...SAME, ...(ALSO_SAME[language] ?? [])])
    const translated = new Map(strings(messages))
    const untranslated = strings(en)
      .filter(
        ([path, text]) => path !== "locale" && translated.get(path) === text && !same.has(text),
      )
      .map(([path]) => path)
    expect(untranslated).toEqual([])
  })

  it("translates every English function", () => {
    const same = new Set([...SAME_FUNCTIONS, ...(ALSO_SAME_FUNCTIONS[language] ?? [])])
    const own = new Map(functions(messages))
    const untranslated = functions(en)
      .filter(([path, fn]) => {
        const [args = []] = samples(path, fn)
        return !same.has(path) && own.get(path)?.(...args) === fn(...args)
      })
      .map(([path]) => path)
    expect(untranslated).toEqual([])
  })

  it("keeps every value it is given", () => {
    const own = new Map(functions(messages))
    const lost = functions(en).flatMap(([path, fn]) =>
      samples(path, fn).flatMap((args) => {
        const english = fn(...args)
        const text = own.get(path)?.(...args) ?? ""
        return args
          .flat()
          .filter((value) => english.includes(String(value)) && !text.includes(String(value)))
          .map((value) => `${path}(${value})`)
      }),
    )
    expect(lost).toEqual([])
  })

  it("has a name and a matching locale", () => {
    expect(LANGUAGE_NAMES[language]).not.toBe("")
    expect(new Intl.Locale(messages.locale).language).toBe(language)
  })
})
