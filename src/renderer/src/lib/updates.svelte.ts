import type { UpdateState } from "../../../shared/api.js"

let state = $state<UpdateState>({ kind: "off" })
let checking = $state(false)
let checked = $state(false)

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
  async check() {
    checking = true
    try {
      state = await window.quizpilot.checkForUpdates()
      checked = true
    } finally {
      checking = false
    }
  },
  install: () => window.quizpilot.installUpdate(),
}
