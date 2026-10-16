import { describe, expect, it, vi } from "vitest"
import { ASSETS, assetUrl, detectPlatform, latestVersion } from "../../site/src/lib/download.js"
import { installerNames } from "../support/installers.js"

const UA = {
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0",
  ubuntu: "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0",
  android:
    "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36",
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
  ipad: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
}

describe("detectPlatform", () => {
  it("knows the desktop systems", () => {
    expect(detectPlatform(UA.macSafari, "MacIntel", 0)).toBe("mac")
    expect(detectPlatform(UA.macChrome, "MacIntel", 0)).toBe("mac")
    expect(detectPlatform(UA.windows, "Win32", 0)).toBe("windows")
    expect(detectPlatform(UA.ubuntu, "Linux x86_64", 0)).toBe("linux")
  })

  it("offers no desktop download on phones and tablets", () => {
    expect(detectPlatform(UA.android, "Linux armv81", 5)).toBe("other")
    expect(detectPlatform(UA.iphone, "iPhone", 5)).toBe("other")
    // iPads ask for the desktop site and only give themselves away by touch.
    expect(detectPlatform(UA.ipad, "MacIntel", 5)).toBe("other")
  })
})

describe("downloads", () => {
  it("link to files that every release has", () => {
    expect(Object.values(ASSETS)).toEqual(installerNames())
    expect(assetUrl("macArm")).toBe(
      "https://github.com/rayakame/quizpilot/releases/latest/download/QuizPilot-arm64.dmg",
    )
  })
})

describe("latestVersion", () => {
  const reply = (status: number, body: string) =>
    vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch

  it("reads the tag of the latest release", async () => {
    expect(await latestVersion(reply(200, JSON.stringify({ tag_name: "v0.2.0" })))).toBe("0.2.0")
  })

  it("gives nothing when there's no release or GitHub won't answer", async () => {
    expect(await latestVersion(reply(404, "{}"))).toBeNull()
    expect(await latestVersion(reply(403, "{}"))).toBeNull()
    expect(await latestVersion(reply(200, "not json"))).toBeNull()
    expect(await latestVersion(reply(200, JSON.stringify({ name: "x" })))).toBeNull()
    const offline = vi.fn(async () => Promise.reject(new TypeError("fetch failed")))
    expect(await latestVersion(offline as unknown as typeof fetch)).toBeNull()
  })
})
