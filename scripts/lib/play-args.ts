import { MAX_BOTS, type SessionSettings } from "../../src/core/session/game-session.js"

export interface PlayArgs {
  pin: string
  names: string[]
  context: string | null
  timing: SessionSettings["timing"]
  includePrevious: boolean
}

const USAGE =
  'usage: pnpm play <pin> [name...] [--context "text"] [--human 1000-5000] [--no-previous]'

export function parsePlayArgs(argv: string[]): PlayArgs | { error: string } {
  const positional: string[] = []
  let context: string | null = null
  let timing: PlayArgs["timing"] = { mode: "instant", minMs: 0, maxMs: 0 }
  let includePrevious = true
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === "--context") {
      const value = argv[++i]
      if (!value) return { error: USAGE }
      context = value
    } else if (arg === "--human") {
      const m = /^(\d+)-(\d+)$/.exec(argv[++i] ?? "")
      const [minMs, maxMs] = [Number(m?.[1]), Number(m?.[2])]
      if (!m || minMs > maxMs) return { error: USAGE }
      timing = { mode: "human", minMs, maxMs }
    } else if (arg === "--no-previous") {
      includePrevious = false
    } else if (arg.startsWith("--")) {
      return { error: USAGE }
    } else {
      positional.push(arg)
    }
  }
  const [pin, ...names] = positional
  if (!pin || !/^\d{4,10}$/.test(pin)) return { error: USAGE }
  if (names.length > MAX_BOTS) return { error: `at most ${MAX_BOTS} bots` }
  return { pin, names: names.length > 0 ? names : ["QuizPilot"], context, timing, includePrevious }
}
