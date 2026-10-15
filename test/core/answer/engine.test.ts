import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NO_CONTEXT } from "../../../src/core/answer/context.js"
import {
  decide,
  type EngineDeps,
  type EngineSettings,
  type FallbackProvider,
  type FallbackResult,
} from "../../../src/core/answer/engine.js"
import type { JevApi } from "../../../src/core/providers/jev.js"
import type { Question, Usage } from "../../../src/core/types.js"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const usage: Usage = { provider: "typesafe", model: "jev-test", inputTokens: 1, outputTokens: 1 }
const settings: EngineSettings = { fallbackBelow: 0.6, imageInstantAt: 0.9, webSearch: true }

function after<T>(ms: number, value: T, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve(value), ms)
    signal?.addEventListener("abort", () => {
      clearTimeout(t)
      reject(new Error("aborted"))
    })
  })
}

const quiz = (over: Partial<Question> = {}): Question => ({
  index: 0,
  type: "quiz",
  title: "Hauptstadt der Schweiz",
  choices: ["Zürich", "Bern", "Genf", "Basel"].map((text) => ({ text, image: null })),
  image: null,
  timeLimitMs: 20_000,
  raw: null,
  ...over,
})

function jevChoosing(index: number, confidence: number, ms = 300): JevApi {
  const probabilities = [0, 0, 0, 0].map((_, i) => (i === index ? confidence : 0))
  return {
    chooseOne: vi.fn<JevApi["chooseOne"]>((_input, { signal }) =>
      after(ms, { index, confidence, probabilities, usage }, signal),
    ),
    checkEach: vi.fn<JevApi["checkEach"]>((_input, { signal }) =>
      after(ms, { probabilities: [0.9, 0.1, 0.8, 0.2], usage }, signal),
    ),
    placeEach: vi.fn<JevApi["placeEach"]>((_input, { signal }) =>
      after(ms, { positions: [0, 1, 2, 3], usage }, signal),
    ),
    estimateNumber: vi.fn<JevApi["estimateNumber"]>((_input, _range, { signal }) =>
      after(ms, { value: 50, confidence: 0.5, usage }, signal),
    ),
  }
}

const claude: FallbackResult = {
  answer: { kind: "choice", index: 2 },
  confidence: 0.97,
  provider: "anthropic",
  model: "claude-opus-5-5",
  usage: { provider: "anthropic", model: "claude-opus-5-5", inputTokens: 500, outputTokens: 20 },
}

function fallbackAnswering(result: Partial<FallbackResult>, ms = 1000) {
  const seen: { signal: AbortSignal; webSearch: boolean }[] = []
  const provider: FallbackProvider = {
    decide: vi.fn<FallbackProvider["decide"]>((_input, opts) => {
      seen.push(opts)
      return after(ms, { ...claude, ...result }, opts.signal)
    }),
  }
  return { provider, seen }
}

function deps(over: Partial<EngineDeps> = {}): EngineDeps {
  return {
    jev: jevChoosing(1, 0.96),
    fallback: null,
    loadImage: vi.fn<EngineDeps["loadImage"]>(() => Promise.resolve(new Uint8Array([1]))),
    solutions: null,
    now: () => Date.now(),
    random: () => 0.5,
    ...over,
  }
}

async function run(q: Question, d: EngineDeps, startedAt = Date.now(), s = settings) {
  const p = decide(q, startedAt, NO_CONTEXT, s, d)
  await vi.advanceTimersByTimeAsync(30_000)
  return p
}

describe("decide: precedence", () => {
  it("uses the quiz link before any AI", async () => {
    const d = deps({ solutions: { answerFor: () => ({ kind: "choice", index: 3 }) } })
    const r = await run(quiz(), d)
    expect(r).toMatchObject({ answer: { kind: "choice", index: 3 }, source: "quiz-link", confidence: 1 })
    expect(d.jev.chooseOne).not.toHaveBeenCalled()
  })

  it("guesses when Kahoot sent no question text", async () => {
    const r = await run(quiz({ title: null }), deps())
    expect(r).toMatchObject({ answer: { kind: "choice", index: 2 }, source: "random" })
  })

  it("does nothing for word clouds and slides, guesses polls", async () => {
    expect((await run(quiz({ type: "word_cloud" }), deps())).source).toBe("skip")
    expect((await run(quiz({ type: "content" }), deps())).source).toBe("skip")
    expect((await run(quiz({ type: "survey" }), deps())).source).toBe("random")
  })

  it("guesses when a quiz arrives without choices", async () => {
    const d = deps()
    expect((await run(quiz({ choices: [] }), d)).source).toBe("random")
    expect(d.jev.chooseOne).not.toHaveBeenCalled()
  })
})

