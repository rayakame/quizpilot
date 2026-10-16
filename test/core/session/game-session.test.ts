import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  GameSession,
  type SessionDeps,
  type SessionEvent,
  type SessionSettings,
} from "../../../src/core/session/game-session.js"
import type { Decision, Question } from "../../../src/core/types.js"
import { FakeAdapter } from "../../support/fake-adapter.js"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const defaults: SessionSettings = {
  timing: { mode: "instant", minMs: 0, maxMs: 0 },
  quizContext: null,
  includePrevious: true,
  reconnect: true,
}

const question = (index: number, over: Partial<Question> = {}): Question => ({
  index,
  type: "quiz",
  title: `Frage ${index + 1}`,
  choices: ["Zürich", "Bern", "Genf", "Basel"].map((text) => ({ text, image: null })),
  image: null,
  timeLimitMs: 20_000,
  raw: null,
  ...over,
})

const pick = (index: number): Decision => ({
  answer: { kind: "choice", index },
  source: "jev",
  confidence: 0.9,
  usage: [],
})

function after<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

function setup(over: Partial<SessionSettings> = {}, decideMs = 300, decision: Decision = pick(1)) {
  const adapters: FakeAdapter[] = []
  const decide = vi.fn<SessionDeps["decide"]>(() => after(decideMs, decision))
  const session = new GameSession(
    { ...defaults, ...over },
    {
      createAdapter: () => {
        const adapter = new FakeAdapter()
        adapters.push(adapter)
        return adapter
      },
      decide,
      now: () => Date.now(),
      random: () => 0.5,
    },
  )
  const events: SessionEvent[] = []
  session.on((e) => events.push(e))
  return { session, adapters, decide, events }
}

function statusOf(events: SessionEvent[], bot: string) {
  const own = events.filter(
    (e): e is Extract<SessionEvent, { type: "status" }> => e.type === "status" && e.bot === bot,
  )
  return own.at(-1)
}

const lost = {
  reason: "Lost Connection",
  kicked: false,
  retryable: true,
  cause: "network",
} as const

describe("joining", () => {
  it("allows one to five bots", async () => {
    const { session } = setup()
    await expect(session.join("123456", [])).rejects.toThrow()
    await expect(session.join("123456", ["a", "b", "c", "d", "e", "f"])).rejects.toThrow()
  })

  it("joins every bot and puts it in the lobby", async () => {
    const { session, adapters, events } = setup()
    await session.join("123456", ["Anna", "Ben"])
    expect(events[0]).toEqual({ type: "status", bot: "Anna", status: "joining" })
    expect(adapters.map((a) => a.join.mock.calls[0])).toEqual([
      ["123456", "Anna"],
      ["123456", "Ben"],
    ])
    expect(statusOf(events, "Anna")?.status).toBe("lobby")
    expect(statusOf(events, "Ben")?.status).toBe("lobby")
  })

  it("reports how each join went", async () => {
    const { session, events } = setup()
    const outcomes = await session.join("123456", ["Anna", "bad"])
    expect(outcomes).toEqual([
      { name: "Anna", ok: true },
      { name: "bad", ok: false, code: "duplicate_name", message: "Name is already taken" },
    ])
    expect(events).toContainEqual({
      type: "joinFailed",
      bot: "bad",
      code: "duplicate_name",
      message: "Name is already taken",
    })
  })

  it("counts bots across joins, but not the ones that failed", async () => {
    const { session } = setup()
    await session.join("123456", ["a", "b", "c", "bad"])
    await expect(session.join("123456", ["d", "e"])).resolves.toHaveLength(2)
    await expect(session.join("123456", ["f"])).rejects.toThrow("between 1 and 5")
  })

  it("rejects names that are already in the game", async () => {
    const { session, adapters } = setup()
    await session.join("123456", ["Anna"])
    await expect(session.join("123456", ["anna"])).rejects.toThrow("already in the game")
    await expect(session.join("123456", ["Ben", "ben"])).rejects.toThrow("already in the game")
    expect(adapters).toHaveLength(1)
  })

  it("stops joining once everyone was told to leave", async () => {
    const { session, adapters } = setup()
    const joining = session.join("123456", ["Anna", "slowBen", "Cem"])
    await vi.advanceTimersByTimeAsync(10)
    await session.leave()
    await vi.advanceTimersByTimeAsync(1000)
    await joining
    expect(adapters).toHaveLength(2)
    expect(adapters.every((a) => a.leave.mock.calls.length === 1)).toBe(true)
  })

  it("lets a failed name be used again", async () => {
    const { session } = setup()
    await session.join("123456", ["bad"])
    const retry = session.join("123456", ["bad"])
    await expect(retry).resolves.toEqual([
      { name: "bad", ok: false, code: "duplicate_name", message: "Name is already taken" },
    ])
  })

  it("marks only the bot whose join failed", async () => {
    const { session, adapters, events } = setup()
    await session.join("123456", ["Anna", "bad"])
    expect(adapters[1]!.leave).toHaveBeenCalledTimes(1)
    expect(adapters[0]!.leave).not.toHaveBeenCalled()
    expect(statusOf(events, "Anna")?.status).toBe("lobby")
    expect(statusOf(events, "bad")).toMatchObject({
      status: "disconnected",
      detail: "Name is already taken",
    })
    expect(statusOf(events, "bad")?.cause).toBeUndefined()
  })
})

