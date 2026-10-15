import { describe, expect, it } from "vitest"
import type { StartRequest } from "../../src/shared/api.js"
import { nameProblem, parsePin, startProblem, timingProblem } from "../../src/shared/start.js"

describe("parsePin", () => {
  it("reads a typed PIN, with or without spaces", () => {
    expect(parsePin("916240")).toBe("916240")
    expect(parsePin(" 916 240 ")).toBe("916240")
  })

  it("reads the PIN from a kahoot.it link", () => {
    expect(parsePin("https://kahoot.it/?pin=916240&refer_method=link")).toBe("916240")
  })

  it("rejects everything else", () => {
    expect(parsePin("")).toBeNull()
    expect(parsePin("12a456")).toBeNull()
    expect(parsePin("123")).toBeNull()
    expect(parsePin("https://kahoot.it/")).toBeNull()
  })
})

describe("nameProblem", () => {
  it("wants a short name nobody else uses", () => {
    expect(nameProblem("Anna", ["Ben"])).toBeNull()
    expect(nameProblem("  ", [])).toBe("name_empty")
    expect(nameProblem("Maximilian Mustermann", [])).toBe("name_long")
    expect(nameProblem("anna ", ["Anna"])).toBe("name_taken")
  })
})

describe("timingProblem", () => {
  it("checks the delay range only in human mode", () => {
    expect(timingProblem({ mode: "instant", minMs: 9, maxMs: 1 })).toBeNull()
    expect(timingProblem({ mode: "human", minMs: 1000, maxMs: 5000 })).toBeNull()
    expect(timingProblem({ mode: "human", minMs: 5000, maxMs: 1000 })).toBe("timing")
    expect(timingProblem({ mode: "human", minMs: 0, maxMs: 31_000 })).toBe("timing")
    expect(timingProblem({ mode: "human", minMs: Number.NaN, maxMs: 1000 })).toBe("timing")
  })
})

describe("startProblem", () => {
  const request: StartRequest = {
    pin: "916240",
    names: ["Anna", "Ben"],
    timing: { mode: "instant", minMs: 1000, maxMs: 5000 },
    quizContext: null,
    includePrevious: true,
  }

  it("accepts a complete request", () => {
    expect(startProblem(request)).toBeNull()
  })

  it("finds the first problem", () => {
    expect(startProblem({ ...request, pin: "https://kahoot.it/?pin=916240" })).toBe("pin")
    expect(startProblem({ ...request, names: [] })).toBe("bots")
    expect(startProblem({ ...request, names: ["a", "b", "c", "d", "e", "f"] })).toBe("bots")
    expect(startProblem({ ...request, names: ["Anna", "ANNA"] })).toBe("name_taken")
    expect(startProblem({ ...request, timing: { mode: "human", minMs: 3000, maxMs: 1000 } })).toBe(
      "timing",
    )
  })
})
