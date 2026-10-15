import { describe, expect, it } from "vitest"
import { twoStepEvent } from "../../scripts/lib/two-step.js"

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
