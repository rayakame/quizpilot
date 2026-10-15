import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { vi } from "vitest"
import type { KahootClientLike } from "../../src/core/kahoot/adapter.js"

export class FakeKahootClient implements KahootClientLike {
  handlers: Record<string, (message: unknown) => void> = {}
  clientId = "client-1"
  join = vi.fn<KahootClientLike["join"]>(async () => ({}))
  answer = vi.fn<KahootClientLike["answer"]>(async () => ({}))
  leave = vi.fn<KahootClientLike["leave"]>(async () => ({}))
  reconnect = vi.fn<KahootClientLike["reconnect"]>(async () => ({}))
  _send = vi.fn<KahootClientLike["_send"]>(async () => ({}))
  quiz?: { currentQuestion?: Record<string, unknown> }
  private listeners = new Map<string, ((...args: never[]) => void)[]>()

  // Like kahoot.js: only the first message of a frame reaches the handlers.
  _message(frame: string) {
    const [first] = JSON.parse(frame) as unknown[]
    this.raw(first)
  }

  on(event: string, listener: (...args: never[]) => void) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener])
    return this
  }

  fire(event: string, payload: unknown) {
    for (const fn of this.listeners.get(event) ?? []) (fn as (p: unknown) => void)(payload)
  }

  raw(message: unknown) {
    for (const handler of Object.values(this.handlers)) handler(message)
  }

  replay(dir: string) {
    for (const file of readdirSync(dir).sort()) {
      const data: unknown = JSON.parse(readFileSync(join(dir, file), "utf8"))
      const event = /^\d+-event-(.+)\.json$/.exec(file)?.[1]
      if (event) this.fire(event, data)
      else this.raw(data)
    }
  }
}
