import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { abortable, timeoutSignal, withTimeout } from "../../../src/core/util/async.js"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const never = () => new Promise<never>(() => {})

describe("timeoutSignal", () => {
  it("aborts after the given time unless cancelled", async () => {
    const a = timeoutSignal(100)
    const b = timeoutSignal(100)
    b.cancel()
    await vi.advanceTimersByTimeAsync(100)
    expect(a.signal.aborted).toBe(true)
    expect(b.signal.aborted).toBe(false)
  })

  it("treats negative times as zero", async () => {
    const t = timeoutSignal(-500)
    await vi.advanceTimersByTimeAsync(0)
    expect(t.signal.aborted).toBe(true)
  })
})

describe("abortable", () => {
  it("rejects when the signal fires first", async () => {
    const t = timeoutSignal(50)
    const p = abortable(never(), t.signal)
    const check = expect(p).rejects.toThrow()
    await vi.advanceTimersByTimeAsync(50)
    await check
  })

  it("passes the value through", async () => {
    await expect(abortable(Promise.resolve(3), new AbortController().signal)).resolves.toBe(3)
  })
})

describe("withTimeout", () => {
  it("returns the fallback on timeout or error", async () => {
    const slow = withTimeout(never(), 3000, null)
    await vi.advanceTimersByTimeAsync(3000)
    await expect(slow).resolves.toBeNull()
    await expect(withTimeout(Promise.reject(new Error("x")), 3000, "f")).resolves.toBe("f")
  })
})