describe("answering", () => {
  it("asks for one decision per question, however many bots play", async () => {
    const { session, adapters, decide } = setup()
    await session.join("123456", ["Anna", "Ben", "Cem"])
    for (const a of adapters) a.emit("questionReady", { question: question(0), startsInMs: 5000 })
    expect(decide).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(5000)
    for (const a of adapters) a.emit("questionStarted", { question: question(0) })
    await vi.advanceTimersByTimeAsync(1)
    for (const a of adapters) expect(a.answer).toHaveBeenCalledWith({ kind: "choice", index: 1 })
  })

  it("starts deciding during get-ready with the expected start time", async () => {
    const { session, adapters, decide } = setup({ quizContext: "Testquiz" })
    await session.join("123456", ["Anna"])
    const start = Date.now()
    adapters[0]!.emit("questionReady", { question: question(0), startsInMs: 5000 })
    expect(decide.mock.calls[0]?.[1]).toBe(start + 5000)
    expect(decide.mock.calls[0]?.[2]).toEqual({ quizContext: "Testquiz", previous: [] })
  })

  it("decides on the spot when a bot joins mid-question", async () => {
    const { session, adapters, decide } = setup()
    await session.join("123456", ["Anna"])
    const start = Date.now()
    adapters[0]!.emit("questionStarted", { question: question(3) })
    expect(decide.mock.calls[0]?.[1]).toBe(start)
    await vi.advanceTimersByTimeAsync(299)
    expect(adapters[0]!.answer).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(adapters[0]!.answer).toHaveBeenCalledTimes(1)
  })

  it("waits for the bot's own delay in human mode", async () => {
    const { session, adapters } = setup({ timing: { mode: "human", minMs: 1000, maxMs: 3000 } })
    await session.join("123456", ["Anna"])
    adapters[0]!.emit("questionStarted", { question: question(0) })
    await vi.advanceTimersByTimeAsync(1999)
    expect(adapters[0]!.answer).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(adapters[0]!.answer).toHaveBeenCalledTimes(1)
  })

  it("never answers after the question ended", async () => {
    const { session, adapters } = setup({}, 10_000)
    await session.join("123456", ["Anna"])
    adapters[0]!.emit("questionStarted", { question: question(0) })
    await vi.advanceTimersByTimeAsync(5000)
    adapters[0]!.emit("questionEnded", {
      index: 0,
      correct: null,
      points: null,
      totalScore: 0,
      rank: 1,
      correctChoices: null,
      answerText: null,
    })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(adapters[0]!.answer).not.toHaveBeenCalled()
  })

  it("sends nothing when the decision is to skip", async () => {
    const skip: Decision = { answer: { kind: "none" }, source: "skip", confidence: null, usage: [] }
    const { session, adapters } = setup({}, 300, skip)
    await session.join("123456", ["Anna"])
    adapters[0]!.emit("questionStarted", { question: question(0, { type: "word_cloud" }) })
    await vi.advanceTimersByTimeAsync(1000)
    expect(adapters[0]!.answer).not.toHaveBeenCalled()
  })

  it("lets paused bots skip questions until they resume", async () => {
    const { session, adapters, events } = setup()
    await session.join("123456", ["Anna", "Ben"])
    session.pause("Anna", true)
    expect(statusOf(events, "Anna")?.status).toBe("paused")
    for (const a of adapters) a.emit("questionStarted", { question: question(0) })
    await vi.advanceTimersByTimeAsync(1000)
    expect(adapters[0]!.answer).not.toHaveBeenCalled()
    expect(adapters[1]!.answer).toHaveBeenCalledTimes(1)
    session.pause("Anna", false)
    adapters[0]!.emit("questionStarted", { question: question(1) })
    await vi.advanceTimersByTimeAsync(1000)
    expect(adapters[0]!.answer).toHaveBeenCalledTimes(1)
  })

  it("pauses and resumes every bot at once", async () => {
    const { session, adapters, events } = setup()
    await session.join("123456", ["Anna", "Ben"])
    session.pause(null, true)
    expect(statusOf(events, "Anna")?.status).toBe("paused")
    expect(statusOf(events, "Ben")?.status).toBe("paused")
    for (const a of adapters) a.emit("questionStarted", { question: question(0) })
    await vi.advanceTimersByTimeAsync(1000)
    expect(adapters.every((a) => a.answer.mock.calls.length === 0)).toBe(true)
    session.pause(null, false)
    expect(statusOf(events, "Anna")?.status).toBe("playing")
  })

  it("leaves on request and ignores the disconnect that follows", async () => {
    const { session, adapters, events } = setup()
    await session.join("123456", ["Anna"])
    await session.leave("Anna")
    expect(adapters[0]!.leave).toHaveBeenCalledTimes(1)
    adapters[0]!.emit("disconnected", {
      reason: "Client Left",
      kicked: false,
      retryable: false,
      cause: "other",
    })
    expect(statusOf(events, "Anna")?.status).toBe("left")
  })
})

