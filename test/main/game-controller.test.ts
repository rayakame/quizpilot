import { describe, expect, it, vi } from "vitest"
import { JoinError, type JoinErrorCode } from "../../src/core/kahoot/adapter.js"
import { GameSession } from "../../src/core/session/game-session.js"
import type { Question } from "../../src/core/types.js"
import { GameController, toGameEvent } from "../../src/main/game-controller.js"
import type { GameEvent, StartRequest } from "../../src/shared/api.js"
import { FakeAdapter } from "../support/fake-adapter.js"

const request: StartRequest = {
  pin: "916240",
  names: ["Anna", "Ben"],
  timing: { mode: "instant", minMs: 0, maxMs: 0 },
  quizContext: "TUM",
  includePrevious: true,
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function setup(firstJoinFails?: JoinErrorCode) {
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
  const controller = new GameController({ createSession, send: (e) => sent.push(e) })
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
