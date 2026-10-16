import { readFileSync, writeFileSync } from "node:fs"
import { releaseVersion } from "./lib/release-version.js"

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string }
const result = releaseVersion(pkg.version, process.argv[2] ?? "")
if ("error" in result) {
  console.error(result.error)
  process.exit(1)
}
if (result.bump) {
  pkg.version = result.version
  writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`)
}
// Read by the release workflow as step outputs.
console.log(`version=${result.version}`)
console.log(`bump=${result.bump}`)
