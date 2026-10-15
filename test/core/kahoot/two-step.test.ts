import { describe, expect, it } from "vitest"
import {
  parseSequence,
  recoveryRequest,
  TwoStepGate,
  twoStepAnswer,
  twoStepEvent,
} from "../../../src/core/kahoot/two-step.js"

describe("recoveryRequest", () => {
  it("asks the host for recovery data like the official client does after two-step", () => {
    const msg = recoveryRequest("281651", "client-1")
    expect(msg).toEqual({
      channel: "/service/controller",
      clientId: "client-1",
      ext: {},
      data: { id: 16, type: "message", gameid: "281651", host: "kahoot.it", content: expect.any(String) },
    })
    expect(JSON.parse(msg.data.content)).toEqual({ usingNamerator: false })
  })
})

describe("TwoStepGate", () => {
  it("asks once per reset until the code is accepted", () => {
    const gate = new TwoStepGate()
    expect(gate.shouldAsk("reset")).toBe(true)
    expect(gate.shouldAsk("reset")).toBe(false)
    gate.answered()
    expect(gate.shouldAsk("wrong")).toBe(false)
    expect(gate.shouldAsk("reset")).toBe(true)
    gate.answered()
    expect(gate.shouldAsk("correct")).toBe(false)
    expect(gate.shouldAsk("reset")).toBe(false)
    expect(gate.done).toBe(true)
  })
})

describe("parseSequence", () => {
  it("reads four distinct shapes 0-3", () => {
    expect(parseSequence("1032")).toEqual([1, 0, 3, 2])
    expect(parseSequence(" 3 2 1 0 ")).toEqual([3, 2, 1, 0])
  })

  it("rejects anything else", () => {
    expect(parseSequence("0000")).toBeNull()
    expect(parseSequence("012")).toBeNull()
    expect(parseSequence("0124")).toBeNull()
    expect(parseSequence("abcd")).toBeNull()
  })
})

describe("twoStepAnswer", () => {
  it("sends the sequence as a list with the game id, like the official client", () => {
    const msg = twoStepAnswer("281651", [1, 0, 3, 2], "client-1")
    expect(msg).toEqual({
      channel: "/service/controller",
      clientId: "client-1",
      ext: {},
      data: { id: 50, type: "message", gameid: "281651", host: "kahoot.it", content: expect.any(String) },
    })
    expect(JSON.parse(msg.data.content)).toEqual({ gameId: "281651", sequence: [1, 0, 3, 2] })
  })
})

describe("twoStepEvent", () => {
  it("maps Kahoot's two-step player messages", () => {
    expect(twoStepEvent({ channel: "/service/player", data: { id: 53 } })).toBe("reset")
    expect(twoStepEvent({ channel: "/service/player", data: { id: 51 } })).toBe("wrong")
    expect(twoStepEvent({ channel: "/service/player", data: { id: 52 } })).toBe("correct")
  })

  it("ignores everything else", () => {
    expect(twoStepEvent({ channel: "/service/player", data: { id: 2 } })).toBeNull()
    expect(twoStepEvent({ channel: "/service/controller", data: { id: 53 } })).toBeNull()
    expect(twoStepEvent({ channel: "/meta/connect" })).toBeNull()
  })
})
