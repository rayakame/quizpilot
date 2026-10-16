import { describe, expect, it, vi } from "vitest"
import { historyHandlers, type HistoryHandlerDeps } from "../../src/main/history/handlers.js"
import { HistoryStore } from "../../src/main/history/store.js"
import type { NewGame } from "../../src/shared/api.js"

const game = (quizTitle: string, startedAt: number): NewGame => ({
  pin: "916240",
  quizTitle,
  quizId: null,
  context: null,
  quizLink: null,
  timing: { mode: "instant", minMs: 0, maxMs: 0 },
  includePrevious: true,
  startedAt,
})

function setup(over: Partial<HistoryHandlerDeps> = {}) {
  const store = HistoryStore.open(":memory:")
  const older = store.startGame(game("Older", 1000))
  const newer = store.startGame(game("Newer", 2000))
  const deps: HistoryHandlerDeps = {
    store,
    currentGameId: () => newer,
    confirm: vi.fn(async () => true),
    removeImages: vi.fn(async () => {}),
    chooseFile: vi.fn(async (name: string) => `/out/${name}.json`),
    writeFile: vi.fn(async () => {}),
    ...over,
  }
  return { store, older, newer, deps, handlers: historyHandlers(deps) }
}

describe("historyHandlers", () => {
  it("rejects ids that are not game ids", async () => {
    const { deps, handlers } = setup()
    for (const id of ["..", "../..", 1.5, -1, 0, null]) {
      expect(await handlers.getHistory(id as never)).toBeNull()
      expect(await handlers.deleteHistory(id as never)).toBe(false)
    }
    expect(await handlers.exportHistory("1" as never)).toBe("missing")
    expect(deps.removeImages).not.toHaveBeenCalled()
    expect(deps.confirm).not.toHaveBeenCalled()
  })

  it("removes the pictures only of a game that existed", async () => {
    const { older, deps, handlers } = setup()
    expect(await handlers.deleteHistory(older)).toBe(true)
    expect(deps.removeImages).toHaveBeenCalledWith(older)
    expect(await handlers.deleteHistory(older)).toBe(false)
    expect(deps.removeImages).toHaveBeenCalledTimes(1)
  })

  it("exports the game that was just played, not the newest one in the list", async () => {
    const { older, deps, handlers } = setup({ currentGameId: () => null })
    const h = historyHandlers({ ...deps, currentGameId: () => older })
    expect(await h.exportHistory(null)).toBe("saved")
    expect(deps.chooseFile).toHaveBeenCalledWith(expect.stringContaining("older"))
    expect(await handlers.exportHistory(null)).toBe("missing")
  })

  it("writes JSON or CSV by the chosen file name", async () => {
    const { newer, deps, handlers } = setup({ chooseFile: vi.fn(async () => "/out/game.CSV") })
    expect(await handlers.exportHistory(newer)).toBe("saved")
    expect(vi.mocked(deps.writeFile).mock.calls[0]![1]).toMatch(/^\uFEFFquestion,type/)
  })

  it("does nothing when the user cancels", async () => {
    const { newer, deps, handlers } = setup({
      confirm: vi.fn(async () => false),
      chooseFile: vi.fn(async () => null),
    })
    expect(await handlers.deleteHistory(newer)).toBe(false)
    expect(await handlers.exportHistory(newer)).toBe("cancelled")
    expect(deps.writeFile).not.toHaveBeenCalled()
  })
})
