export function timeoutSignal(ms: number) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error("timeout")), Math.max(0, ms))
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
    abort: () => {
      clearTimeout(timer)
      controller.abort(new Error("aborted"))
    },
  }
}

export function abortable<T>(promise: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason)
    const onAbort = () => reject(signal.reason)
    signal.addEventListener("abort", onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort)
        resolve(value)
      },
      (err: unknown) => {
        signal.removeEventListener("abort", onAbort)
        reject(err)
      },
    )
  })
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  const t = timeoutSignal(ms)
  try {
    return await abortable(promise, t.signal)
  } catch {
    return fallback
  } finally {
    t.cancel()
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)))
}
