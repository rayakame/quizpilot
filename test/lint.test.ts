import { ESLint } from "eslint"
import { describe, expect, it } from "vitest"

const eslint = new ESLint()

async function ruleIds(filePath: string) {
  const [result] = await eslint.lintText('import { app } from "electron"\nexport { app }\n', { filePath })
  return result?.messages.map((m) => m.ruleId) ?? []
}

describe("lint", () => {
  it("forbids electron in src/core", async () => {
    expect(await ruleIds("src/core/probe.ts")).toContain("no-restricted-imports")
  })

  it("allows electron in src/main", async () => {
    expect(await ruleIds("src/main/probe.ts")).not.toContain("no-restricted-imports")
  })
})