describe("two-step join", () => {
  it("asks once for all bots and forwards the code", async () => {
    const { session, adapters, events } = setup()
    await session.join("123456", ["Anna", "Ben"])
    for (const a of adapters) a.emit("twoStepRequired", {})
    expect(events.filter((e) => e.type === "twoStepRequired")).toHaveLength(1)
    await session.submitTwoStep([1, 0, 3, 2])
    for (const a of adapters) expect(a.submitTwoStep).toHaveBeenCalledWith([1, 0, 3, 2])
    for (const a of adapters) a.emit("twoStepResult", { ok: true })
    expect(statusOf(events, "Anna")?.status).toBe("lobby")
  })

  it("asks again after a wrong code", async () => {
    const { session, adapters, events } = setup()
    await session.join("123456", ["Anna"])
    adapters[0]!.emit("twoStepRequired", {})
    await session.submitTwoStep([0, 1, 2, 3])
    adapters[0]!.emit("twoStepResult", { ok: false })
    adapters[0]!.emit("twoStepRequired", {})
    expect(events.filter((e) => e.type === "twoStepRequired")).toHaveLength(2)
  })
})

describe("earlier questions as context", () => {
  async function playFirst(over: Partial<SessionSettings>, first: Question) {
    const s = setup(over)
    await s.session.join("123456", ["Anna"])
    const a = s.adapters[0]!
    a.emit("questionReady", { question: first, startsInMs: 0 })
    a.emit("questionStarted", { question: first })
    await vi.advanceTimersByTimeAsync(300)
    a.emit("questionEnded", {
      index: 0,
      correct: false,
      points: 0,
      totalScore: 0,
      rank: 1,
      correctChoices: [2],
      answerText: "Bern",
    })
    a.emit("questionReady", { question: question(1), startsInMs: 0 })
    return s.decide.mock.calls[1]?.[2]
  }

  it("passes earlier questions with our answer and the correct one", async () => {
    expect(await playFirst({ quizContext: "Testquiz" }, question(0))).toEqual({
      quizContext: "Testquiz",
      previous: [
        { index: 0, title: "Frage 1", answer: "Bern", correct: false, correctAnswer: "Genf" },
      ],
    })
  })

  it("leaves them out when disabled or without text", async () => {
    expect((await playFirst({ includePrevious: false }, question(0)))?.previous).toEqual([])
    expect((await playFirst({}, question(0, { title: null })))?.previous).toEqual([])
  })
})

