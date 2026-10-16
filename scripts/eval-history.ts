import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { TypeSafeClient } from "@typesafe-ai/sdk"
import type { PreviousQuestion } from "../src/core/answer/context.js"
import { answerText, correctAnswer } from "../src/core/answer/describe.js"
import { decide } from "../src/core/answer/engine.js"
import { isRight } from "../src/core/answer/grade.js"
import { createImageLoader } from "../src/core/media/image-loader.js"
import { createJev } from "../src/core/providers/jev.js"
import type { ImageRef, Question } from "../src/core/types.js"
import { fallbackFor } from "../src/main/fallback.js"
import { HistoryStore } from "../src/main/history/store.js"
import { loadConfig } from "../src/main/settings.js"
import { dataDir, parseEvalArgs } from "./lib/eval-args.js"

const args = parseEvalArgs(process.argv.slice(2))
if ("error" in args) {
  console.error(args.error)
  process.exit(1)
}

const dir = args.data ?? dataDir(process.platform, process.env, homedir())
const loaded = await loadConfig(join(dir, "config.json"))
if (!loaded.ok || !loaded.config.keys.typesafe) {
  console.error(`No TypeSafe key in ${join(dir, "config.json")}`)
  process.exit(1)
}
const config = loaded.config
const store = HistoryStore.open(join(dir, "history", "history.db"))
const id = args.gameId ?? store.latestGameId()
const record = id === null ? null : store.getGame(id)
if (!record) {
  console.error(id === null ? "The history is empty." : `No game ${id} in the history.`)
  process.exit(1)
}

const download = createImageLoader()
const saved = new Map(
  record.questions.flatMap((h) =>
    h.question.image && h.imagePath ? [[h.question.image.url, h.imagePath] as const] : [],
  ),
)
const loadImage = async (ref: ImageRef) => {
  const file = saved.get(ref.url)
  const bytes = file ? await readFile(file).catch(() => null) : null
  return bytes && bytes.length > 0 ? new Uint8Array(bytes) : download(ref)
}
const deps = {
  jev: createJev(new TypeSafeClient({ apiKey: config.keys.typesafe })),
  fallback: fallbackFor(config),
  loadImage,
  solutions: null,
  now: Date.now,
  random: Math.random,
}
const engine = {
  fallbackBelow: config.fallback.below,
  imageInstantAt: config.fallback.imageInstantAt,
  webSearch: config.fallback.webSearch,
}

console.log(
  `${record.game.quizTitle ?? `Game ${record.game.pin}`} · earlier questions ${args.previous ? "on" : "off"}`,
)
const previous: PreviousQuestion[] = []
let before = 0
let after = 0
let graded = 0
for (const h of record.questions) {
  const q: Question = { ...h.question, raw: null }
  if (q.title === null || !h.correctChoices) continue
  const context = { quizContext: record.game.context, previous: args.previous ? [...previous] : [] }
  const d = await decide(q, Date.now(), context, engine, deps)
  const old = h.decision ? isRight(h.decision.answer, q.type, h.correctChoices) : null
  const now = isRight(d.answer, q.type, h.correctChoices)
  if (old !== null && now !== null) {
    graded += 1
    if (old) before += 1
    if (now) after += 1
  }
  const mark = (v: boolean | null) => (v === null ? "–" : v ? "✓" : "✗")
  console.log(
    `Q${q.index + 1} ${mark(old)} → ${mark(now)} ${d.source} · ${answerText(d.answer, q)}`,
  )
  previous.push({
    index: q.index,
    title: q.title,
    answer: h.decision ? answerText(h.decision.answer, q) : "–",
    correct: old,
    correctAnswer: answerText(correctAnswer(q, h.correctChoices), q),
  })
}
console.log(`\nSaved: ${before}/${graded} right · now: ${after}/${graded} right`)
store.close()
