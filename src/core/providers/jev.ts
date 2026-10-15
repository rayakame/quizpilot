import {
  choice,
  image,
  noul,
  score,
  type ContentValue,
  type EntryType,
  type Questions,
  type RequestOptions,
  type SystemOneRequest,
  type SystemOneResult,
} from "@typesafe-ai/sdk"
import { formatPrevious, type AskContext } from "../answer/context.js"
import type { SliderRange, Usage } from "../types.js"

export interface SystemOne {
  systemOne<const Q extends Questions>(
    request: SystemOneRequest<Q>,
    options?: RequestOptions,
  ): PromiseLike<SystemOneResult<Q>>
}

export interface JevInput {
  question: string
  options: (string | null)[]
  questionImage: Uint8Array | null
  optionImages: (Uint8Array | null)[]
  context: AskContext
}

export interface CallOpts {
  signal: AbortSignal
}

export interface ChoiceResult {
  index: number
  confidence: number
  probabilities: number[]
  usage: Usage
}

export interface ChecksResult {
  probabilities: number[]
  usage: Usage
}

export interface PositionsResult {
  positions: number[]
  usage: Usage
}

export interface EstimateResult {
  value: number
  confidence: number
  usage: Usage
}

export interface JevApi {
  chooseOne(input: JevInput, opts: CallOpts): Promise<ChoiceResult>
  checkEach(input: JevInput, opts: CallOpts): Promise<ChecksResult>
  placeEach(input: JevInput, opts: CallOpts): Promise<PositionsResult>
  estimateNumber(input: JevInput, range: SliderRange, opts: CallOpts): Promise<EstimateResult>
}

// TypeSafe still gates image input behind this opt-in header.
const IMAGE_HEADER = { "TypeSafe-Danger-Zone-Images": "true" }
const BINS = 10

export function createJev(client: SystemOne): JevApi {
  async function ask<const Q extends Questions>(input: JevInput, questions: Q, opts: CallOpts) {
    const hasImages = input.questionImage !== null || input.optionImages.some((i) => i !== null)
    return client.systemOne(
      { state: buildState(input), questions },
      { signal: opts.signal, headers: hasImages ? IMAGE_HEADER : undefined },
    )
  }

  return {
    async chooseOne(input, opts) {
      const criteria = Object.fromEntries(
        input.options.map((text, i) => [String(i), optionValue(text, input.optionImages[i] ?? null)]),
      )
      const task = instructions("Which option correctly answers the quiz question in `question`?", input)
      const res = await ask(input, { answer: choice(task, criteria) }, opts)
      const a = res.answers.answer
      const index = Number(a.choice)
      if (!Number.isInteger(index) || index < 0 || index >= input.options.length) {
        throw new Error(`jev returned unknown option ${a.choice}`)
      }
      return {
        index,
        confidence: a.confidence,
        probabilities: input.options.map((_, i) => a.probabilities[String(i)] ?? 0),
        usage: usageOf(res),
      }
    },

    async checkEach(input, opts) {
      const task = "Is this option a correct answer to the quiz question in `question`?"
      const questions = Object.fromEntries(
        input.options.map((text, i) => [
          `o${i}`,
          noul(optionEntry(task, text, input.optionImages[i] ?? null, input)),
        ]),
      )
      const res = await ask(input, questions, opts)
      return {
        probabilities: input.options.map((_, i) => res.answers[`o${i}`]?.noul ?? 0),
        usage: usageOf(res),
      }
    },

    async placeEach(input, opts) {
      const n = input.options.length
      if (n < 2) return { positions: input.options.map(() => 0), usage: emptyUsage() }
      const levels = Array.from({ length: n }, (_, k) => {
        const hint = k === 0 ? " (first)" : k === n - 1 ? " (last)" : ""
        return `position ${k + 1} of ${n}${hint}`
      })
      const task = "Where does this option belong in the order the quiz question in `question` asks for?"
      const questions = Object.fromEntries(
        input.options.map((text, i) => [
          `o${i}`,
          score(optionEntry(task, text, input.optionImages[i] ?? null, input), levels),
        ]),
      )
      const res = await ask(input, questions, opts)
      return {
        positions: input.options.map((_, i) => res.answers[`o${i}`]?.score ?? i),
        usage: usageOf(res),
      }
    },

    async estimateNumber(input, range, opts) {
      const width = (range.max - range.min) / BINS
      const bins = Array.from(
        { length: BINS },
        (_, i) => `between ${fmt(range.min + i * width)} and ${fmt(range.min + (i + 1) * width)}`,
      )
      const task = instructions(
        "What is the correct numeric answer to the quiz question in `question`?",
        input,
      )
      const res = await ask(input, { answer: score(task, bins) }, opts)
      const a = res.answers.answer
      return {
        value: range.min + (a.score + 0.5) * width,
        confidence: a.confidence,
        usage: usageOf(res),
      }
    },
  }
}

function buildState(input: JevInput): { [key: string]: ContentValue } {
  const state: { [key: string]: ContentValue } = {
    question: input.question,
    options: input.options.map((o) => o ?? "(image)"),
  }
  if (input.questionImage) state.image = image(input.questionImage)
  if (input.context.quizContext) state.quiz_context = input.context.quizContext
  if (input.context.previous.length > 0) {
    state.previous_questions = formatPrevious(input.context.previous)
  }
  return state
}

function instructions(base: string, input: JevInput): string {
  const hints = [base]
  if (input.context.quizContext) hints.push("`quiz_context` describes the quiz.")
  if (input.context.previous.length > 0) {
    hints.push("`previous_questions` lists earlier questions from the same quiz.")
  }
  return hints.join(" ")
}

function optionValue(text: string | null, img: Uint8Array | null): EntryType {
  return img ? image(img) : text
}

function optionEntry(
  task: string,
  text: string | null,
  img: Uint8Array | null,
  input: JevInput,
): NonNullable<EntryType> {
  const full = instructions(task, input)
  if (img) return { instructions: full, option: image(img) }
  return `${full} The option is: "${text ?? ""}".`
}

function usageOf(res: {
  model: string
  usage: { input_tokens: number | null; output_tokens: number | null }
}): Usage {
  return {
    provider: "typesafe",
    model: res.model,
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
  }
}

function emptyUsage(): Usage {
  return { provider: "typesafe", model: "", inputTokens: 0, outputTokens: 0 }
}

function fmt(n: number): string {
  return String(Number(n.toFixed(2)))
}
