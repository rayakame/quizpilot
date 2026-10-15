import { EMPTY_GAME, reduce, removeBot, type GameState } from "./game-state.js"

let state = $state.raw<GameState>(EMPTY_GAME)
let started = $state(false)
let twoStepHidden = $state(false)

window.quizpilot.onGameEvent((event) => {
  state = reduce(state, event)
  if (event.type === "twoStepRequired") twoStepHidden = false
})

export const game = {
  get state() {
    return state
  },
  get started() {
    return started
  },
  get twoStepOpen() {
    return state.twoStep !== "none" && !twoStepHidden
  },
  set twoStepOpen(open: boolean) {
    twoStepHidden = !open
  },
  reset() {
    state = EMPTY_GAME
    started = false
    twoStepHidden = false
  },
  begin() {
    started = true
  },
  forget(name: string) {
    state = removeBot(state, name)
  },
}
