import { describe, expect, it } from "vitest"
import { addField, newForm, stepProblem, toRequest } from "../../src/renderer/src/lib/start-form.js"
import type { PublicSettings } from "../../src/shared/api.js"

const settings: PublicSettings = {
  hasTypesafeKey: true,
  timing: { mode: "human", minMs: 1000, maxMs: 5000 },
  includePrevious: false,
}

const counter = () => {
  let i = 0
  return () => (i++ * 0.37) % 1
}

describe("start form", () => {
  it("starts from the saved settings with one suggested bot", () => {
    const form = newForm(settings, counter())
    expect(form).toMatchObject({
      human: true,
      minSeconds: 1,
      maxSeconds: 5,
      includePrevious: false,
    })
    expect(form.bots).toHaveLength(1)
    expect(form.bots[0]!.placeholder).not.toBe("")
  })

  it("suggests a different name for every new bot and stops at five", () => {
    let bots = addField([], counter())
    for (let i = 0; i < 6; i++) bots = addField(bots, counter())
    expect(bots).toHaveLength(5)
    expect(new Set(bots.map((b) => b.placeholder)).size).toBe(5)
  })

  it("turns the form into a start request", () => {
    const form = newForm(settings, counter())
    form.pin = "https://kahoot.it/?pin=916240"
    form.bots = [
      { value: " Anna ", placeholder: "BoldOtter" },
      { value: "", placeholder: "CalmLynx" },
    ]
    form.minSeconds = 0.5
    form.context = "  "
    expect(toRequest(form)).toEqual({
      pin: "916240",
      names: ["Anna", "CalmLynx"],
      timing: { mode: "human", minMs: 500, maxMs: 5000 },
      quizContext: null,
      includePrevious: false,
    })
  })

  it("checks each step on its own", () => {
    const form = newForm(settings, counter())
    expect(stepProblem(form, 0)).toBe("pin")
    form.pin = "916240"
    expect(stepProblem(form, 0)).toBeNull()
    form.bots = [
      { value: "Anna", placeholder: "x" },
      { value: "anna", placeholder: "y" },
    ]
    expect(stepProblem(form, 1)).toBe("name_taken")
    form.minSeconds = 9
    expect(stepProblem(form, 2)).toBe("timing")
  })
})
