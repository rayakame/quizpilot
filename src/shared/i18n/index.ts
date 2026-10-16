import { de } from "./de.js"
import { en, type Messages } from "./en.js"
import { es } from "./es.js"
import { fr } from "./fr.js"
import { id } from "./id.js"
import { it } from "./it.js"
import { ja } from "./ja.js"
import { nl } from "./nl.js"
import { pl } from "./pl.js"
import { pt } from "./pt.js"
import { tr } from "./tr.js"

export type { Messages }
export type Language = "en" | "de" | "es" | "fr" | "id" | "it" | "ja" | "nl" | "pl" | "pt" | "tr"

// In the order of their names, the way the menu lists them.
export const LANGUAGES: Language[] = [
  "id",
  "de",
  "en",
  "es",
  "fr",
  "it",
  "nl",
  "pl",
  "pt",
  "tr",
  "ja",
]
export const LANGUAGE_NAMES: Record<Language, string> = {
  id: "Bahasa Indonesia",
  de: "Deutsch",
  en: "English",
  es: "Español",
  fr: "Français",
  it: "Italiano",
  nl: "Nederlands",
  pl: "Polski",
  pt: "Português (Brasil)",
  tr: "Türkçe",
  ja: "日本語",
}

const MESSAGES: Record<Language, Messages> = { en, de, es, fr, id, it, ja, nl, pl, pt, tr }

export function messagesFor(language: Language): Messages {
  return MESSAGES[language]
}

export function pickLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split(/[-_]/)[0]
    const match = LANGUAGES.find((language) => language === base)
    if (match) return match
  }
  return "en"
}
