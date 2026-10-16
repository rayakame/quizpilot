import { createSubscriber } from "svelte/reactivity"
import { messagesFor, type Language, type Messages } from "../../../shared/i18n/index.js"

let language: Language = "en"
let changed = () => {}
const subscribe = createSubscriber((update) => {
  changed = update
  return () => (changed = () => {})
})

// Reading through the proxy lets templates and $derived re-run when the language changes.
export const t = new Proxy({} as Messages, {
  get: (_, key) => {
    subscribe()
    return messagesFor(language)[key as keyof Messages]
  },
})

export function currentLanguage(): Language {
  subscribe()
  return language
}

export function setLanguage(next: Language): void {
  if (next === language) return
  language = next
  if (typeof document !== "undefined") document.documentElement.lang = next
  changed()
}
