import { describe, expect, it, vi } from "vitest"
import { registerIpc, type Handlers } from "../../src/main/ipc.js"
import { CHANNELS } from "../../src/shared/api.js"

function handlers(): Handlers {
  return {
    getSettings: vi.fn(),
    saveTypesafeKey: vi.fn(),
    saveFallback: vi.fn(),
    removeFallback: vi.fn(),
    startGame: vi.fn(),
    addBot: vi.fn(),
    submitTwoStep: vi.fn(),
    pause: vi.fn(),
    leave: vi.fn(),
    endGame: vi.fn(),
    openExternal: vi.fn(),
  }
}

describe("registerIpc", () => {
  it("answers every channel the window can call", () => {
    const registered = new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
    const h = handlers()
    registerIpc({ handle: (channel, listener) => registered.set(channel, listener) }, h)
    expect([...registered.keys()].sort()).toEqual(Object.values(CHANNELS).sort())
    registered.get(CHANNELS.pause)!({ sender: {} }, "Anna", true)
    expect(h.pause).toHaveBeenCalledWith("Anna", true)
  })
})
