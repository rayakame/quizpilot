import type { JevApi, JevInput } from "../providers/jev.js"
import type { Answer, Decision, ImageRef, Question, QuestionType, Usage } from "../types.js"
import { abortable, timeoutSignal, withTimeout } from "../util/async.js"
import type { AskContext } from "./context.js"
import {
  DEFAULT_SLIDER,
  fromChecks,
  fromChoice,
  fromEstimate,
  fromPositions,
  randomAnswer,
  type Proposal,
} from "./strategies.js"

export const TIMING = {
  answerMarginMs: 1500,
  imageTimeoutMs: 3000,
  jevReserveMs: 1000,
  jevTimeoutMs: 4000,
  imageFallbackWaitMs: 5000,
  fallbackMinRemainingMs: 3000,
  webSearchMinRemainingMs: 8000,
} as const

export interface EngineSettings {
  fallbackBelow: number
  imageInstantAt: number
  webSearch: boolean
}

export interface FallbackInput {
  question: Question
  questionImage: Uint8Array | null
  optionImages: (Uint8Array | null)[]
  context: AskContext
  jev: Proposal | null
}

export interface FallbackResult {
  answer: Answer
  confidence: number | null
  provider: string
  model: string
  usage: Usage
}

export interface FallbackProvider {
  decide(
    input: FallbackInput,
    opts: { signal: AbortSignal; webSearch: boolean },
  ): Promise<FallbackResult>
}

export interface QuizSolutions {
  answerFor(q: Question): Answer | null
}

export interface EngineDeps {
  jev: JevApi
  fallback: FallbackProvider | null
  loadImage(ref: ImageRef): Promise<Uint8Array | null>
  solutions: QuizSolutions | null
  now(): number
  random(): number
}

interface JevOutcome {
  proposal: Proposal
  usage: Usage
  probabilities?: number[]
}

type TimedFallback = FallbackResult & { latencyMs: number }

const CHOICE_TYPES = new Set<QuestionType>(["quiz", "true_false", "multiple_select_quiz", "jumble"])

export async function decide(
  q: Question,
  startedAt: number,
  context: AskContext,
  settings: EngineSettings,
  deps: EngineDeps,
): Promise<Decision> {
  const deadline = startedAt + q.timeLimitMs - TIMING.answerMarginMs
  const remaining = () => deadline - deps.now()
  const fallback = deps.fallback

  const known = deps.solutions?.answerFor(q) ?? null
  if (known) return { answer: known, source: "quiz-link", confidence: 1, usage: [] }
  if (q.type === "content") return skip()
  if (q.type === "word_cloud" && (!fallback || q.title === null)) return skip()
  if (q.type === "survey" || q.type === "unknown" || q.title === null) return guess(q, deps)
  if (CHOICE_TYPES.has(q.type) && q.choices.length === 0) return guess(q, deps)

  const imageBudget = Math.min(TIMING.imageTimeoutMs, remaining() - TIMING.jevReserveMs)
  const images = await loadImages(q, deps, imageBudget)
  const input: JevInput = {
    question: q.title,
    options: q.choices.map((c) => c.text),
    questionImage: images.question,
    questionImageAlt: q.imageAlt ?? null,
    optionImages: images.options,
    context,
  }
  const fallbackInput = (jev: Proposal | null): FallbackInput => ({
    question: q,
    questionImage: images.question,
    optionImages: images.options,
    context,
    jev,
  })
  const enoughForFallback = () => remaining() >= TIMING.fallbackMinRemainingMs
  const usage: Usage[] = []

  if (q.type === "open_ended" || q.type === "word_cloud") {
    if (!fallback || !enoughForFallback()) return skip()
    const r = await startFallback(fallback, fallbackInput(null), settings, remaining, deps).result
    return r ? fromFallback(r, null, usage) : skip()
  }

  const hasImages = images.question !== null || images.options.some((i) => i !== null)
  const parallel =
    fallback && hasImages && enoughForFallback()
      ? startFallback(fallback, fallbackInput(null), settings, remaining, deps)
      : null

  const jev = await askJev(
    q,
    input,
    deps.jev,
    settings,
    Math.min(TIMING.jevTimeoutMs, remaining()),
  ).catch(() => null)
  if (jev) usage.push(jev.usage)

  if (parallel) {
    const sure = jev?.proposal.confidence ?? 0
    if (jev && sure >= settings.imageInstantAt) {
      parallel.abort()
      return fromJev(jev, usage)
    }
    const fairlySure = jev !== null && sure >= settings.fallbackBelow
    const waitMs = TIMING.imageFallbackWaitMs - (deps.now() - parallel.startedAt)
    const r = fairlySure ? await withTimeout(parallel.result, waitMs, null) : await parallel.result
    if (r) return fromFallback(r, jev, usage)
    parallel.abort()
  } else if (fallback && (jev === null || jev.proposal.wantsFallback) && enoughForFallback()) {
    const r = await startFallback(
      fallback,
      fallbackInput(jev?.proposal ?? null),
      settings,
      remaining,
      deps,
    ).result
    if (r) return fromFallback(r, jev, usage)
  }

  return jev ? fromJev(jev, usage) : guess(q, deps, usage)
}

