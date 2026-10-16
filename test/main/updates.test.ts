import { describe, expect, it, vi } from "vitest"
import {
  latestRelease,
  newerVersion,
  updateMode,
  Updates,
  type UpdateDeps,
} from "../../src/main/updates.js"

const PAGE = "https://github.com/rayakame/quizpilot/releases/tag/v0.2.0"

describe("newerVersion", () => {
  it("compares numbers, not text", () => {
    expect(newerVersion("v0.10.0", "0.9.3")).toBe(true)
    expect(newerVersion("0.2.0", "0.2.0")).toBe(false)
    expect(newerVersion("0.1.9", "0.2.0")).toBe(false)
    expect(newerVersion("1.0", "0.9.9")).toBe(true)
  })

  it("never offers a pre-release or nonsense", () => {
    expect(newerVersion("0.3.0-beta.1", "0.2.0")).toBe(false)
    expect(newerVersion("latest", "0.2.0")).toBe(false)
  })
})

describe("updateMode", () => {
  it("only installs where electron-updater can", () => {
    expect(updateMode("darwin", true, false)).toBe("notify")
    expect(updateMode("win32", true, false)).toBe("download")
    expect(updateMode("linux", true, true)).toBe("download")
    expect(updateMode("linux", true, false)).toBe("notify")
    expect(updateMode("win32", false, false)).toBe("off")
  })
})

describe("latestRelease", () => {
  const reply = (status: number, body: unknown) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch

  it("reads the version and page of the latest release", async () => {
    const fetchFn = reply(200, { tag_name: "v0.2.0", html_url: PAGE })
    expect(await latestRelease("rayakame/quizpilot", fetchFn)).toEqual({
      version: "0.2.0",
      url: PAGE,
    })
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.github.com/repos/rayakame/quizpilot/releases/latest",
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: "application/vnd.github+json" }),
      }),
    )
  })

  it("gives nothing for missing releases, rate limits and odd answers", async () => {
    const repo = "rayakame/quizpilot"
    expect(await latestRelease(repo, reply(404, { message: "Not Found" }))).toBeNull()
    expect(await latestRelease(repo, reply(403, { message: "rate limit" }))).toBeNull()
    expect(await latestRelease(repo, reply(200, { tag_name: 3 }))).toBeNull()
    expect(
      await latestRelease(repo, reply(200, { tag_name: "v1.0.0", html_url: "http://evil" })),
    ).toBeNull()
  })
})

function setup(over: Partial<UpdateDeps> = {}) {
  const deps: UpdateDeps = {
    mode: "notify",
    current: "0.1.0",
    latest: vi.fn(async () => ({ version: "0.2.0", url: PAGE })),
    downloader: null,
    beforeInstall: vi.fn(async () => {}),
    log: vi.fn(),
    ...over,
  }
  return { deps, updates: new Updates(deps) }
}

describe("Updates", () => {
  it("points Mac users to the download page", async () => {
    const { updates } = setup()
    const seen = vi.fn()
    updates.onChange(seen)
    expect(await updates.check()).toEqual({ kind: "available", version: "0.2.0", url: PAGE })
    expect(seen).toHaveBeenCalledTimes(1)
  })

  it("stays quiet when nothing is newer or GitHub can't be reached", async () => {
    const same = setup({ latest: async () => ({ version: "0.1.0", url: PAGE }) })
    expect(await same.updates.check()).toEqual({ kind: "none" })
    const failing = setup({ latest: async () => Promise.reject(new Error("offline")) })
    expect(await failing.updates.check()).toEqual({ kind: "none" })
    expect(failing.deps.log).toHaveBeenCalled()
  })

  it("lets electron-updater download on Windows and Linux", async () => {
    const downloader = { check: vi.fn(async () => {}), install: vi.fn() }
    const { updates, deps } = setup({ mode: "download", downloader })
    await updates.check()
    expect(downloader.check).toHaveBeenCalled()
    expect(deps.latest).not.toHaveBeenCalled()
    updates.downloaded("0.2.0")
    expect(updates.state).toEqual({ kind: "ready", version: "0.2.0" })
  })

  it("leaves the game before installing", async () => {
    const order: string[] = []
    const downloader = { check: async () => {}, install: () => void order.push("install") }
    const { updates } = setup({
      mode: "download",
      downloader,
      beforeInstall: async () => void order.push("leave"),
    })
    updates.downloaded("0.2.0")
    await updates.install()
    expect(order).toEqual(["leave", "install"])
  })

  it("does nothing while switched off", async () => {
    const { updates, deps } = setup({ mode: "off" })
    expect(await updates.check()).toEqual({ kind: "off" })
    expect(deps.latest).not.toHaveBeenCalled()
  })

  it("only installs a downloaded update", async () => {
    const downloader = { check: async () => {}, install: vi.fn() }
    const { updates } = setup({ mode: "download", downloader })
    await updates.install()
    expect(downloader.install).not.toHaveBeenCalled()
  })
})
