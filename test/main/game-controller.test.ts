import { describe, expect, it, vi } from "vitest"
import { JoinError, type JoinErrorCode } from "../../src/core/kahoot/adapter.js"
import { QuizLoadError, type KnownQuiz } from "../../src/core/quiz-source/link.js"
import { GameSession } from "../../src/core/session/game-session.js"
import type { Question } from "../../src/core/types.js"
import { GameController, toGameEvent, type GameRecorder } from "../../src/main/game-controller.js"
import type { LogEntry } from "../../src/main/game-log.js"
import type { GameEvent, StartRequest } from "../../src/shared/api.js"
import { FakeAdapter } from "../support/fake-adapter.js"

const request: StartRequest = {
  pin: "916240",
  names: ["Anna", "Ben"],
  timing: { mode: "instant", minMs: 0, maxMs: 0 },
  quizContext: "TUM",
  includePrevious: true,
  quizLink: null,
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function setup(
  firstJoinFails?: JoinErrorCode,
  loadQuiz: (link: string) => Promise<KnownQuiz> = async () => {
    throw new QuizLoadError("unknown")
  },
  recorder?: GameRecorder,
  log?: (entry: LogEntry) => void,
) {
  const adapters: FakeAdapter[] = []
  const sent: GameEvent[] = []
  const createSession = vi.fn(
    (r: StartRequest) =>
      new GameSession(
        {
          timing: r.timing,
          quizContext: r.quizContext,
          includePrevious: r.includePrevious,
          reconnect: true,
        },
        {
          createAdapter: () => {
            const adapter = new FakeAdapter()
            if (firstJoinFails && adapters.length === 0) {
              adapter.join.mockRejectedValueOnce(new JoinError(firstJoinFails, "nope"))
            }
            adapters.push(adapter)
            return adapter
          },
          decide: () => new Promise(() => {}),
          now: Date.now,
          random: Math.random,
        },
      ),
  )
  const controller = new GameController({
    createSession,
    loadQuiz,
    send: (e) => sent.push(e),
    recorder,
    log,
  })
  return { controller, createSession, adapters, sent }
}

const statuses = (sent: GameEvent[]) =>
  sent.flatMap((e) => (e.type === "status" ? [`${e.bot}:${e.status}`] : []))

describe("GameController", () => {
  it("joins every bot and forwards their events", async () => {
    const { controller, adapters, sent } = setup()
    expect(await controller.start(request)).toEqual({ ok: true })
    await flush()
    expect(adapters.map((a) => a.join.mock.calls[0])).toEqual([
      ["916240", "Anna"],
      ["916240", "Ben"],
    ])
    expect(statuses(sent)).toEqual(["Anna:joining", "Anna:lobby", "Ben:joining", "Ben:lobby"])
    expect(controller.active).toBe(true)
  })

  it("refuses invalid requests before touching Kahoot", async () => {
    const { controller, createSession } = setup()
    expect(await controller.start({ ...request, pin: "12" })).toMatchObject({
      ok: false,
      error: "pin",
    })
    expect(createSession).not.toHaveBeenCalled()
  })

  it("gives up when the first bot can't find or enter the game", async () => {
    for (const code of ["not_found", "locked", "unknown"] as const) {
      const { controller, adapters } = setup(code)
      expect(await controller.start(request)).toEqual({ ok: false, error: code, message: "nope" })
      expect(adapters).toHaveLength(1)
      expect(controller.active).toBe(false)
    }
  })

  it("keeps going when only the first name is taken", async () => {
    const { controller, adapters, sent } = setup("duplicate_name")
    expect(await controller.start(request)).toEqual({ ok: true })
    await flush()
    expect(adapters).toHaveLength(2)
    expect(sent).toContainEqual({
      type: "joinFailed",
      bot: "Anna",
      code: "duplicate_name",
      message: "nope",
    })
  })

  it("adds a bot under a new name", async () => {
    const { controller, adapters } = setup("duplicate_name")
    await controller.start(request)
    await flush()
    expect(await controller.addBot(" Anna2 ")).toEqual({ name: "Anna2", ok: true })
    expect(adapters[2]!.join).toHaveBeenCalledWith("916240", "Anna2")
  })

  it("reports a bot that can't be added", async () => {
    const { controller } = setup()
    expect(await controller.addBot("Cem")).toMatchObject({ ok: false, code: "unknown" })
    await controller.start(request)
    await flush()
    expect(await controller.addBot("anna")).toMatchObject({ ok: false, code: "unknown" })
  })

  it("passes pause, leave and two-step codes to the session", async () => {
    const { controller, adapters, sent } = setup()
    await controller.start(request)
    await flush()
    adapters[0]!.emit("twoStepRequired", {})
    await controller.submitTwoStep([3, 1, 0, 2])
    await controller.submitTwoStep([1, 1, 1, 1])
    expect(adapters[0]!.submitTwoStep.mock.calls).toEqual([[[3, 1, 0, 2]]])
    controller.pause("Ben", true)
    await controller.leave("Anna")
    expect(statuses(sent).slice(-2)).toEqual(["Ben:paused", "Anna:left"])
  })

  it("leaves with every bot when the game ends and stops forwarding", async () => {
    const { controller, adapters, sent } = setup()
    await controller.start(request)
    await flush()
    const before = sent.length
    await controller.end()
    expect(adapters.every((a) => a.leave.mock.calls.length === 1)).toBe(true)
    expect(sent).toHaveLength(before)
    expect(controller.active).toBe(false)
  })

  it("ends the old game before starting a new one", async () => {
    const { controller, adapters } = setup()
    await controller.start(request)
    await flush()
    await controller.start({ ...request, names: ["Cem"] })
    expect(adapters[0]!.leave).toHaveBeenCalled()
    expect(adapters[1]!.leave).toHaveBeenCalled()
  })

  const LINK = "https://create.kahoot.it/details/fba5cd05-96af-4506-b8ce-388ff9b33fbb"

  it("loads the quiz before joining and hands it to the session", async () => {
    const quiz = { id: "q", title: "Geo", questions: [] }
    const { controller, createSession } = setup(
      undefined,
      vi.fn(async () => quiz),
    )
    expect(await controller.start({ ...request, quizLink: LINK })).toEqual({ ok: true })
    expect(createSession).toHaveBeenCalledWith({ ...request, quizLink: LINK }, quiz)
  })

  it("does not join when the quiz does not load", async () => {
    const loadQuiz = vi.fn(async () => {
      throw new QuizLoadError("private")
    })
    const { controller, createSession } = setup(undefined, loadQuiz)
    expect(await controller.start({ ...request, quizLink: LINK })).toEqual({
      ok: false,
      error: "quiz_link",
      message: "private",
    })
    expect(createSession).not.toHaveBeenCalled()
  })
})

describe("toGameEvent", () => {
  it("drops the raw Kahoot payload so the event can cross to the window", () => {
    const question: Question = {
      index: 2,
      type: "quiz",
      title: "Capital?",
      choices: [{ text: "Bern", image: null }],
      image: { url: "https://media.kahoot.it/x" },
      timeLimitMs: 20_000,
      raw: { answer: () => {} },
    }
    const event = toGameEvent({ type: "question", question })
    expect(event).toEqual({
      type: "question",
      question: {
        index: 2,
        type: "quiz",
        title: "Capital?",
        choices: [{ text: "Bern", image: null }],
        image: { url: "https://media.kahoot.it/x" },
        imageAlt: null,
        timeLimitMs: 20_000,
      },
    })
    expect(() => structuredClone(event)).not.toThrow()
  })
})

describe("recording", () => {
  function recorder() {
    return { begin: vi.fn(), event: vi.fn(), finish: vi.fn() }
  }

  it("records a game once the first bot is in", async () => {
    const r = recorder()
    const { controller } = setup(undefined, undefined, r)
    await controller.start(request)
    await flush()
    expect(r.begin).toHaveBeenCalledWith(request, null)
    expect(r.event).toHaveBeenCalledWith(expect.objectContaining({ type: "status", bot: "Anna" }))
    await controller.end()
    expect(r.finish).toHaveBeenCalledTimes(1)
  })

  it("records nothing when the first bot cannot join", async () => {
    const r = recorder()
    const { controller } = setup("not_found", undefined, r)
    await controller.start(request)
    expect(r.begin).not.toHaveBeenCalled()
  })

  it("logs the start and what happens in the game", async () => {
    const log = vi.fn()
    const { controller, adapters } = setup(undefined, undefined, undefined, log)
    await controller.start(request)
    await flush()
    adapters[1]!.emit("disconnected", {
      reason: "socket closed",
      kicked: false,
      retryable: false,
      cause: "other",
    })
    expect(log).toHaveBeenCalledWith({ level: "info", message: "Joining 916240 with 2 bots" })
    expect(log).toHaveBeenCalledWith({
      level: "warn",
      message: "Ben lost the connection",
      detail: "socket closed",
    })
  })

  it("logs why a game couldn't start", async () => {
    const log = vi.fn()
    const { controller } = setup("not_found", undefined, undefined, log)
    await controller.start(request)
    expect(log).toHaveBeenCalledWith({
      level: "warn",
      message: "Couldn't join: not_found",
      detail: "nope",
    })
  })
})
