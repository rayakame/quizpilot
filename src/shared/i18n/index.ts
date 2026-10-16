import { de } from "./de.js"
import { en, type Messages } from "./en.js"
import { es } from "./es.js"
import { fr } from "./fr.js"
import { it } from "./it.js"
import { nl } from "./nl.js"
import { pl } from "./pl.js"
import { pt } from "./pt.js"

export type { Messages }
export type Language = "en" | "de" | "es" | "fr" | "it" | "nl" | "pl" | "pt"

// In the order of their names, the way the menu lists them.
export const LANGUAGES: Language[] = ["de", "en", "es", "fr", "it", "nl", "pl", "pt"]
export const LANGUAGE_NAMES: Record<Language, string> = {
  de: "Deutsch",
  en: "English",
  es: "Español",
  fr: "Français",
  it: "Italiano",
  nl: "Nederlands",
  pl: "Polski",
  pt: "Português (Brasil)",
}

const MESSAGES: Record<Language, Messages> = { en, de, es, fr, it, nl, pl, pt }

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
