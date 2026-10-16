import { de } from "./de.js"
import { en, type Messages } from "./en.js"

export type { Messages }
export type Language = "en" | "de"

export const LANGUAGES: Language[] = ["en", "de"]
export const LANGUAGE_NAMES: Record<Language, string> = { en: "English", de: "Deutsch" }

const MESSAGES: Record<Language, Messages> = { en, de }

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
