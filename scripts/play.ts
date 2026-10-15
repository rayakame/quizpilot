import { createInterface } from "node:readline/promises"
import { TypeSafeClient } from "@typesafe-ai/sdk"
import Kahoot from "kahoot.js-latest"
import { answerText } from "../src/core/answer/describe.js"
import { decide, type EngineSettings } from "../src/core/answer/engine.js"
import { KahootAdapter } from "../src/core/kahoot/adapter.js"
import { parseSequence } from "../src/core/kahoot/two-step.js"
import { createImageLoader } from "../src/core/media/image-loader.js"
import { createJev } from "../src/core/providers/jev.js"
import { GameSession, type BotStatus } from "../src/core/session/game-session.js"
import type { Question } from "../src/core/types.js"
import { parsePlayArgs, type PlayArgs } from "./lib/play-args.js"

const parsed = parsePlayArgs(process.argv.slice(2))
if ("error" in parsed) {
  console.error(parsed.error)
  process.exit(1)
}
const args: PlayArgs = parsed

const jev = createJev(new TypeSafeClient())
const loadImage = createImageLoader()
const engine: EngineSettings = { fallbackBelow: 0.6, imageInstantAt: 0.9, webSearch: false }

const session = new GameSession(
  {
    timing: args.timing,
    quizContext: args.context,
    includePrevious: args.includePrevious,
    reconnect: true,
  },
  {
    createAdapter: () => new KahootAdapter(new Kahoot()),
    decide: (q, startedAt, context) =>
      decide(q, startedAt, context, engine, {
        jev,
        fallback: null,
        loadImage,
        solutions: null,
        now: Date.now,
        random: Math.random,
      }),
    now: Date.now,
    random: Math.random,
  },
)

const questions = new Map<number, Question>()
const finalStatus = new Map<string, BotStatus>()
const FINAL: BotStatus[] = ["finished", "left", "kicked", "disconnected"]

session.on((e) => {
  switch (e.type) {
    case "status": {
      console.log(`${e.bot}: ${e.status}${e.detail ? ` (${e.detail})` : ""}`)
      if (FINAL.includes(e.status)) finalStatus.set(e.bot, e.status)
      if (finalStatus.size === args.names.length) setTimeout(() => process.exit(0), 500)
      break
    }
    case "question":
      questions.set(e.question.index, e.question)
      console.log(`\nQ${e.question.index + 1} [${e.question.type}] ${e.question.title ?? "(no text)"}`)
      break
    case "decision": {
      const q = questions.get(e.index)
      const d = e.decision
      const sure = d.confidence === null ? "" : ` ${Math.round(d.confidence * 100)}%`
      console.log(`  → ${q ? answerText(d.answer, q) : "?"} via ${d.source}${sure}`)
      break
    }
    case "result": {
      const mark = e.result.correct === null ? "·" : e.result.correct ? "✓" : "✗"
      const points = e.result.points ?? 0
      console.log(`  ${e.bot}: ${mark} +${points} = ${e.result.totalScore} (#${e.result.rank})`)
      break
    }
    case "ended":
      console.log(`\n${e.bot} finished #${e.end.rank} with ${e.end.totalScore} points`)
      break
    case "twoStepRequired":
      void askTwoStep()
      break
    case "twoStepResult":
      console.log(e.ok ? "two-step code accepted" : "two-step code was wrong")
      break
  }
})

let asking = false
async function askTwoStep() {
  if (asking) return
  asking = true
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  let sequence: number[] | null = null
  while (!sequence) {
    sequence = parseSequence(await rl.question("two-step code, 0=red 1=blue 2=yellow 3=green: "))
    if (!sequence) console.log("need four different digits 0-3")
  }
  rl.close()
  asking = false
  await session.submitTwoStep(sequence)
}

process.on("SIGINT", () => {
  void session.leave().finally(() => process.exit(0))
})

await session.join(args.pin, args.names)
