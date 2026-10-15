import { describe, expect, it } from "vitest"
import {
  ADJECTIVES,
  ANIMALS,
  generateName,
  MAX_NAME_LENGTH,
  suggestName,
} from "../../../src/core/names/names.js"

const sequence = (...values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]!
}

describe("generateName", () => {
  it("combines an adjective and an animal", () => {
    expect(generateName([], sequence(0, 0))).toBe("BoldAlpaca")
  })

  it("only builds names Kahoot accepts", () => {
    for (const adjective of ADJECTIVES) {
      for (const animal of ANIMALS) {
        expect((adjective + animal).length).toBeLessThanOrEqual(MAX_NAME_LENGTH)
      }
    }
  })

  it("avoids names that are taken, ignoring case", () => {
    expect(generateName(["boldalpaca"], sequence(0, 0, 0, 0.99))).toBe("BoldWalrus")
  })

  it("falls back to a number when it keeps hitting taken names", () => {
    expect(generateName(["BoldAlpaca"], sequence(0))).toBe("BoldAlpaca2")
  })
})

describe("suggestName", () => {
  it("adds the next free number", () => {
    expect(suggestName("Anna", ["Anna"])).toBe("Anna2")
    expect(suggestName("Anna", ["Anna", "anna2"])).toBe("Anna3")
  })

  it("counts up from a name that already ends in a number", () => {
    expect(suggestName("Anna2", ["Anna2"])).toBe("Anna3")
  })

  it("stays within Kahoot's name length", () => {
    expect(suggestName("Maximilianusxyz", ["Maximilianusxyz"])).toBe("Maximilianusxy2")
  })
})
