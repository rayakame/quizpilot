import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
  dependencies: Record<string, string>
}
// Electron brings itself; node: modules are built in.
const PROVIDED = new Set(["electron"])

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return path.endsWith(".ts") ? [path] : []
  })
}

function packageOf(specifier: string): string | null {
  if (specifier.startsWith(".") || specifier.startsWith("node:")) return null
  const parts = specifier.split("/")
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!
}

describe("runtime dependencies", () => {
  it("ships every package the app imports at runtime", () => {
    const sources = ["src/main", "src/preload", "src/core", "src/shared"].flatMap(files)
    const missing = new Set<string>()
    for (const file of sources) {
      const text = readFileSync(file, "utf8")
      for (const [, specifier] of text.matchAll(/^import (?!type )[^"]*"([^"]+)"/gm)) {
        const name = packageOf(specifier!)
        if (name && !PROVIDED.has(name) && !(name in pkg.dependencies)) missing.add(name)
      }
    }
    expect([...missing]).toEqual([])
  })
})