async function loadImages(q: Question, deps: EngineDeps, budgetMs: number) {
  const load = (ref: ImageRef | null) =>
    ref ? withTimeout(deps.loadImage(ref), budgetMs, null) : Promise.resolve(null)
  const [question, ...options] = await Promise.all([
    load(q.image),
    ...q.choices.map((c) => load(c.image)),
  ])
  return { question: question ?? null, options }
}

async function askJev(
  q: Question,
  input: JevInput,
  jev: JevApi,
  settings: EngineSettings,
  timeoutMs: number,
): Promise<JevOutcome> {
  const t = timeoutSignal(timeoutMs)
  const opts = { signal: t.signal }
  try {
    switch (q.type) {
      case "multiple_select_quiz": {
        const r = await abortable(jev.checkEach(input, opts), t.signal)
        return { proposal: fromChecks(r.probabilities), usage: r.usage, probabilities: r.probabilities }
      }
      case "jumble": {
        const r = await abortable(jev.placeEach(input, opts), t.signal)
        return { proposal: fromPositions(r.positions), usage: r.usage }
      }
      case "slider": {
        const range = q.slider ?? DEFAULT_SLIDER
        const r = await abortable(jev.estimateNumber(input, range, opts), t.signal)
        return { proposal: fromEstimate(r, range), usage: r.usage }
      }
      default: {
        const r = await abortable(jev.chooseOne(input, opts), t.signal)
        return {
          proposal: fromChoice(r, settings.fallbackBelow),
          usage: r.usage,
          probabilities: r.probabilities,
        }
      }
    }
  } finally {
    t.cancel()
  }
}

function startFallback(
  provider: FallbackProvider,
  input: FallbackInput,
  settings: EngineSettings,
  remaining: () => number,
  deps: EngineDeps,
): { result: Promise<TimedFallback | null>; startedAt: number; abort(): void } {
  const t = timeoutSignal(remaining())
  const webSearch = settings.webSearch && remaining() >= TIMING.webSearchMinRemainingMs
  const started = deps.now()
  const result = abortable(provider.decide(input, { signal: t.signal, webSearch }), t.signal)
    .then(
      (r): TimedFallback => ({ ...r, latencyMs: deps.now() - started }),
      () => null,
    )
    .finally(t.cancel)
  return { result, startedAt: started, abort: t.abort }
}

function fromJev(jev: JevOutcome, usage: Usage[]): Decision {
  return {
    answer: jev.proposal.answer,
    source: "jev",
    confidence: jev.proposal.confidence,
    jev: summary(jev),
    usage,
  }
}

function fromFallback(r: TimedFallback, jev: JevOutcome | null, usage: Usage[]): Decision {
  return {
    answer: r.answer,
    source: "fallback",
    confidence: r.confidence,
    jev: jev ? summary(jev) : undefined,
    fallback: { provider: r.provider, model: r.model, latencyMs: r.latencyMs },
    usage: [...usage, r.usage],
  }
}

function summary(jev: JevOutcome): NonNullable<Decision["jev"]> {
  return {
    answer: jev.proposal.answer,
    confidence: jev.proposal.confidence,
    probabilities: jev.probabilities,
  }
}

function guess(q: Question, deps: EngineDeps, usage: Usage[] = []): Decision {
  return { answer: randomAnswer(q, deps.random), source: "random", confidence: null, usage }
}

function skip(): Decision {
  return { answer: { kind: "none" }, source: "skip", confidence: null, usage: [] }
}
