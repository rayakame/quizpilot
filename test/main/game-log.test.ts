import { describe, expect, it } from "vitest"
import type { Decision, Question } from "../../src/core/types.js"
import { logEntry } from "../../src/main/game-log.js"

const question = (over: Partial<Question>): Question => ({
  index: 2,
  type: "quiz",
  title: "Q",
  choices: [],
  image: null,
  timeLimitMs: 20000,
  raw: { type: "pin_it", question: "Where?" },
  ...over,
})

describe("logEntry", () => {
  it("keeps the raw data of unknown questions", () => {
    expect(logEntry({ type: "question", question: question({ type: "unknown" }) })).toEqual({
      level: "warn",
      message: "Question 3 has an unknown type",
      detail: { type: "pin_it", question: "Where?" },
    })
  })

  it("notes known questions without their content", () => {
    expect(logEntry({ type: "question", question: question({}) })).toEqual({
      level: "info",
      message: "Question 3: quiz",
    })
  })

  it("records why bots failed or dropped out", () => {
    expect(
      logEntry({ type: "joinFailed", bot: "Ada", code: "locked", message: "Game is locked" }),
    ).toEqual({ level: "warn", message: "Ada couldn't join (locked)", detail: "Game is locked" })
    expect(
      logEntry({ type: "status", bot: "Ada", status: "disconnected", detail: "socket closed" }),
    ).toEqual({ level: "warn", message: "Ada lost the connection", detail: "socket closed" })
    expect(logEntry({ type: "status", bot: "Ada", status: "kicked" })?.message).toBe(
      "Ada was removed by the host",
    )
    expect(logEntry({ type: "status", bot: "Ada", status: "playing" })).toBeNull()
  })

  it("notes where answers came from", () => {
    const decision: Decision = {
      answer: { kind: "choice", index: 1 },
      source: "fallback",
      confidence: 0.8,
      usage: [],
    }
    expect(logEntry({ type: "decision", index: 0, decision })).toEqual({
      level: "info",
      message: "Answer 1 from fallback (80%)",
    })
  })
})
