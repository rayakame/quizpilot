import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const FILE = ".github/workflows/site.yml"
const workflow = existsSync(FILE) ? readFileSync(FILE, "utf8") : ""

describe("site workflow", () => {
  it("only runs when the website changes or by hand", () => {
    expect(workflow).toMatch(/paths: \["site\/\*\*", "\.github\/workflows\/site\.yml"\]/)
    expect(workflow).toContain("workflow_dispatch:")
  })

  it("checks the site before it uploads it", () => {
    expect(workflow).toContain("pnpm --filter site check")
    expect(workflow.indexOf("pnpm --filter site check")).toBeLessThan(
      workflow.indexOf("upload-pages-artifact"),
    )
  })

  it("may deploy to Pages and nothing else", () => {
    expect(workflow).toContain("pages: write")
    expect(workflow).toContain("id-token: write")
    expect(workflow).toContain("contents: read")
    expect(workflow).toContain("actions/deploy-pages")
  })
})
