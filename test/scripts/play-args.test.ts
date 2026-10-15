import { describe, expect, it } from "vitest"
import { parsePlayArgs } from "../../scripts/lib/play-args.js"

describe("parsePlayArgs", () => {
  it("reads pin, names and options", () => {
    expect(
      parsePlayArgs([
        "281651",
        "Anna",
        "Ben",
        "--context",
        "TUM-Quiz",
        "--human",
        "1000-4000",
        "--no-previous",
      ]),
    ).toEqual({
      pin: "281651",
      names: ["Anna", "Ben"],
      context: "TUM-Quiz",
      timing: { mode: "human", minMs: 1000, maxMs: 4000 },
      includePrevious: false,
    })
  })

  it("has sensible defaults", () => {
    expect(parsePlayArgs(["281651"])).toEqual({
      pin: "281651",
      names: ["QuizPilot"],
      context: null,
      timing: { mode: "instant", minMs: 0, maxMs: 0 },
      includePrevious: true,
    })
  })

  it("rejects bad input", () => {
    expect(parsePlayArgs([])).toHaveProperty("error")
    expect(parsePlayArgs(["abc"])).toHaveProperty("error")
    expect(parsePlayArgs(["281651", "--human", "5000-1000"])).toHaveProperty("error")
    expect(parsePlayArgs(["281651", "--context"])).toHaveProperty("error")
    expect(parsePlayArgs(["281651", "--fast"])).toHaveProperty("error")
    expect(parsePlayArgs(["281651", "a", "b", "c", "d", "e", "f"])).toHaveProperty("error")
  })
})
