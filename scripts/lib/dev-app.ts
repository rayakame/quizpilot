import { execFileSync } from "node:child_process"
import {
  constants,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"

const NAME = "QuizPilot"

// macOS takes the Dock and menu bar name from the bundle, so a plain dev run says "Electron".
export function prepareDevApp(source: string, icon: string, dir: string): string {
  const app = join(dir, `${NAME}.app`)
  const plist = join(app, "Contents/Info.plist")
  const stamp = join(dir, "stamp")
  const want = `${read(join(source, "Contents/Info.plist"), "CFBundleVersion")} ${statSync(icon).mtimeMs}`
  if (!existsSync(plist) || !existsSync(stamp) || readFileSync(stamp, "utf8") !== want) {
    rmSync(stamp, { force: true })
    rmSync(app, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    cpSync(source, app, {
      recursive: true,
      verbatimSymlinks: true,
      mode: constants.COPYFILE_FICLONE,
    })
    for (const key of ["CFBundleName", "CFBundleDisplayName"]) {
      execFileSync("plutil", ["-replace", key, "-string", NAME, plist])
    }
    const icns = join(app, "Contents/Resources", read(plist, "CFBundleIconFile"))
    // sips fails to write an icns larger than 512 px.
    execFileSync("sips", ["-z", "512", "512", "-s", "format", "icns", icon, "--out", icns], {
      stdio: "ignore",
    })
    writeFileSync(stamp, want)
  }
  return join(app, "Contents/MacOS", read(plist, "CFBundleExecutable"))
}

function read(plist: string, key: string): string {
  return execFileSync("plutil", ["-extract", key, "raw", "-o", "-", plist], {
    encoding: "utf8",
  }).trim()
}
