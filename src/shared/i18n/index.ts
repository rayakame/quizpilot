import { de } from "./de.js"
import { en, type Messages } from "./en.js"
import { es } from "./es.js"
import { fr } from "./fr.js"
import { pt } from "./pt.js"

export type { Messages }
export type Language = "en" | "de" | "es" | "fr" | "pt"

// In the order of their names, the way the menu lists them.
export const LANGUAGES: Language[] = ["de", "en", "es", "fr", "pt"]
export const LANGUAGE_NAMES: Record<Language, string> = {
  de: "Deutsch",
  en: "English",
  es: "Español",
  fr: "Français",
  pt: "Português (Brasil)",
}

const MESSAGES: Record<Language, Messages> = { en, de, es, fr, pt }

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
