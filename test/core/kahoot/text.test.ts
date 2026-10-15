import { describe, expect, it } from "vitest"
import { cleanText } from "../../../src/core/kahoot/text.js"

describe("cleanText", () => {
  it("decodes entities and strips markup", () => {
    expect(cleanText("I = 0 &amp; U = Bel.")).toBe("I = 0 & U = Bel.")
    expect(cleanText("<b>Fett</b> und <i>kursiv</i>")).toBe("Fett und kursiv")
    expect(cleanText("M&#252;nchen &#x1F600;")).toBe("München 😀")
    expect(cleanText("a&nbsp;b<br/>c")).toBe("a b c")
    expect(cleanText("&unknown;")).toBe("&unknown;")
  })

  it("returns null for empty or missing text", () => {
    expect(cleanText("   ")).toBeNull()
    expect(cleanText(undefined)).toBeNull()
    expect(cleanText(42)).toBeNull()
  })
})
