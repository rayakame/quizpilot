import type { ExportResult, HistoryGame, HistoryRecord } from "../../shared/api.js"
import type { Messages } from "../../shared/i18n/index.js"
import { exportName, toCsv, toJson } from "./export.js"
import type { HistoryStore } from "./store.js"

export interface HistoryHandlerDeps {
  store: HistoryStore | null
  currentGameId(): number | null
  confirm(message: string, button: string): Promise<boolean>
  removeImages(id: number): Promise<void>
  chooseFile(defaultName: string): Promise<string | null>
  writeFile(path: string, text: string): Promise<void>
  text(): Messages["dialogs"]
}

export function historyHandlers(deps: HistoryHandlerDeps) {
  const { store } = deps
  return {
    listHistory: async (): Promise<HistoryGame[]> => store?.listGames() ?? [],
    getHistory: async (id: unknown): Promise<HistoryRecord | null> =>
      store && isGameId(id) ? store.getGame(id) : null,
    deleteHistory: async (id: unknown): Promise<boolean> => {
      if (!store || !isGameId(id) || !store.getGame(id)) return false
      const text = deps.text()
      if (!(await deps.confirm(text.deleteGame, text.delete))) return false
      if (!store.deleteGame(id)) return false
      await deps.removeImages(id)
      return true
    },
    clearHistory: async (): Promise<boolean> => {
      const count = store?.listGames().length ?? 0
      if (!store || count === 0) return false
      const text = deps.text()
      if (!(await deps.confirm(text.deleteGames(count), text.delete))) return false
      for (const id of store.deleteAll()) await deps.removeImages(id)
      return true
    },
    exportHistory: async (id: unknown): Promise<ExportResult> => {
      const gameId = id === null ? deps.currentGameId() : isGameId(id) ? id : null
      const record = store && gameId !== null ? store.getGame(gameId) : null
      if (!record) return "missing"
      const file = await deps.chooseFile(exportName(record))
      if (!file) return "cancelled"
      const csv = file.toLowerCase().endsWith(".csv")
      await deps.writeFile(file, csv ? toCsv(record) : toJson(record))
      return "saved"
    },
  }
}

// Ids come from the window; a crafted one must never become a path outside the history folder.
function isGameId(id: unknown): id is number {
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0
}
