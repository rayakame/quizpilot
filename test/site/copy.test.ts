import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const DIR = "site/src"
const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sources(join(dir, e.name))
      : /\.(astro|ts)$/.test(e.name)
        ? [join(dir, e.name)]
        : [],
  )
const files = sources(DIR).map((path) => ({ path, text: readFileSync(path, "utf8") }))

describe("website copy", () => {
  // Jev isn't always right, and typed answers or word clouds need a backup AI.
  it("doesn't promise more than the app does", () => {
    const claims = files.flatMap(({ path, text }) =>
      [/every question(?! type)/i, /every right answer/i, /always right/i].flatMap((claim) =>
        claim.test(text) ? [`${path}: ${claim}`] : [],
      ),
    )
    expect(claims).toEqual([])
  })

  // zinc-500 and darker don't reach 4.5:1 on the near-black background.
  it("keeps small text readable", () => {
    const dim = files.flatMap(({ path, text }) =>
      [...text.matchAll(/text-zinc-(500|600|700)/g)].map((m) => `${path}: ${m[0]}`),
    )
    expect(dim).toEqual([])
  })
})
