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

  it("keeps powers and indices readable", () => {
    expect(cleanText("Was ist 5<sup>3</sup>?")).toBe("Was ist 5³?")
    expect(cleanText("10<sup>&#8722;3</sup> m")).toBe("10⁻³ m")
    expect(cleanText("x<sup>n+1</sup>")).toBe("xⁿ⁺¹")
    expect(cleanText("2<sup>x</sup> = 8")).toBe("2^x = 8")
    expect(cleanText("e<sup><i>x/2</i></sup>")).toBe("e^(x/2)")
    expect(cleanText("H<sub>2</sub>O")).toBe("H₂O")
    expect(cleanText("a<sub>ij</sub>")).toBe("a_(ij)")
    expect(cleanText("x<sup>&amp;lt;</sup>")).toBe("x^(&lt;)")
  })

  it("returns null for empty or missing text", () => {
    expect(cleanText("   ")).toBeNull()
    expect(cleanText(undefined)).toBeNull()
    expect(cleanText(42)).toBeNull()
  })
})