describe("playing again", () => {
  it("starts fresh after the host resets the game", async () => {
    const { session, adapters, decide, events } = setup()
    await session.join("123456", ["Anna"])
    const a = adapters[0]!
    a.emit("questionReady", { question: question(0), startsInMs: 0 })
    await vi.advanceTimersByTimeAsync(300)
    a.emit("quizEnded", { rank: 1, totalScore: 1000, correctCount: 1, incorrectCount: 0 })
    a.emit("gameReset", {})
    expect(statusOf(events, "Anna")?.status).toBe("lobby")
    a.emit("questionReady", { question: question(0, { title: "Neue Frage" }), startsInMs: 0 })
    expect(decide).toHaveBeenCalledTimes(2)
    expect(decide.mock.calls[1]?.[2]).toEqual({ quizContext: null, previous: [] })
    a.emit("questionStarted", { question: question(0) })
    await vi.advanceTimersByTimeAsync(300)
    expect(a.answer).toHaveBeenCalledTimes(1)
  })
})

describe("reconnecting", () => {
  it("retries a lost connection after 1, 3 and 9 seconds, then gives up", async () => {
    const { session, adapters, events } = setup()
    await session.join("123456", ["Anna"])
    adapters[0]!.reconnect.mockRejectedValue(new Error("offline"))
    adapters[0]!.emit("disconnected", lost)
    await vi.advanceTimersByTimeAsync(999)
    expect(adapters[0]!.reconnect).toHaveBeenCalledTimes(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(adapters[0]!.reconnect).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(3000)
    expect(adapters[0]!.reconnect).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(9000)
    expect(adapters[0]!.reconnect).toHaveBeenCalledTimes(3)
    expect(statusOf(events, "Anna")).toMatchObject({ status: "disconnected", cause: "network" })
  })

  it("ignores the disconnect kahoot.js fires when a reconnect attempt fails", async () => {
    const { session, adapters, events } = setup()
    await session.join("123456", ["Anna"])
    const a = adapters[0]!
    let connected = false
    a.reconnect.mockImplementationOnce(async () => {
      a.emit("disconnected", lost)
      throw new Error("offline")
    })
    a.reconnect.mockImplementation(async () => {
      if (connected) throw new Error("Already connected!")
      connected = true
    })
    a.emit("disconnected", lost)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(a.reconnect).toHaveBeenCalledTimes(2)
    expect(statusOf(events, "Anna")?.status).toBe("lobby")
  })

  it("does not reconnect a bot whose join failed", async () => {
    const { session, adapters } = setup()
    await session.join("123456", ["bad"])
    adapters[0]!.emit("disconnected", lost)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(adapters[0]!.reconnect).not.toHaveBeenCalled()
  })

  it("puts the bot back after a successful reconnect", async () => {
    const { session, adapters, events } = setup()
    await session.join("123456", ["Anna"])
    adapters[0]!.emit("disconnected", lost)
    await vi.advanceTimersByTimeAsync(1000)
    expect(statusOf(events, "Anna")?.status).toBe("lobby")
  })

  it("does not reconnect kicked bots or when reconnecting is off", async () => {
    const kicked = setup()
    await kicked.session.join("123456", ["Anna"])
    kicked.adapters[0]!.emit("disconnected", {
      reason: "Kicked",
      kicked: true,
      retryable: false,
      cause: "other",
    })
    expect(statusOf(kicked.events, "Anna")?.status).toBe("kicked")

    const off = setup({ reconnect: false })
    await off.session.join("123456", ["Anna"])
    off.adapters[0]!.emit("disconnected", lost)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(off.adapters[0]!.reconnect).not.toHaveBeenCalled()
    expect(statusOf(off.events, "Anna")?.status).toBe("disconnected")
  })
})

describe("quiz start", () => {
  it("tells the answer key when a bot sees the quiz start", async () => {
    const quizStarted = vi.fn()
    const adapter = new FakeAdapter()
    const session = new GameSession(defaults, {
      createAdapter: () => adapter,
      decide: () => new Promise(() => {}),
      quizStarted,
      now: () => Date.now(),
      random: () => 0.5,
    })
    await session.join("123456", ["Anna"])
    const info = { randomQuestions: false, randomAnswers: true, first: null }
    adapter.emit("quizStarted", info)
    expect(quizStarted).toHaveBeenCalledWith(info)
  })
})
