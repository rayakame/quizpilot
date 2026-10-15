import { formatPrevious } from "../../answer/context.js"
import { answerText } from "../../answer/describe.js"
import type { FallbackInput } from "../../answer/engine.js"
import { DEFAULT_SLIDER, snap } from "../../answer/strategies.js"
import type { Answer, Question } from "../../types.js"

export type FallbackPart = { type: "text"; text: string } | { type: "image"; jpeg: Uint8Array }

export interface FallbackRequest {
  system: string
  parts: FallbackPart[]
  schema: Record<string, unknown>
}

export interface ParsedAnswer {
  answer: Answer
  confidence: number | null
}

// Kahoot cuts typed answers after 20 characters.
export const MAX_TEXT_ANSWER = 20

const SYSTEM = `You help answer a live Kahoot quiz. Time is short, so answer directly.
Reply only with JSON that matches the schema. "confidence" is your probability from 0 to 1 that the answer is fully correct.`

const SEARCH = "If you are unsure about a fact, you may search the web once."

export function buildRequest(input: FallbackInput, webSearch: boolean): FallbackRequest {
  const q = input.question
  const shape = answerShape(q)
  const lines: string[] = []
  if (input.context.quizContext) lines.push(`Quiz context: ${input.context.quizContext}`)
  if (input.context.previous.length > 0) {
    lines.push("Earlier questions in this quiz:", ...formatPrevious(input.context.previous))
  }
  lines.push(`Question ${q.index + 1}: ${q.title ?? ""}`)
  if (input.questionImage) lines.push("The question has an image, see below.")
  if (q.imageAlt) lines.push(`Image description: ${q.imageAlt}`)
  if (q.choices.length > 0 && q.type !== "slider" && q.type !== "open_ended") {
    lines.push("Options:")
    q.choices.forEach((c, i) => {
      const picture = input.optionImages[i] ? `(picture ${i + 1}, see below)` : ""
      lines.push(`${i + 1}: ${[c.text, picture].filter(Boolean).join(" ") || "(no text)"}`)
    })
  }
  if (input.jev) {
    const sure =
      input.jev.confidence === null ? "" : ` (${Math.round(input.jev.confidence * 100)}% sure)`
    lines.push(`A quicker model suggested: ${answerText(input.jev.answer, q)}${sure}`)
  }
  lines.push(shape.task)

  const parts: FallbackPart[] = [{ type: "text", text: lines.join("\n") }]
  if (input.questionImage) {
    parts.push(
      { type: "text", text: "Question image:" },
      { type: "image", jpeg: input.questionImage },
    )
  }
  input.optionImages.forEach((jpeg, i) => {
    if (jpeg) parts.push({ type: "text", text: `Picture ${i + 1}:` }, { type: "image", jpeg })
  })
  return { system: webSearch ? `${SYSTEM}\n${SEARCH}` : SYSTEM, parts, schema: shape.schema }
}

export function parseAnswer(q: Question, raw: string): ParsedAnswer {
  const data = extractJson(raw)
  const n = q.choices.length
  // The prompt numbers options from 1, like the questions.
  const isOption = (v: unknown): v is number =>
    typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= n
  const c = data.confidence
  const confidence =
    typeof c === "number" && Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : null
  switch (q.type) {
    case "quiz":
    case "true_false":
      if (!isOption(data.choice)) throw new Error("Fallback picked no valid option")
      return { answer: { kind: "choice", index: data.choice - 1 }, confidence }
    case "multiple_select_quiz": {
      const list: unknown[] = Array.isArray(data.choices) ? data.choices : []
      if (list.length === 0 || !list.every(isOption))
        throw new Error("Fallback picked no valid options")
      const indices = [...new Set(list as number[])].map((v) => v - 1).sort((a, b) => a - b)
      return { answer: { kind: "choices", indices }, confidence }
    }
    case "jumble": {
      const order: unknown[] = Array.isArray(data.order) ? data.order : []
      if (order.length !== n || !order.every(isOption) || new Set(order).size !== n) {
        throw new Error("Fallback order is not a full permutation")
      }
      return { answer: { kind: "order", order: (order as number[]).map((v) => v - 1) }, confidence }
    }
    case "slider": {
      const value = data.value
      if (typeof value !== "number" || !Number.isFinite(value))
        throw new Error("Fallback sent no number")
      return {
        answer: { kind: "number", value: snap(value, q.slider ?? DEFAULT_SLIDER) },
        confidence,
      }
    }
    case "open_ended": {
      const text = typeof data.text === "string" ? data.text.trim().slice(0, MAX_TEXT_ANSWER) : ""
      if (!text) throw new Error("Fallback sent no text")
      return { answer: { kind: "text", value: text }, confidence }
    }
    default:
      throw new Error(`No fallback answers for ${q.type} questions`)
  }
}

export function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64")
}

function answerShape(q: Question): { task: string; schema: Record<string, unknown> } {
  const integer = { type: "integer" }
  switch (q.type) {
    case "quiz":
    case "true_false":
      return {
        task: 'Exactly one option is correct. Put its number in "choice".',
        schema: object({ choice: integer }),
      }
    case "multiple_select_quiz":
      return {
        task: 'One or more options are correct. Put all their numbers in "choices".',
        schema: object({ choices: { type: "array", items: integer } }),
      }
    case "jumble":
      return {
        task: 'Put all options in the right order. List their numbers in "order", first to last.',
        schema: object({ order: { type: "array", items: integer } }),
      }
    case "slider": {
      const { min, max, step } = q.slider ?? DEFAULT_SLIDER
      return {
        task: `Answer with a number from ${min} to ${max} in steps of ${step}, in "value".`,
        schema: object({ value: { type: "number" } }),
      }
    }
    case "open_ended":
      return {
        task: `Answer with the exact text to type, at most ${MAX_TEXT_ANSWER} characters, in "text".`,
        schema: object({ text: { type: "string" } }),
      }
    default:
      throw new Error(`No fallback answers for ${q.type} questions`)
  }
}

function object(properties: Record<string, unknown>): Record<string, unknown> {
  const all = { ...properties, confidence: { type: "number" } }
  return {
    type: "object",
    properties: all,
    required: Object.keys(all),
    additionalProperties: false,
  }
}

function extractJson(raw: string): Record<string, unknown> {
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start < 0 || end < start) throw new Error("Fallback sent no JSON")
  const value: unknown = JSON.parse(raw.slice(start, end + 1))
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Fallback sent no JSON object")
  }
  return value as Record<string, unknown>
}
