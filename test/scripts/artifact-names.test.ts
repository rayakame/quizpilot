import { describe, expect, it } from "vitest"
import { installerNames, usesVersion } from "../support/installers.js"

describe("installer names", () => {
  // The website links to these under releases/latest/download.
  it("stay the same from version to version", () => {
    expect(installerNames()).toEqual([
      "QuizPilot-arm64.dmg",
      "QuizPilot-x64.dmg",
      "QuizPilot-Setup.exe",
      "QuizPilot-x86_64.AppImage",
    ])
    expect(usesVersion()).toBe(false)
  })
})
