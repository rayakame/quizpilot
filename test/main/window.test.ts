import { describe, expect, it } from "vitest"
import { frameOptions } from "../../src/main/window.js"

describe("frameOptions", () => {
  it("hides the title bar on macOS and puts the window buttons into the header", () => {
    expect(frameOptions("darwin")).toEqual({
      titleBarStyle: "hidden",
      trafficLightPosition: { x: 16, y: 16 },
    })
  })

  it.each(["win32", "linux"] as const)("keeps the native frame on %s", (platform) => {
    expect(frameOptions(platform)).toEqual({})
  })
})
