import { describe, expect, it } from "vitest"
import { JoinError, KahootAdapter, type AdapterEvents } from "../../../src/core/kahoot/adapter.js"
import { FakeKahootClient } from "../../support/fake-kahoot.js"

const A = "test/fixtures/kahoot/2026-10-15T20-44-39-567Z"
const B = "test/fixtures/kahoot/2026-10-15T20-48-24-699Z"
const TWO_STEP = "test/fixtures/kahoot/2026-10-15T21-00-07-988Z"
const TWO_STEP_GAME = "test/fixtures/kahoot/2026-10-15T21-04-01-626Z"

const EVENTS = [
  "joined",
  "twoStepRequired",
  "twoStepResult",
  "questionReady",
  "questionStarted",
  "questionEnded",
  "quizEnded",
  "gameReset",
  "disconnected",
] as const

function setup() {
  const client = new FakeKahootClient()
  const adapter = new KahootAdapter(client)
  const log: { event: keyof AdapterEvents; payload: unknown }[] = []
  for (const event of EVENTS) adapter.on(event, (payload) => log.push({ event, payload }))
  const of = <K extends keyof AdapterEvents>(event: K) =>
    log.filter((l) => l.event === event).map((l) => l.payload as AdapterEvents[K])
  return { client, adapter, log, of }
}

const sentIds = (client: FakeKahootClient) =>
  client._send.mock.calls.map(([m]) => (m as { data: { id: number } }).data.id)

describe("replaying recorded games", () => {
  it("turns a full game into question events and one quiz end", () => {
    const { client, of } = setup()
    client.replay(A)
    expect(of("questionReady").map((r) => r.question.type)).toEqual([
      "quiz",
      "quiz",
      "quiz",
      "true_false",
      "multiple_select_quiz",
      "jumble",
      "word_cloud",
      "content",
    ])
    expect(of("questionStarted")).toHaveLength(7)
    expect(of("questionEnded")[0]).toMatchObject({ index: 0, correctChoices: [1] })
    expect(of("quizEnded")).toEqual([
      { rank: 1, totalScore: 500, correctCount: 0, incorrectCount: 6 },
    ])
  })

  it("has no question text when the host hides it", () => {
    const { client, of } = setup()
    client.replay(B)
    expect(of("questionReady").every((r) => r.question.title === null)).toBe(true)
  })

  it("reports a wrong and then a right two-step code and re-requests recovery data", () => {
    const { client, of } = setup()
    client.replay(TWO_STEP)
    expect(of("twoStepRequired")).toHaveLength(1)
    expect(of("twoStepResult")).toEqual([{ ok: false }, { ok: true }])
    expect(sentIds(client)).toEqual([16])
  })

  it("plays a whole game after the two-step join", () => {
    const { client, of } = setup()
    client.replay(TWO_STEP_GAME)
    expect(of("twoStepResult")).toEqual([{ ok: true }])
    expect(of("questionStarted")).toHaveLength(7)
    expect(of("quizEnded")).toHaveLength(1)
  })
})

describe("two-step join", () => {
  const msg = (id: number) => ({ channel: "/service/player", data: { id } })

  it("asks again after a wrong code and stops after the right one", async () => {
    const { client, adapter, of } = setup()
    await adapter.join("281651", "Anna")
    client.raw(msg(53))
    await adapter.submitTwoStep([1, 0, 3, 2])
    client.raw(msg(51))
    client.raw(msg(53))
    await adapter.submitTwoStep([0, 2, 3, 1])
    client.raw(msg(52))
    client.raw(msg(53))

    expect(of("twoStepRequired")).toHaveLength(2)
    expect(of("twoStepResult")).toEqual([{ ok: false }, { ok: true }])
    expect(sentIds(client)).toEqual([50, 50, 16])
    const first = client._send.mock.calls[0]?.[0] as { data: { content: string } }
    expect(JSON.parse(first.data.content)).toEqual({ gameId: "281651", sequence: [1, 0, 3, 2] })
  })
})

