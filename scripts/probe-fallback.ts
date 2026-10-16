import { readFileSync } from "node:fs"
import { NO_CONTEXT } from "../src/core/answer/context.js"
import type { FallbackInput } from "../src/core/answer/engine.js"
import { normalizeImage } from "../src/core/media/image-loader.js"
import { createFallback } from "../src/core/providers/fallback/create.js"
import { FALLBACK_PROVIDERS, type FallbackProviderId } from "../src/core/providers/fallback/ids.js"
import { resolveChoice } from "../src/core/providers/fallback/models.js"
import type { Question } from "../src/core/types.js"

const ENV: Record<FallbackProviderId, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
}

const [provider, ...rest] = process.argv.slice(2) as [FallbackProviderId, ...string[]]
const flag = (name: string) => {
  const i = rest.indexOf(name)
  return i < 0 ? undefined : rest.splice(i, 2)[1]
}
const choice = resolveChoice(provider, flag("--model"), flag("--effort"))
const imagePath = rest[0]
if (!FALLBACK_PROVIDERS.includes(provider) || !process.env[ENV[provider]]) {
  console.error(
    `usage: ${ENV.anthropic}=… pnpm probe:fallback anthropic|openai|gemini [--model id] [--effort level] [image.jpg]`,
  )
  process.exit(1)
}
const fallback = createFallback(provider, process.env[ENV[provider]]!, choice)

const choices = (...texts: string[]) => texts.map((text) => ({ text, image: null }))
const question = (over: Partial<Question>): Question => ({
  index: 0,
  type: "quiz",
  title: "",
  choices: [],
  image: null,
  timeLimitMs: 20_000,
  raw: null,
  ...over,
})

const cases: [string, Question][] = [
  [
    "quiz",
    question({
      title: "Hauptstadt der Schweiz?",
      choices: choices("Zürich", "Bern", "Genf", "Basel"),
    }),
  ],
  [
    "true/false",
    question({
      type: "true_false",
      title: "Die Isar fließt durch München.",
      choices: choices("Wahr", "Falsch"),
    }),
  ],
  [
    "multiple",
    question({
      type: "multiple_select_quiz",
      title: "Welche sind Primzahlen?",
      choices: choices("2", "9", "13", "21"),
    }),
  ],
  [
    "puzzle",
    question({
      type: "jumble",
      title: "Sortiere von klein nach groß",
      choices: choices("Elefant", "Maus", "Hund", "Katze"),
    }),
  ],
  [
    "slider",
    question({
      type: "slider",
      title: "In welchem Jahr fiel die Berliner Mauer?",
      slider: { min: 1950, max: 2000, step: 1 },
    }),
  ],
  [
    "type answer",
    question({ type: "open_ended", title: "Wie heißt die Hauptstadt von Frankreich?" }),
  ],
  ["word cloud", question({ type: "word_cloud", title: "Was fällt dir zu München ein?" })],
]

async function ask(label: string, input: FallbackInput, webSearch: boolean) {
  const start = performance.now()
  const ms = () => Math.round(performance.now() - start)
  try {
    const r = await fallback.decide(input, { signal: AbortSignal.timeout(30_000), webSearch })
    const tokens = `${r.usage.inputTokens ?? "?"} in / ${r.usage.outputTokens ?? "?"} out`
    console.log(
      `${label}: ${JSON.stringify(r.answer)} conf ${r.confidence} · ${ms()} ms · ${r.model} · ${tokens}`,
    )
  } catch (err) {
    console.log(`${label}: failed after ${ms()} ms: ${err instanceof Error ? err.message : err}`)
  }
}

for (const webSearch of [false, true]) {
  console.log(
    `\n${choice.model}, effort ${choice.effort ?? "–"}, web search ${webSearch ? "on" : "off"}`,
  )
  for (const [label, q] of cases) {
    await ask(
      label,
      { question: q, questionImage: null, optionImages: [], context: NO_CONTEXT, jev: null },
      webSearch,
    )
  }
}

if (imagePath) {
  const jpeg = await normalizeImage(readFileSync(imagePath))
  const q = question({
    title: "Welches Tier ist auf dem Bild?",
    choices: choices("Adler", "Taube", "Pinguin", "Eule"),
  })
  await ask(
    "\nimage",
    {
      question: q,
      questionImage: jpeg,
      optionImages: [null, null, null, null],
      context: NO_CONTEXT,
      jev: null,
    },
    false,
  )
}
