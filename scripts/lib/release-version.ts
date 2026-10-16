import { newerVersion } from "../../src/main/updates.js"

export type ReleaseVersion = { version: string; bump: boolean } | { error: string }

export function releaseVersion(current: string, requested: string): ReleaseVersion {
  const version = requested.trim().replace(/^v/, "")
  if (!/^\d+\.\d+\.\d+$/.test(version)) return { error: "Use a version like 1.2.3." }
  if (newerVersion(current, version)) {
    return { error: `${version} is older than the current version ${current}.` }
  }
  return { version, bump: version !== current }
}