describe("kahoot.js quirks", () => {
  it("tells kahoot.js which question is running when Ready was missed", () => {
    const { client } = setup()
    client.fire("QuestionStart", {
      gameBlockIndex: 4,
      type: "multiple_select_quiz",
      timeAvailable: 5000,
    })
    expect(client.quiz?.currentQuestion).toMatchObject({
      questionIndex: 4,
      gameBlockType: "multiple_select_quiz",
    })
  })

  it("handles every message of a batched frame", () => {
    const { client, of } = setup()
    client._message(
      JSON.stringify([
        { channel: "/meta/connect" },
        { channel: "/service/player", data: { id: 53 } },
      ]),
    )
    expect(of("twoStepRequired")).toHaveLength(1)
  })

  it("reports a game reset and the next podium again", () => {
    const { client, of } = setup()
    const podium = { rank: 1, totalScore: 100 }
    client.fire("Podium", podium)
    client.fire("GameReset", undefined)
    client.fire("Podium", podium)
    expect(of("gameReset")).toHaveLength(1)
    expect(of("quizEnded")).toHaveLength(2)
  })
})

describe("join, answer and disconnect", () => {
  it("joins and reports it", async () => {
    const { client, adapter, of } = setup()
    await adapter.join("123456", "Anna")
    expect(client.join).toHaveBeenCalledWith("123456", "Anna")
    expect(of("joined")).toHaveLength(1)
  })

  it("explains why a join failed", async () => {
    const cases: [unknown, string][] = [
      [
        { description: "Duplicate name", type: "loginResponse", error: "USER_INPUT" },
        "duplicate_name",
      ],
      [{ status: "LOCKED", description: "Locked" }, "locked"],
      [
        { description: "Request failed or timed out.", error: { response: { statusCode: 404 } } },
        "not_found",
      ],
      [{ description: "Missing header token (pin doesn't exist)" }, "not_found"],
      [{ description: "Request failed or timed out.", error: {} }, "unknown"],
      [{ description: "Invalid/Missing PIN" }, "not_found"],
      ["Failed to get challenge data", "unknown"],
    ]
    for (const [reason, code] of cases) {
      const { client, adapter } = setup()
      client.join.mockRejectedValueOnce(reason)
      const err = await adapter.join("123456", "Anna").catch((e: unknown) => e)
      expect(err).toBeInstanceOf(JoinError)
      expect((err as JoinError).code).toBe(code)
    }
  })

  it("sends answers in kahoot.js form and skips empty ones", async () => {
    const { client, adapter } = setup()
    await adapter.answer({ kind: "choice", index: 2 })
    await adapter.answer({ kind: "order", order: [1, 0, 3, 2] })
    await adapter.answer({ kind: "none" })
    expect(client.answer.mock.calls).toEqual([[2], [[1, 0, 3, 2]]])
  })

  it("tells kicks and lost connections apart", () => {
    const { client, of } = setup()
    client.fire("Disconnect", "Kicked")
    client.fire("Disconnect", "Lost Connection")
    client.fire("Disconnect", "Session Ended")
    client.fire("Disconnect", "Quiz Locked")
    client.fire("Disconnect", "Some server text")
    expect(of("disconnected")).toEqual([
      { reason: "Kicked", kicked: true, retryable: false, cause: "other" },
      { reason: "Lost Connection", kicked: false, retryable: true, cause: "network" },
      { reason: "Session Ended", kicked: false, retryable: false, cause: "ended" },
      { reason: "Quiz Locked", kicked: false, retryable: false, cause: "locked" },
      { reason: "Some server text", kicked: false, retryable: false, cause: "other" },
    ])
  })
})

describe("quiz start", () => {
  it("reports the game options and the first question", () => {
    const client = new FakeKahootClient()
    const adapter = new KahootAdapter(client)
    const starts: unknown[] = []
    adapter.on("quizStarted", (info) => starts.push(info))
    client.replay(A)
    expect(starts).toHaveLength(1)
    expect(starts[0]).toMatchObject({
      randomQuestions: false,
      randomAnswers: false,
      first: { question: "Hauptstadt der Schweiz?" },
    })
  })
})
