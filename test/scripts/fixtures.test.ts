import { describe, expect, it } from "vitest"
import { fixtureName, rawLabel, toFixture } from "../../scripts/lib/fixtures.js"

describe("fixtureName", () => {
  it("pads the sequence and slugs the label", () => {
    expect(fixtureName(7, "raw /service/player-2")).toBe("0007-raw-service-player-2.json")
    expect(fixtureName(12, "event QuestionStart")).toBe("0012-event-QuestionStart.json")
  })
})

describe("rawLabel", () => {
  it("uses channel and data id", () => {
    expect(rawLabel({ channel: "/service/player", data: { id: 2 } })).toBe("/service/player-2")
  })

  it("falls back to data type, then msg", () => {
    expect(rawLabel({ channel: "/service/controller", data: { type: "loginResponse" } })).toBe(
      "/service/controller-loginResponse",
    )
    expect(rawLabel({ channel: "/meta/connect" })).toBe("/meta/connect-msg")
  })
})

describe("toFixture", () => {
  it("adds parsed content next to the raw string", () => {
    const msg = { channel: "/service/player", data: { id: 2, content: '{"questionIndex":3}' } }
    expect(toFixture(msg)).toEqual({ ...msg, contentParsed: { questionIndex: 3 } })
  })

  it("keeps messages with unparsable or missing content unchanged", () => {
    const broken = { data: { content: "{nope" } }
    expect(toFixture(broken)).toBe(broken)
    const empty = { channel: "/meta/connect" }
    expect(toFixture(empty)).toBe(empty)
  })
})
