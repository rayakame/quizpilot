import type { UpdateState } from "../../../shared/api.js"

let state = $state<UpdateState>({ kind: "off" })
let checking = $state(false)
let checked = $state(false)
let failed = $state(false)

window.quizpilot.onUpdate((next) => (state = next))
void window.quizpilot.getUpdate().then((s) => (state = s))

export const update = {
  get state() {
    return state
  },
  get checking() {
    return checking
  },
  get checked() {
    return checked
  },
  get failed() {
    return failed
  },
  async check() {
    checking = true
    try {
      const next = await window.quizpilot.checkForUpdates()
      failed = next === null
      if (next) state = next
      checked = true
    } catch {
      failed = true
    } finally {
      checking = false
    }
  },
  install: () => window.quizpilot.installUpdate(),
}
