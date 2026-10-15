import type { Answer, Question, SliderRange } from "../types.js"

export interface Proposal {
  answer: Answer
  confidence: number | null
  wantsFallback: boolean
}

const MULTI_UNSURE = { low: 0.35, high: 0.65 }
const MIN_POSITION_GAP = 0.5

export const DEFAULT_SLIDER: SliderRange = { min: 0, max: 100, step: 1 }

export function fromChoice(r: { index: number; confidence: number }, below: number): Proposal {
  return {
    answer: { kind: "choice", index: r.index },
    confidence: r.confidence,
    wantsFallback: r.confidence < below,
  }
}

export function fromChecks(probabilities: number[]): Proposal {
  let indices = probabilities.flatMap((p, i) => (p >= 0.5 ? [i] : []))
  if (indices.length === 0) indices = [argmax(probabilities)]
  return {
    answer: { kind: "choices", indices },
    confidence: Math.min(...probabilities.map((p) => Math.max(p, 1 - p))),
    wantsFallback: probabilities.some((p) => p >= MULTI_UNSURE.low && p <= MULTI_UNSURE.high),
  }
}

export function fromPositions(positions: number[]): Proposal {
  const order = positions.map((_, i) => i).sort((a, b) => positions[a]! - positions[b]!)
  const sorted = order.map((i) => positions[i]!)
  const gaps = sorted.slice(1).map((p, k) => p - sorted[k]!)
  return {
    answer: { kind: "order", order },
    confidence: null,
    wantsFallback: gaps.some((g) => g < MIN_POSITION_GAP),
  }
}

export function fromEstimate(r: { value: number; confidence: number }, range: SliderRange): Proposal {
  return {
    answer: { kind: "number", value: snap(r.value, range) },
    confidence: r.confidence,
    wantsFallback: true,
  }
}

export function snap(value: number, { min, max, step }: SliderRange): number {
  const snapped = Number((min + Math.round((value - min) / step) * step).toFixed(10))
  if (snapped > max) return Number((min + Math.floor((max - min) / step) * step).toFixed(10))
  return Math.max(min, snapped)
}

export function randomAnswer(q: Question, random: () => number): Answer {
  const n = q.choices.length || 4
  const pick = () => Math.floor(random() * n)
  switch (q.type) {
    case "multiple_select_quiz":
      return { kind: "choices", indices: [pick()] }
    case "jumble":
      return { kind: "order", order: shuffle([...Array(n).keys()], random) }
    case "slider": {
      const range = q.slider ?? DEFAULT_SLIDER
      return { kind: "number", value: snap((range.min + range.max) / 2, range) }
    }
    case "open_ended":
    case "word_cloud":
    case "content":
      return { kind: "none" }
    default:
      return { kind: "choice", index: pick() }
  }
}

function argmax(values: number[]): number {
  return values.reduce((best, v, i) => (v > values[best]! ? i : best), 0)
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[items[i], items[j]] = [items[j]!, items[i]!]
  }
  return items
}
