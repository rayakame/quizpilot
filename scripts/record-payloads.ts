import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { createInterface } from "node:readline/promises"
import Kahoot from "kahoot.js-latest"
import { fixtureName, rawLabel, toFixture, type RawMessage } from "./lib/fixtures.js"

const [pin, name = "Recorder"] = process.argv.slice(2)
if (!pin) {
  console.error("usage: pnpm record <pin> [name]")
  process.exit(1)
}

const dir = join("test", "fixtures", "kahoot", new Date().toISOString().replace(/[:.]/g, "-"))
mkdirSync(dir, { recursive: true })

let seq = 0
function save(label: string, data: unknown) {
  writeFileSync(join(dir, fixtureName(seq++, label)), JSON.stringify(data, null, 2))
}

const client = new Kahoot()
client.handlers.recorder = (msg) =>
  save(`raw ${rawLabel(msg as RawMessage)}`, toFixture(msg as RawMessage))

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

client.on("TwoFactorReset", async () => {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const code = await rl.question("two-step code, 0=red 1=blue 2=yellow 3=green (e.g. 0213): ")
  rl.close()
  await client.answerTwoFactorAuth(code.trim().split("").map(Number))
})

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
