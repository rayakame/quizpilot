import { readFileSync } from "node:fs"

const yml = readFileSync("electron-builder.yml", "utf8")

function artifactName(section: string | null): string {
  let scope = yml
  if (section !== null) {
    const start = yml.indexOf(`\n${section}:\n`)
    if (start === -1) throw new Error(`electron-builder.yml has no ${section} section`)
    const rest = yml.slice(start + 1)
    const end = rest.slice(1).search(/\n\S/)
    scope = end === -1 ? rest : rest.slice(0, end + 1)
  }
  const match = (section === null ? /^artifactName: *(.+)$/m : /^ +artifactName: *(.+)$/m).exec(
    scope,
  )
  if (!match) throw new Error(`no artifactName in ${section ?? "the top level"}`)
  return match[1]!.trim().replace(/^["']|["']$/g, "")
}

const fill = (pattern: string, arch: string, ext: string) =>
  pattern
    .replaceAll("${productName}", "QuizPilot")
    .replaceAll("${arch}", arch)
    .replaceAll("${ext}", ext)

/** The installer file names electron-builder writes for each release. */
export function installerNames(): string[] {
  const top = artifactName(null)
  return [
    fill(top, "arm64", "dmg"),
    fill(top, "x64", "dmg"),
    fill(artifactName("nsis"), "x64", "exe"),
    fill(artifactName("appImage"), "x86_64", "AppImage"),
  ]
}

export const usesVersion = () => yml.includes("${version}")
