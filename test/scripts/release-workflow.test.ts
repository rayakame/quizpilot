import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const workflow = readFileSync(".github/workflows/release.yml", "utf8").replace(/\r\n/g, "\n")
const job = (name: string) => {
  const start = workflow.indexOf(`\n  ${name}:`)
  const next = workflow.slice(start + 1).search(/\n {2}[a-z]+:\n/)
  return next === -1 ? workflow.slice(start) : workflow.slice(start, start + 1 + next)
}

describe("release workflow", () => {
  it("can be started with a version", () => {
    expect(workflow).toContain("workflow_dispatch:")
    expect(job("prepare")).toContain("scripts/release-version.ts")
  })

  it("checks everything before it tags or creates the draft", () => {
    const prepare = job("prepare")
    expect(prepare).toContain("Check the tag matches package.json")
    expect(prepare.indexOf("pnpm test")).toBeLessThan(prepare.indexOf("git tag"))
    expect(job("draft")).toContain("needs: prepare")
    expect(job("draft")).toContain("gh release create")
  })

  it("builds the tagged commit and publishes only when asked", () => {
    expect(job("build")).toContain("ref: ${{ needs.prepare.outputs.tag }}")
    expect(job("publish")).toContain("inputs.publish")
  })
})
