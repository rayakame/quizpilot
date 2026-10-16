import { mkdirSync } from "node:fs"
import { mkdir, rename, rm, writeFile } from "node:fs/promises"
import { release } from "node:os"
import { join } from "node:path"
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  Notification,
  shell,
  type FileFilter,
} from "electron"
import updater from "electron-updater"
import { createImageLoader } from "../core/media/image-loader.js"
import { withTimeout } from "../core/util/async.js"
import {
  GAME_EVENT_CHANNEL,
  OPEN_SETTINGS_CHANNEL,
  UPDATE_CHANNEL,
  type GameEvent,
} from "../shared/api.js"
import { messagesFor, pickLanguage, type Language } from "../shared/i18n/index.js"
import { diagnosticsName, diagnosticsReport } from "./diagnostics.js"
import { removeFallback, saveFallback } from "./fallback.js"
import { GameController } from "./game-controller.js"
import type { LogEntry } from "./game-log.js"
import { historyHandlers } from "./history/handlers.js"
import { HistoryRecorder } from "./history/recorder.js"
import { HistoryStore } from "./history/store.js"
import { registerIpc } from "./ipc.js"
import { Logger } from "./log.js"
import { menuTemplate } from "./menu.js"
import { Notifier } from "./notifier.js"
import { QuizCache } from "./quiz.js"
import { createSession } from "./session-factory.js"
import { applyPatch, freshConfig, loadConfig, SettingsStore, toPublic } from "./settings.js"
import { checkTypesafeKey } from "./typesafe.js"
import {
  CHECK_EVERY_MS,
  FIRST_CHECK_MS,
  latestRelease,
  updateMode,
  Updates,
  type Downloader,
} from "./updates.js"
import { frameOptions } from "./window.js"

const REPO = "rayakame/quizpilot"

let win: BrowserWindow | null = null
const icon = () => join(app.getAppPath(), "resources/icon.png")

function createWindow(log: Logger): BrowserWindow {
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
  w.webContents.on("console-message", (e) => {
    if (e.level === "error") log.error("Window", e.message)
  })
  w.webContents.on("render-process-gone", (_e, details) => log.error("Window gone", details.reason))
  const devUrl = process.env["ELECTRON_RENDERER_URL"]
  if (devUrl) void w.loadURL(devUrl)
  else void w.loadFile(join(import.meta.dirname, "../renderer/index.html"))
  return w
}

async function openSettings(
  file: string,
  language: Language,
  log: Logger,
): Promise<SettingsStore | null> {
  const loaded = await loadConfig(file, () => freshConfig(language))
  if (loaded.ok) return new SettingsStore(file, loaded.config)
  // The parse error quotes the file, keys included, and they aren't known yet to hide them.
  log.warn("Settings unreadable")
  const text = messagesFor(language).dialogs
  const { response } = await dialog.showMessageBox({
    type: "warning",
    message: text.settingsBroken,
    detail: `${file}\n\n${loaded.error}`,
    buttons: [text.resetSettings, text.quit],
    defaultId: 0,
    cancelId: 1,
  })
  if (response !== 0) return null
  await rename(file, `${file}.broken`).catch(() => {})
  return new SettingsStore(file, freshConfig(language))
}

function openHistory(dir: string, log: Logger): HistoryStore | null {
  try {
    mkdirSync(dir, { recursive: true })
    return HistoryStore.open(join(dir, "history.db"))
  } catch (err) {
    log.error("Couldn't open the game history", err)
    return null
  }
}

async function confirm(message: string, button: string, cancel: string): Promise<boolean> {
  const options = {
    type: "warning" as const,
    message,
    buttons: [button, cancel],
    defaultId: 1,
    cancelId: 1,
  }
  const { response } = win
    ? await dialog.showMessageBox(win, options)
    : await dialog.showMessageBox(options)
  return response === 0
}

async function chooseSaveFile(defaultPath: string, filters: FileFilter[]): Promise<string | null> {
  const options = { defaultPath, filters }
  const { canceled, filePath } = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options)
  return canceled || !filePath ? null : filePath
}

