import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { createInterface } from "node:readline/promises"
import Kahoot from "kahoot.js-latest"
import type { RawMessage } from "../src/core/kahoot/raw.js"
import {
  parseSequence,
  recoveryRequest,
  TwoStepGate,
  twoStepAnswer,
  twoStepEvent,
  type TwoStepEvent,
} from "../src/core/kahoot/two-step.js"
import { fixtureName, rawLabel, toFixture } from "./lib/fixtures.js"

const [pinArg, name = "Recorder"] = process.argv.slice(2)
if (!pinArg) {
  console.error("usage: pnpm record <pin> [name]")
  process.exit(1)
}
const pin: string = pinArg

const dir = join("test", "fixtures", "kahoot", new Date().toISOString().replace(/[:.]/g, "-"))
mkdirSync(dir, { recursive: true })

let seq = 0
function save(label: string, data: unknown) {
  writeFileSync(join(dir, fixtureName(seq++, label)), JSON.stringify(data, null, 2))
}

const client = new Kahoot()
client.handlers.recorder = (msg) => {
  save(`raw ${rawLabel(msg as RawMessage)}`, toFixture(msg as RawMessage))
  onTwoStep(twoStepEvent(msg as RawMessage))
}

const emit = client.emit.bind(client)
client.emit = (event: string, ...args: unknown[]) => {
  save(`event ${event}`, args[0] ?? null)
  console.log(event)
  return emit(event, ...args)
}

client.on("QuestionStart", (question: { answer(choice: number): Promise<unknown> }) => {
  // Any answer will do; we only need Kahoot to send the result afterwards.
  question.answer(0).catch(() => {})
})

// kahoot.js drops these because Kahoot's session info reports twoFactorAuth: false even when it's on.
const gate = new TwoStepGate()
async function onTwoStep(event: TwoStepEvent | null) {
  const ask = gate.shouldAsk(event)
  if (event === "wrong") console.log("two-step code was wrong")
  if (event === "correct") {
    console.log("two-step code accepted")
    // The official client re-requests recovery data here; kahoot.js only did it before the code.
    await client._send(recoveryRequest(pin, client.clientId)).catch((err: unknown) => {
      console.error("recovery request failed:", err)
    })
  }
  if (!ask) return
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  let sequence: number[] | null = null
  while (!sequence) {
    const code = await rl.question("two-step code, 0=red 1=blue 2=yellow 3=green (e.g. 0213): ")
    sequence = parseSequence(code)
    if (!sequence) console.log("need four different digits 0-3")
  }
  rl.close()
  gate.answered()
  await client._send(twoStepAnswer(pin, sequence, client.clientId)).catch((err: unknown) => {
    console.error("sending the code failed:", err)
  })
}

client.on("Disconnect", (reason: string) => {
  console.log(`disconnected (${reason}), saved to ${dir}`)
  process.exit(0)
})

process.on("SIGINT", () => {
  console.log(`saved to ${dir}`)
  process.exit(0)
})

client.join(pin, name).catch((err: unknown) => {
  console.error("join failed:", err)
  process.exit(1)
})
