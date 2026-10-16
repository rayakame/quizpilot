import { describe, expect, it } from "vitest"
import { releaseVersion } from "../../scripts/lib/release-version.js"

describe("releaseVersion", () => {
  it("takes a newer version, with or without a v", () => {
    expect(releaseVersion("0.1.0", "0.2.0")).toEqual({ version: "0.2.0", bump: true })
    expect(releaseVersion("0.9.3", "v0.10.0")).toEqual({ version: "0.10.0", bump: true })
  })

  it("releases the current version without a bump", () => {
    expect(releaseVersion("0.1.0", "0.1.0")).toEqual({ version: "0.1.0", bump: false })
  })

  it("refuses older versions and anything that isn't x.y.z", () => {
    expect(releaseVersion("0.2.0", "0.1.9")).toEqual({
      error: "0.1.9 is older than the current version 0.2.0.",
    })
    for (const bad of ["1.2", "1.2.3-beta.1", "latest", " "]) {
      expect(releaseVersion("0.1.0", bad)).toEqual({ error: "Use a version like 1.2.3." })
    }
  })
})