async function start(): Promise<void> {
  let secrets = (): readonly string[] => []
  const log = new Logger({
    file: join(app.getPath("logs"), "main.log"),
    secrets: () => secrets(),
    echo: app.isPackaged ? undefined : (line) => process.stdout.write(line),
  })
  process.on("uncaughtExceptionMonitor", (err) => log.error("Uncaught", err))
  process.on("unhandledRejection", (reason) => log.error("Unhandled rejection", reason))
  log.info(
    `QuizPilot ${app.getVersion()} on ${process.platform} ${release()} ${process.arch}, Electron ${process.versions.electron}`,
  )

  const systemLanguage = pickLanguage(app.getPreferredSystemLanguages())
  const file = join(app.getPath("userData"), "config.json")
  const settings = await openSettings(file, systemLanguage, log)
  if (!settings) return app.quit()
  secrets = () => Object.values(settings.get().keys)
  const text = () => messagesFor(settings.get().ui.language)
  nativeTheme.themeSource = settings.get().ui.theme

  const historyDir = join(app.getPath("userData"), "history")
  const history = openHistory(historyDir, log)
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
        log: (message, err) => log.error(message, err),
      })
    : undefined

  const quizzes = new QuizCache()
  const writeEntry = (entry: LogEntry) => log.write(entry.level, entry.message, entry.detail)
  const shown = new Set<Notification>()
  const notifier = new Notifier({
    show: (title, body) => {
      if (!Notification.isSupported()) return
      const note = new Notification({ title, body })
      // Without a reference the click handler is collected before anyone clicks.
      shown.add(note)
      note.on("click", () => {
        shown.delete(note)
        if (!win || win.isDestroyed()) return
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
      })
      note.on("close", () => shown.delete(note))
      note.show()
    },
    focused: () => win !== null && !win.isDestroyed() && win.isFocused(),
    enabled: () => settings.get().behavior.notify,
    text: () => text().notify,
    later: (run, ms) => void setTimeout(run, ms),
  })
  const emit = (event: GameEvent) => {
    if (win && !win.isDestroyed()) win.webContents.send(GAME_EVENT_CHANNEL, event)
    notifier.event(event)
  }
  const controller = new GameController({
    createSession: (request, quiz) =>
      createSession(request, settings.get(), quiz, {
        log: writeEntry,
        keyRejected: () => emit({ type: "notice", notice: "jev_key" }),
      }),
    loadQuiz: (link) => quizzes.get(link),
    send: emit,
    recorder,
    log: writeEntry,
  })

  const mode = updateMode(process.platform, app.isPackaged, Boolean(process.env["APPIMAGE"]))
  let downloader: Downloader | null = null
  if (mode === "download") {
    const { autoUpdater } = updater
    autoUpdater.logger = null
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.on("update-downloaded", (info) => updates.downloaded(info.version))
    autoUpdater.on("error", (err) => log.warn("Update failed", err))
    downloader = {
      check: async () => {
        const result = await autoUpdater.checkForUpdates()
        return result?.isUpdateAvailable ? result.updateInfo.version : null
      },
      install: () => autoUpdater.quitAndInstall(),
    }
  }
  const updates = new Updates({
    mode,
    current: app.getVersion(),
    latest: () => latestRelease(REPO, fetch),
    downloader,
    beforeInstall: () => withTimeout(controller.end(), 2000, undefined),
    log: (message, err) => log.warn(message, err),
  })
  updates.onChange((state) => {
    if (win && !win.isDestroyed()) win.webContents.send(UPDATE_CHANNEL, state)
  })
  if (mode !== "off") {
    setTimeout(() => void updates.check(), FIRST_CHECK_MS)
    setInterval(() => void updates.check(), CHECK_EVERY_MS)
  }

  registerIpc(ipcMain, {
    getSettings: async () => toPublic(settings.get()),
    saveSettings: async (patch) => {
      const language = settings.get().ui.language
      await settings.update((c) => applyPatch(c, patch))
      nativeTheme.themeSource = settings.get().ui.theme
      if (settings.get().ui.language !== language) buildMenu()
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
    startGame: (request) => {
      notifier.reset()
      return controller.start(request)
    },
    addBot: (name) => controller.addBot(name),
    submitTwoStep: (sequence) => controller.submitTwoStep(sequence),
    pause: async (bot, paused) => controller.pause(bot, paused),
    leave: (bot) => controller.leave(bot),
    endGame: () => controller.end(),
    getUpdate: async () => updates.state,
    checkForUpdates: () => updates.check(),
    installUpdate: () => updates.install(),
    saveDiagnostics: async () => {
      const report = diagnosticsReport(
        {
          version: app.getVersion(),
          electron: process.versions.electron,
          chrome: process.versions.chrome,
          node: process.versions.node,
          os: `${process.platform} ${release()} ${process.arch}`,
          systemLanguages: app.getPreferredSystemLanguages(),
        },
        settings.get(),
        await log.read(),
        new Date(),
      )
      const file = await chooseSaveFile(`${diagnosticsName(new Date())}.txt`, [
        { name: text().dialogs.textFile, extensions: ["txt"] },
      ])
      if (!file) return "cancelled"
      await writeFile(file, report, { mode: 0o600 })
      return "saved"
    },
    openExternal: async (url) => {
      if (url.startsWith("https://")) await shell.openExternal(url)
    },
    ...historyHandlers({
      store: history,
      currentGameId: () => recorder?.gameId ?? null,
      confirm: (message, button) => confirm(message, button, text().dialogs.cancel),
      text: () => text().dialogs,
      removeImages: (id) => rm(join(historyDir, String(id)), { recursive: true, force: true }),
      chooseFile: (name) =>
        chooseSaveFile(`${name}.json`, [
          { name: "JSON", extensions: ["json"] },
          { name: "CSV", extensions: ["csv"] },
        ]),
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
  function buildMenu() {
    const openSettings = () => {
      if (win && !win.isDestroyed()) win.webContents.send(OPEN_SETTINGS_CHANNEL)
    }
    const template = menuTemplate(isMac, !app.isPackaged, openSettings, text().menu)
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
  }
  buildMenu()

  win = createWindow(log)
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
        messagesFor(pickLanguage(app.getPreferredSystemLanguages())).dialogs.startFailed,
        err instanceof Error ? err.message : String(err),
      )
      app.quit()
    })
}
