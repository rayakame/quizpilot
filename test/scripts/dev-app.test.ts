import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { prepareDevApp } from "../../scripts/lib/dev-app.js"

const ICON = resolve("resources/icon.png")

function plist(path: string, key: string): string {
  return execFileSync("plutil", ["-extract", key, "raw", "-o", "-", path], {
    encoding: "utf8",
  }).trim()
}

function fakeElectron(dir: string): string {
  const app = join(dir, "Electron.app")
  mkdirSync(join(app, "Contents/MacOS"), { recursive: true })
  mkdirSync(join(app, "Contents/Resources"), { recursive: true })
  writeFileSync(
    join(app, "Contents/Info.plist"),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>Electron</string>
<key>CFBundleDisplayName</key><string>Electron</string>
<key>CFBundleExecutable</key><string>Electron</string>
<key>CFBundleIconFile</key><string>electron.icns</string>
<key>CFBundleVersion</key><string>44.7.2</string>
</dict></plist>
`,
  )
  writeFileSync(join(app, "Contents/MacOS/Electron"), "#!/bin/sh\n", { mode: 0o755 })
  writeFileSync(join(app, "Contents/Resources/electron.icns"), "old")
  return app
}

describe.skipIf(process.platform !== "darwin")("prepareDevApp", () => {
  it("copies Electron into a bundle named QuizPilot", () => {
    const dir = mkdtempSync(join(tmpdir(), "quizpilot-"))
    const source = fakeElectron(dir)

    const exe = prepareDevApp(source, ICON, join(dir, "dev"))

    expect(exe).toBe(join(dir, "dev/QuizPilot.app/Contents/MacOS/Electron"))
    expect(statSync(exe).mode & 0o111).not.toBe(0)
    const copied = join(dir, "dev/QuizPilot.app/Contents/Info.plist")
    expect(plist(copied, "CFBundleName")).toBe("QuizPilot")
    expect(plist(copied, "CFBundleDisplayName")).toBe("QuizPilot")
    expect(plist(join(source, "Contents/Info.plist"), "CFBundleName")).toBe("Electron")
    const icon = readFileSync(join(dir, "dev/QuizPilot.app/Contents/Resources/electron.icns"))
    expect(icon.subarray(0, 4).toString()).toBe("icns")
  })

  it("keeps the copy until Electron changes", () => {
    const dir = mkdtempSync(join(tmpdir(), "quizpilot-"))
    const source = fakeElectron(dir)
    const marker = join(dir, "dev/QuizPilot.app/marker")
    prepareDevApp(source, ICON, join(dir, "dev"))
    writeFileSync(marker, "")

    prepareDevApp(source, ICON, join(dir, "dev"))
    expect(existsSync(marker)).toBe(true)

    execFileSync("plutil", [
      "-replace",
      "CFBundleVersion",
      "-string",
      "44.7.3",
      join(source, "Contents/Info.plist"),
    ])
    prepareDevApp(source, ICON, join(dir, "dev"))
    expect(existsSync(marker)).toBe(false)
  })
})