describe("decide: text questions", () => {
  it("answers with Jev when it is confident", async () => {
    const fb = fallbackAnswering({})
    const r = await run(quiz(), deps({ fallback: fb.provider }))
    expect(r).toMatchObject({ answer: { kind: "choice", index: 1 }, source: "jev", confidence: 0.96 })
    expect(fb.provider.decide).not.toHaveBeenCalled()
  })

  it("asks the fallback when Jev is unsure", async () => {
    const fb = fallbackAnswering({})
    const r = await run(quiz(), deps({ jev: jevChoosing(1, 0.4), fallback: fb.provider }))
    expect(r).toMatchObject({
      answer: { kind: "choice", index: 2 },
      source: "fallback",
      jev: { answer: { kind: "choice", index: 1 }, confidence: 0.4 },
      fallback: { provider: "anthropic", model: "claude-opus-5-5", latencyMs: 1000 },
    })
    expect(r.usage).toHaveLength(2)
  })

  it("keeps Jev's answer when the fallback fails", async () => {
    const provider: FallbackProvider = { decide: vi.fn(() => Promise.reject(new Error("500"))) }
    const r = await run(quiz(), deps({ jev: jevChoosing(1, 0.4), fallback: provider }))
    expect(r).toMatchObject({ answer: { kind: "choice", index: 1 }, source: "jev" })
  })

  it("skips the fallback on short questions", async () => {
    const fb = fallbackAnswering({})
    const r = await run(
      quiz({ timeLimitMs: 5000 }),
      deps({ jev: jevChoosing(1, 0.4, 1000), fallback: fb.provider }),
    )
    expect(r.source).toBe("jev")
    expect(fb.provider.decide).not.toHaveBeenCalled()
  })

  it("guesses right away when the time is already over", async () => {
    const fb = fallbackAnswering({})
    const r = await run(quiz(), deps({ fallback: fb.provider }), Date.now() - 20_000)
    expect(r.source).toBe("random")
    expect(fb.provider.decide).not.toHaveBeenCalled()
  })

  it("falls back when Jev fails, and guesses without a fallback", async () => {
    const broken: JevApi = {
      ...jevChoosing(0, 1),
      chooseOne: vi.fn(() => Promise.reject(new Error("401"))),
    }
    const fb = fallbackAnswering({})
    expect((await run(quiz(), deps({ jev: broken, fallback: fb.provider }))).source).toBe("fallback")
    expect((await run(quiz(), deps({ jev: broken }))).source).toBe("random")
  })

  it("treats a Jev timeout as a failure", async () => {
    const r = await run(quiz(), deps({ jev: jevChoosing(1, 0.99, 10_000) }))
    expect(r.source).toBe("random")
  })

  it("only allows web search with enough time left", async () => {
    const long = fallbackAnswering({})
    await run(quiz(), deps({ jev: jevChoosing(1, 0.4), fallback: long.provider }))
    expect(long.seen[0]?.webSearch).toBe(true)

    const short = fallbackAnswering({})
    await run(
      quiz({ timeLimitMs: 10_000 }),
      deps({ jev: jevChoosing(1, 0.4, 1000), fallback: short.provider }),
    )
    expect(short.seen[0]?.webSearch).toBe(false)

    const off = fallbackAnswering({})
    await run(quiz(), deps({ jev: jevChoosing(1, 0.4), fallback: off.provider }), Date.now(), {
      ...settings,
      webSearch: false,
    })
    expect(off.seen[0]?.webSearch).toBe(false)
  })

  it("selects every likely option on multiple select", async () => {
    const r = await run(quiz({ type: "multiple_select_quiz" }), deps())
    expect(r).toMatchObject({ answer: { kind: "choices", indices: [0, 2] }, source: "jev" })
  })
})

