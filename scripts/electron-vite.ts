import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import { dirname, join, resolve } from "node:path"
import { prepareDevApp } from "./lib/dev-app.js"

const require = createRequire(import.meta.url)
const env = { ...process.env }
if (process.platform === "darwin" && !env.ELECTRON_EXEC_PATH) {
  const electron = dirname(require.resolve("electron/package.json"))
  env.ELECTRON_EXEC_PATH = prepareDevApp(
    join(electron, "dist/Electron.app"),
    resolve("resources/icon.png"),
    resolve("node_modules/.cache/quizpilot-dev"),
  )
}

const bin = join(dirname(require.resolve("electron-vite/package.json")), "bin/electron-vite.js")
const child = spawn(process.execPath, [bin, ...process.argv.slice(2)], { stdio: "inherit", env })
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill(signal))
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)))
