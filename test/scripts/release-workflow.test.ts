import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const workflow = readFileSync(".github/workflows/release.yml", "utf8")

describe("release workflow", () => {
  it("checks the tag before it creates the draft release", () => {
    const draft = workflow.slice(workflow.indexOf("  draft:"), workflow.indexOf("  build:"))
    expect(draft).toContain("Check the tag matches package.json")
    expect(draft.indexOf("Check the tag")).toBeLessThan(draft.indexOf("gh release create"))
  })
})