describe("decide: image questions", () => {
  const withImage = () => quiz({ image: { url: "https://images-cdn.kahoot.it/x" } })

  it("answers at once when Jev is very sure and cancels the fallback", async () => {
    const fb = fallbackAnswering({}, 2500)
    const r = await run(withImage(), deps({ jev: jevChoosing(1, 0.95, 500), fallback: fb.provider }))
    expect(r.source).toBe("jev")
    expect(fb.seen[0]?.signal.aborted).toBe(true)
  })

  it("waits for the parallel fallback when Jev is unsure", async () => {
    const fb = fallbackAnswering({}, 2500)
    const r = await run(withImage(), deps({ jev: jevChoosing(1, 0.5, 500), fallback: fb.provider }))
    expect(r).toMatchObject({ source: "fallback", fallback: { latencyMs: 2500 } })
    expect(fb.provider.decide).toHaveBeenCalledTimes(1)
  })

  it("waits at most 5 s for the fallback when Jev is fairly sure", async () => {
    const fb = fallbackAnswering({}, 8000)
    let done = false
    const p = decide(
      withImage(),
      Date.now(),
      NO_CONTEXT,
      settings,
      deps({ jev: jevChoosing(1, 0.7, 500), fallback: fb.provider }),
    ).then((r) => {
      done = true
      return r
    })
    await vi.advanceTimersByTimeAsync(5000)
    expect(done).toBe(true)
    await expect(p).resolves.toMatchObject({ source: "jev", answer: { kind: "choice", index: 1 } })
    expect(fb.seen[0]?.signal.aborted).toBe(true)
  })

  it("still takes a fallback that arrives within 5 s when Jev is fairly sure", async () => {
    const fb = fallbackAnswering({}, 3000)
    const r = await run(withImage(), deps({ jev: jevChoosing(1, 0.7, 500), fallback: fb.provider }))
    expect(r).toMatchObject({ source: "fallback", fallback: { latencyMs: 3000 } })
  })

  it("takes Jev's answer when the fallback misses the deadline", async () => {
    const fb = fallbackAnswering({}, 60_000)
    const start = Date.now()
    const p = decide(
      withImage(),
      start,
      NO_CONTEXT,
      settings,
      deps({ jev: jevChoosing(1, 0.5, 500), fallback: fb.provider }),
    )
    await vi.advanceTimersByTimeAsync(18_500)
    await expect(p).resolves.toMatchObject({ source: "jev" })
  })

  it("answers before the deadline when a late join meets a hanging image", async () => {
    const d = deps({ loadImage: vi.fn(() => new Promise<Uint8Array | null>(() => {})) })
    let done = false
    const p = decide(
      quiz({ image: { url: "https://images-cdn.kahoot.it/x" }, timeLimitMs: 5000 }),
      Date.now() - 2000,
      NO_CONTEXT,
      settings,
      d,
    ).then(() => (done = true))
    await vi.advanceTimersByTimeAsync(1499)
    expect(done).toBe(true)
    await p
  })

  it("hands Kahoot's image description to Jev", async () => {
    const d = deps()
    await run(quiz({ image: { url: "https://media.kahoot.it/x" }, imageAlt: "Paris skyline" }), d)
    expect(vi.mocked(d.jev.chooseOne).mock.calls[0]?.[0].questionImageAlt).toBe("Paris skyline")
  })

  it("goes on with text only when the image download hangs", async () => {
    const d = deps({ loadImage: vi.fn(() => new Promise<Uint8Array | null>(() => {})) })
    const r = await run(withImage(), d)
    expect(r.source).toBe("jev")
    expect(vi.mocked(d.jev.chooseOne).mock.calls[0]?.[0].questionImage).toBeNull()
  })
})

describe("decide: free text", () => {
  it("skips without a fallback and uses it when available", async () => {
    const open = quiz({ type: "open_ended", choices: [] })
    expect((await run(open, deps())).source).toBe("skip")
    const fb = fallbackAnswering({ answer: { kind: "text", value: "Isar" } })
    expect(await run(open, deps({ fallback: fb.provider }))).toMatchObject({
      answer: { kind: "text", value: "Isar" },
      source: "fallback",
    })
  })
})
