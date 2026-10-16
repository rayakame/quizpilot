import { mkdirSync } from "node:fs"
import { mkdir, rename, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  shell,
} from "electron"
import { createImageLoader } from "../core/media/image-loader.js"
import { withTimeout } from "../core/util/async.js"
import { GAME_EVENT_CHANNEL, OPEN_SETTINGS_CHANNEL } from "../shared/api.js"
import { removeFallback, saveFallback } from "./fallback.js"
import { GameController } from "./game-controller.js"
import { historyHandlers } from "./history/handlers.js"
import { HistoryRecorder } from "./history/recorder.js"
import { HistoryStore } from "./history/store.js"
import { registerIpc } from "./ipc.js"
import { menuTemplate } from "./menu.js"
import { QuizCache } from "./quiz.js"
import { createSession } from "./session-factory.js"
import { applyPatch, DEFAULT_CONFIG, loadConfig, SettingsStore, toPublic } from "./settings.js"
import { checkTypesafeKey } from "./typesafe.js"
import { frameOptions } from "./window.js"

let win: BrowserWindow | null = null
const icon = () => join(app.getAppPath(), "resources/icon.png")

function createWindow(): BrowserWindow {
  const w = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: "QuizPilot",
    icon: icon(),
    show: false,
    ...frameOptions(process.platform),
    webPreferences: { preload: join(import.meta.dirname, "../preload/index.cjs") },
  })
  w.once("ready-to-show", () => w.show())
  w.webContents.setWindowOpenHandler(() => ({ action: "deny" }))
  w.webContents.on("will-navigate", (event) => event.preventDefault())
  const devUrl = process.env["ELECTRON_RENDERER_URL"]
  if (devUrl) void w.loadURL(devUrl)
  else void w.loadFile(join(import.meta.dirname, "../renderer/index.html"))
  return w
}

async function openSettings(file: string): Promise<SettingsStore | null> {
  const loaded = await loadConfig(file)
  if (loaded.ok) return new SettingsStore(file, loaded.config)
  const { response } = await dialog.showMessageBox({
    type: "warning",
    message: "QuizPilot couldn't read its settings.",
    detail: `${file}\n\n${loaded.error}`,
    buttons: ["Reset settings", "Quit"],
    defaultId: 0,
    cancelId: 1,
  })
  if (response !== 0) return null
  await rename(file, `${file}.broken`).catch(() => {})
  return new SettingsStore(file, structuredClone(DEFAULT_CONFIG))
}

function openHistory(dir: string): HistoryStore | null {
  try {
    mkdirSync(dir, { recursive: true })
    return HistoryStore.open(join(dir, "history.db"))
  } catch (err) {
    console.error("Couldn't open the game history", err)
    return null
  }
}

async function confirm(message: string, button: string): Promise<boolean> {
  const options = {
    type: "warning" as const,
    message,
    buttons: [button, "Cancel"],
    defaultId: 1,
    cancelId: 1,
  }
  const { response } = win
    ? await dialog.showMessageBox(win, options)
    : await dialog.showMessageBox(options)
  return response === 0
}

async function start(): Promise<void> {
  const settings = await openSettings(join(app.getPath("userData"), "config.json"))
  if (!settings) return app.quit()
  nativeTheme.themeSource = settings.get().ui.theme

  const historyDir = join(app.getPath("userData"), "history")
  const history = openHistory(historyDir)
  const download = createImageLoader()
  const recorder = history
    ? new HistoryRecorder({
        store: history,
        enabled: () => settings.get().history.enabled,
        saveImage: async (gameId, index, url) => {
          const bytes = await download({ url })
          if (!bytes) return null
          const dir = join(historyDir, String(gameId))
          await mkdir(dir, { recursive: true })
          const file = join(dir, `${index}.jpg`)
          await writeFile(file, bytes)
          return file
        },
        now: Date.now,
        log: (message, err) => console.error(message, err),
      })
    : undefined

  const quizzes = new QuizCache()
  const controller = new GameController({
    createSession: (request, quiz) => createSession(request, settings.get(), quiz),
    loadQuiz: (link) => quizzes.get(link),
    send: (event) => {
      if (win && !win.isDestroyed()) win.webContents.send(GAME_EVENT_CHANNEL, event)
    },
    recorder,
  })

  registerIpc(ipcMain, {
    getSettings: async () => toPublic(settings.get()),
    saveSettings: async (patch) => {
      await settings.update((c) => applyPatch(c, patch))
      nativeTheme.themeSource = settings.get().ui.theme
      return toPublic(settings.get())
    },
    getAppInfo: async () => ({ version: app.getVersion() }),
    saveTypesafeKey: async (key) => {
      const check = await checkTypesafeKey(key)
      if (check === "ok") {
        await settings.update((c) => ({ ...c, keys: { ...c.keys, typesafe: key.trim() } }))
      }
      return check
    },
    saveFallback: (setup) => saveFallback(settings, setup),
    removeFallback: () => removeFallback(settings),
    checkQuizLink: (link) => quizzes.check(link),
    startGame: (request) => controller.start(request),
    addBot: (name) => controller.addBot(name),
    submitTwoStep: (sequence) => controller.submitTwoStep(sequence),
    pause: async (bot, paused) => controller.pause(bot, paused),
    leave: (bot) => controller.leave(bot),
    endGame: () => controller.end(),
    openExternal: async (url) => {
      if (url.startsWith("https://")) await shell.openExternal(url)
    },
    ...historyHandlers({
      store: history,
      currentGameId: () => recorder?.gameId ?? null,
      confirm,
      removeImages: (id) => rm(join(historyDir, String(id)), { recursive: true, force: true }),
      chooseFile: async (name) => {
        const options = {
          defaultPath: `${name}.json`,
          filters: [
            { name: "JSON", extensions: ["json"] },
            { name: "CSV", extensions: ["csv"] },
          ],
        }
        const { canceled, filePath } = win
          ? await dialog.showSaveDialog(win, options)
          : await dialog.showSaveDialog(options)
        return canceled || !filePath ? null : filePath
      },
      writeFile: (path, text) => writeFile(path, text),
    }),
  })

  let quitting = false
  app.on("before-quit", (event) => {
    if (quitting || !controller.active) return
    event.preventDefault()
    quitting = true
    // Leave properly so the bots disappear from the host's lobby.
    void withTimeout(controller.end(), 2000, undefined).finally(() => app.quit())
  })
  app.on("window-all-closed", () => app.quit())
  app.on("will-quit", () => history?.close())

  const isMac = process.platform === "darwin"
  // Packaged builds take the dock icon from the bundle.
  const dockIcon = nativeImage.createFromPath(icon())
  if (isMac && !app.isPackaged && !dockIcon.isEmpty()) app.dock?.setIcon(dockIcon)
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      menuTemplate(isMac, !app.isPackaged, () => {
        if (win && !win.isDestroyed()) win.webContents.send(OPEN_SETTINGS_CHANNEL)
      }),
    ),
  )

  win = createWindow()
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on("second-instance", () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })
  app
    .whenReady()
    .then(start)
    .catch((err: unknown) => {
      dialog.showErrorBox(
        "QuizPilot couldn't start",
        err instanceof Error ? err.message : String(err),
      )
      app.quit()
    })
}
