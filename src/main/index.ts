import { join } from "node:path"
import { app, BrowserWindow } from "electron"

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: "QuizPilot",
    show: false,
    webPreferences: { preload: join(import.meta.dirname, "../preload/index.cjs") },
  })
  win.once("ready-to-show", () => win.show())
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }))
  win.webContents.on("will-navigate", (event) => event.preventDefault())
  const devUrl = process.env["ELECTRON_RENDERER_URL"]
  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(import.meta.dirname, "../renderer/index.html"))
  return win
}

void app.whenReady().then(createWindow)
app.on("window-all-closed", () => app.quit())
