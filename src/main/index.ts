import { rename } from "node:fs/promises"
import { join } from "node:path"
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron"
import { withTimeout } from "../core/util/async.js"
import { GAME_EVENT_CHANNEL } from "../shared/api.js"
import { removeFallback, saveFallback } from "./fallback.js"
import { GameController } from "./game-controller.js"
import { registerIpc } from "./ipc.js"
import { createSession } from "./session-factory.js"
import { DEFAULT_CONFIG, loadConfig, SettingsStore, toPublic } from "./settings.js"
import { checkTypesafeKey } from "./typesafe.js"

let win: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  const w = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: "QuizPilot",
    show: false,
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

async function start(): Promise<void> {
  const settings = await openSettings(join(app.getPath("userData"), "config.json"))
  if (!settings) return app.quit()

  const controller = new GameController({
    createSession: (request) => createSession(request, settings.get()),
    send: (event) => {
      if (win && !win.isDestroyed()) win.webContents.send(GAME_EVENT_CHANNEL, event)
    },
  })

  registerIpc(ipcMain, {
    getSettings: async () => toPublic(settings.get()),
    saveTypesafeKey: async (key) => {
      const check = await checkTypesafeKey(key)
      if (check === "ok") {
        await settings.update((c) => ({ ...c, keys: { ...c.keys, typesafe: key.trim() } }))
      }
      return check
    },
    saveFallback: (setup) => saveFallback(settings, setup),
    removeFallback: () => removeFallback(settings),
    startGame: async (request) => {
      const result = await controller.start(request)
      if (result.ok) {
        await settings.update((c) => ({
          ...c,
          context: { ...c.context, includePrevious: request.includePrevious },
          behavior: { ...c.behavior, timing: request.timing },
        }))
      }
      return result
    },
    addBot: (name) => controller.addBot(name),
    submitTwoStep: (sequence) => controller.submitTwoStep(sequence),
    pause: async (bot, paused) => controller.pause(bot, paused),
    leave: (bot) => controller.leave(bot),
    endGame: () => controller.end(),
    openExternal: async (url) => {
      if (url.startsWith("https://")) await shell.openExternal(url)
    },
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
  void app.whenReady().then(start)
}
