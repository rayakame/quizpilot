import { describe, expect, it } from "vitest"
import { dataDir, parseEvalArgs } from "../../scripts/lib/eval-args.js"

describe("parseEvalArgs", () => {
  it("takes a game id and switches", () => {
    expect(parseEvalArgs([])).toEqual({ gameId: null, previous: true, data: null })
    expect(parseEvalArgs(["12", "--no-previous", "--data", "/tmp/qp"])).toEqual({
      gameId: 12,
      previous: false,
      data: "/tmp/qp",
    })
  })

  it("rejects anything else", () => {
    expect(parseEvalArgs(["abc"])).toHaveProperty("error")
    expect(parseEvalArgs(["--data"])).toHaveProperty("error")
    expect(parseEvalArgs(["--fast"])).toHaveProperty("error")
  })
})

describe("dataDir", () => {
  it("finds the app's data folder like Electron does", () => {
    expect(dataDir("darwin", {}, "/Users/a")).toBe("/Users/a/Library/Application Support/QuizPilot")
    expect(dataDir("win32", { APPDATA: "C:\\Users\\a\\AppData\\Roaming" }, "C:\\Users\\a")).toBe(
      "C:\\Users\\a\\AppData\\Roaming/QuizPilot",
    )
    expect(dataDir("linux", {}, "/home/a")).toBe("/home/a/.config/QuizPilot")
    expect(dataDir("linux", { XDG_CONFIG_HOME: "/xdg" }, "/home/a")).toBe("/xdg/QuizPilot")
  })
})
