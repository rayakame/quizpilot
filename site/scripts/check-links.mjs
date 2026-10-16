// Fails when a page points at a file that won't exist under the GitHub Pages base path.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const DIST = new URL("../dist/", import.meta.url).pathname
const BASE = "/quizpilot/"

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

function targets(text) {
  const found = []
  for (const [, value] of text.matchAll(/(?:href|src|srcset|content)="([^"]+)"/g)) {
    for (const part of value.split(",")) found.push(part.trim().split(/\s+/)[0])
  }
  for (const [, value] of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) found.push(value)
  return found.filter((t) => t && t.startsWith("/") && !t.startsWith("//"))
}

const problems = []
for (const file of files(DIST).filter((f) => /\.(html|css)$/.test(f))) {
  const text = readFileSync(file, "utf8")
  for (const target of targets(text)) {
    const where = relative(DIST, file)
    if (!target.startsWith(BASE)) {
      problems.push(`${where}: ${target} is missing the ${BASE} base`)
      continue
    }
    let path = decodeURIComponent(target.slice(BASE.length).split(/[?#]/)[0])
    if (path === "" || path.endsWith("/")) path += "index.html"
    if (!existsSync(join(DIST, path))) problems.push(`${where}: ${target} doesn't exist`)
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"))
  process.exit(1)
}
console.log("links ok")
