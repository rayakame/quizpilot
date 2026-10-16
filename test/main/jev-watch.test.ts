import { APIConnectionError, AuthenticationError } from "@typesafe-ai/sdk"
import { describe, expect, it, vi } from "vitest"
import type { JevApi } from "../../src/core/providers/jev.js"
import { watchJev } from "../../src/main/jev-watch.js"

const failing = (err: unknown): JevApi => ({
  chooseOne: vi.fn(() => Promise.reject(err)),
  checkEach: vi.fn(() => Promise.reject(err)),
  placeEach: vi.fn(() => Promise.reject(err)),
  estimateNumber: vi.fn(() => Promise.reject(err)),
})
const input = {} as never
const live = { signal: new AbortController().signal }
const hooks = () => ({ failed: vi.fn(), keyRejected: vi.fn() })

describe("watchJev", () => {
  it("logs failures and still rejects", async () => {
    const h = hooks()
    const err = new APIConnectionError("fetch failed")
    await expect(watchJev(failing(err), h).chooseOne(input, live)).rejects.toBe(err)
    expect(h.failed).toHaveBeenCalledWith(err)
    expect(h.keyRejected).not.toHaveBeenCalled()
  })

  it("reports a rejected key once", async () => {
    const h = hooks()
    const jev = watchJev(failing(new AuthenticationError(401, {}, new Headers())), h)
    await jev.chooseOne(input, live).catch(() => {})
    await jev.checkEach(input, live).catch(() => {})
    expect(h.keyRejected).toHaveBeenCalledTimes(1)
  })

  it("stays quiet when the engine gave up on Jev", async () => {
    const h = hooks()
    const controller = new AbortController()
    controller.abort()
    await watchJev(failing(new Error("aborted")), h)
      .placeEach(input, { signal: controller.signal })
      .catch(() => {})
    expect(h.failed).not.toHaveBeenCalled()
  })
})
