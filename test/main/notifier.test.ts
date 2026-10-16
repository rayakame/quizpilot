import { describe, expect, it, vi } from "vitest"
import { BATCH_MS, Notifier, type NotifierDeps } from "../../src/main/notifier.js"
import { de } from "../../src/shared/i18n/de.js"
import { en } from "../../src/shared/i18n/en.js"

function setup(over: Partial<NotifierDeps> = {}) {
  const timers: (() => void)[] = []
  const deps = {
    show: vi.fn(),
    focused: () => false,
    enabled: () => true,
    text: () => en.notify,
    later: vi.fn((run: () => void, ms: number) => {
      expect(ms).toBe(BATCH_MS)
      timers.push(run)
    }),
    ...over,
  }
  const tick = () => timers.splice(0).forEach((run) => run())
  return { notifier: new Notifier(deps), deps, tick }
}

const ended = (bot: string, rank: number) =>
  ({
    type: "ended",
    bot,
    end: { rank, totalScore: 1000, correctCount: null, incorrectCount: null },
  }) as const

describe("Notifier", () => {
  it("asks for the two-step code once", () => {
    const { notifier, deps } = setup()
    notifier.event({ type: "twoStepRequired" })
    notifier.event({ type: "twoStepRequired" })
    expect(deps.show).toHaveBeenCalledTimes(1)
    expect(deps.show).toHaveBeenCalledWith(en.notify.twoStepTitle, en.notify.twoStepBody)
  })

  it("says nothing while the window is in front", () => {
    const { notifier, deps, tick } = setup({ focused: () => true })
    notifier.event({ type: "twoStepRequired" })
    notifier.event({ type: "status", bot: "Ada", status: "disconnected" })
    tick()
    expect(deps.show).not.toHaveBeenCalled()
  })

  it("says nothing when turned off", () => {
    const { notifier, deps } = setup({ enabled: () => false })
    notifier.event({ type: "twoStepRequired" })
    expect(deps.show).not.toHaveBeenCalled()
  })

  it("sums up bots that drop out together", () => {
    const { notifier, deps, tick } = setup()
    notifier.event({ type: "status", bot: "Ada", status: "disconnected" })
    notifier.event({ type: "status", bot: "Bo", status: "disconnected" })
    notifier.event({ type: "status", bot: "Cy", status: "disconnected" })
    tick()
    expect(deps.show).toHaveBeenCalledTimes(1)
    expect(deps.show).toHaveBeenCalledWith(
      en.notify.lostTitle,
      "Ada, Bo, and Cy lost the connection.",
    )
  })

  it("names the best bot once the game is over", () => {
    const { notifier, deps, tick } = setup()
    notifier.event(ended("Ada", 3))
    notifier.event(ended("Bo", 1))
    tick()
    notifier.event(ended("Cy", 2))
    tick()
    expect(deps.show).toHaveBeenCalledTimes(1)
    expect(deps.show).toHaveBeenCalledWith(en.notify.overTitle, "Bo finished #1.")
  })

  it("warns about a rejected key once per game", () => {
    const { notifier, deps } = setup()
    notifier.event({ type: "notice", notice: "jev_key" })
    notifier.event({ type: "notice", notice: "jev_key" })
    notifier.reset()
    notifier.event({ type: "notice", notice: "jev_key" })
    expect(deps.show).toHaveBeenCalledTimes(2)
  })

  it("speaks the user's language", () => {
    const { notifier, deps, tick } = setup({ text: () => de.notify })
    notifier.event({ type: "status", bot: "Ada", status: "kicked" })
    notifier.event({ type: "status", bot: "Bo", status: "disconnected" })
    notifier.event({ type: "status", bot: "Cy", status: "disconnected" })
    tick()
    expect(deps.show).toHaveBeenCalledWith(de.notify.kickedTitle, "Der Host hat Ada entfernt.")
    expect(deps.show).toHaveBeenCalledWith(
      de.notify.lostTitle,
      "Bo und Cy haben die Verbindung verloren.",
    )
  })
})
