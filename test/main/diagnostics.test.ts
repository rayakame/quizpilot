import { describe, expect, it } from "vitest"
import { diagnosticsName, diagnosticsReport, MAX_LOG } from "../../src/main/diagnostics.js"
import { DEFAULT_CONFIG } from "../../src/main/settings.js"

const info = {
  version: "0.1.0",
  electron: "44.7.2",
  chrome: "150.0",
  node: "24.21.0",
  os: "darwin 27.0.0 arm64",
  systemLanguages: ["de-DE"],
}
const config = {
  ...DEFAULT_CONFIG,
  keys: {
    typesafe: "ts-live-1234567890",
    anthropic: "",
    openai: "",
    gemini: "AIzaSyA1234567890abcdefghijk",
  },
}

describe("diagnosticsReport", () => {
  it("lists the app, the system and the settings", () => {
    const report = diagnosticsReport(info, config, "line one\n", new Date(0))
    expect(report).toContain("QuizPilot 0.1.0")
    expect(report).toContain("Electron 44.7.2")
    expect(report).toContain("darwin 27.0.0 arm64")
    expect(report).toContain('"typesafe": "set"')
    expect(report).toContain('"anthropic": "not set"')
    expect(report).toContain("line one")
  })

  it("never contains a key, not even from the log", () => {
    const log = "Jev failed: Incorrect API key provided: ts-live-1234567890\n"
    const report = diagnosticsReport(info, config, log, new Date(0))
    expect(report).not.toContain("ts-live-1234567890")
    expect(report).not.toContain("AIzaSyA1234567890abcdefghijk")
  })

  it("keeps only the end of a long log", () => {
    const log = "old\n" + "x".repeat(MAX_LOG) + "\nnewest\n"
    const report = diagnosticsReport(info, config, log, new Date(0))
    expect(report).toContain("newest")
    expect(report).not.toContain("old\n")
  })
})

describe("diagnosticsName", () => {
  it("uses the local day", () => {
    expect(diagnosticsName(new Date(2026, 9, 16, 23, 30))).toBe("quizpilot-diagnostics-2026-10-16")
  })
})
