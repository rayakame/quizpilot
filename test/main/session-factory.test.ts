import { describe, expect, it } from "vitest"
import { mistakeRate } from "../../src/main/session-factory.js"

describe("mistakeRate", () => {
  // The window sends the request, so anything can arrive here.
  it("keeps the rate between 0 and 50%", () => {
    expect(mistakeRate(0.2)).toBe(0.2)
    expect(mistakeRate(7)).toBe(0.5)
    expect(mistakeRate(-1)).toBe(0)
    expect(mistakeRate(undefined)).toBe(0)
    expect(mistakeRate("0.3")).toBe(0)
    expect(mistakeRate(Number.NaN)).toBe(0)
  })
})
