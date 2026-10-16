import type { Answer, Question, QuestionType } from "../types.js"
import { DEFAULT_SLIDER, snap } from "./strategies.js"

// Polls have no right answer, and a wrong word or text would just look broken.
const NO_MISTAKES = new Set<QuestionType>([
  "survey",
  "word_cloud",
  "content",
  "unknown",
  "open_ended",
])

export function wrongAnswer(answer: Answer, q: Question, random: () => number): Answer | null {
  if (NO_MISTAKES.has(q.type)) return null
  const n = q.choices.length
  const pick = <T>(items: T[]): T | undefined => items[Math.floor(random() * items.length)]
  switch (answer.kind) {
    case "choice": {
      const index = pick([...Array(n).keys()].filter((i) => i !== answer.index))
      return index === undefined ? null : { kind: "choice", index }
    }
    case "choices": {
      const picked = new Set(answer.indices)
      // Dropping the only pick would leave nothing to send.
      const flip = pick([...Array(n).keys()].filter((i) => !(picked.size === 1 && picked.has(i))))
      if (flip === undefined) return null
      if (picked.has(flip)) picked.delete(flip)
      else picked.add(flip)
      return { kind: "choices", indices: [...picked].sort((a, b) => a - b) }
    }
    case "order": {
      if (answer.order.length < 2) return null
      const i = Math.floor(random() * (answer.order.length - 1))
      const order = [...answer.order]
      ;[order[i], order[i + 1]] = [order[i + 1]!, order[i]!]
      return { kind: "order", order }
    }
    case "number": {
      const range = q.slider ?? DEFAULT_SLIDER
      const roll = random()
      const shift = (0.15 + roll * 0.2) * (range.max - range.min)
      const up = snap(answer.value + shift, range)
      const down = snap(answer.value - shift, range)
      const first = roll < 0.5 ? down : up
      const value = first !== answer.value ? first : roll < 0.5 ? up : down
      return value === answer.value ? null : { kind: "number", value }
    }
    case "text":
    case "none":
      return null
  }
}
