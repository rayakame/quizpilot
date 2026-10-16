import { describe, expect, it } from "vitest"
import {
  addField,
  checkFor,
  newForm,
  reusableCheck,
  stepProblem,
  toRequest,
  toTiming,
  type LinkCheck,
} from "../../src/renderer/src/lib/start-form.js"
import type { PublicSettings } from "../../src/shared/api.js"

const settings: PublicSettings = {
  hasTypesafeKey: true,
  timing: { mode: "human", minMs: 1000, maxMs: 5000 },
  includePrevious: false,
  reconnect: true,
  notify: true,
  theme: "system",
  language: "en",
  saveHistory: true,
  fallback: {
    provider: "anthropic",
    webSearch: true,
    below: 0.6,
    imageInstantAt: 0.9,
    savedKeys: [],
    choices: {
      anthropic: { model: "claude-sonnet-5-5", effort: "low" },
      openai: { model: "gpt-6.1-sol", effort: "low" },
      gemini: { model: "gemini-3.8-flash", effort: "low" },
    },
  },
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
      quizLink: null,
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

describe("toTiming", () => {
  it("turns seconds from the form into milliseconds", () => {
    expect(toTiming(true, 1.5, 4)).toEqual({ mode: "human", minMs: 1500, maxMs: 4000 })
    expect(toTiming(false, 1, 5)).toEqual({ mode: "instant", minMs: 1000, maxMs: 5000 })
  })
})

describe("quiz link", () => {
  const LINK = "https://create.kahoot.it/details/fba5cd05-96af-4506-b8ce-388ff9b33fbb"

  it("sends the trimmed link or none", () => {
    expect(toRequest({ ...newForm(settings), quizLink: `  ${LINK} ` }).quizLink).toBe(LINK)
    expect(toRequest({ ...newForm(settings), quizLink: "  " }).quizLink).toBeNull()
  })

  it("stops on the options step when the link has no quiz in it", () => {
    expect(stepProblem({ ...newForm(settings), quizLink: "kahoot.it" }, 2)).toBe("quiz_link")
    expect(stepProblem({ ...newForm(settings), quizLink: LINK }, 2)).toBeNull()
  })

  it("forgets the check when the link changes", () => {
    const check: LinkCheck = { link: LINK, result: { ok: true, title: "Geo", questions: 10 } }
    expect(checkFor(check, ` ${LINK} `)).toBe(check)
    expect(checkFor(check, `${LINK}x`)).toBeNull()
    expect(checkFor(null, LINK)).toBeNull()
  })

  it("checks a link again when the last check failed", () => {
    const failed: LinkCheck = { link: LINK, result: { ok: false, error: "offline" } }
    const passed: LinkCheck = { link: LINK, result: { ok: true, title: "Geo", questions: 10 } }
    expect(reusableCheck(failed, LINK)).toBeNull()
    expect(reusableCheck({ link: LINK, result: null }, LINK)).toBeNull()
    expect(reusableCheck(passed, ` ${LINK}`)).toEqual(passed.result)
    expect(reusableCheck(passed, "other")).toBeNull()
  })
})
