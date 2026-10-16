import type { UpdateState } from "../shared/api.js"

export type UpdateMode = "off" | "notify" | "download"
export const FIRST_CHECK_MS = 10_000
export const CHECK_EVERY_MS = 6 * 60 * 60 * 1000

export interface Release {
  version: string
  url: string
}

export interface Downloader {
  check(): Promise<void>
  install(): void
}

export interface UpdateDeps {
  mode: UpdateMode
  current: string
  latest(): Promise<Release | null>
  downloader: Downloader | null
  beforeInstall(): Promise<void>
  log(message: string, err?: unknown): void
}

export function updateMode(
  platform: NodeJS.Platform,
  packaged: boolean,
  appImage: boolean,
): UpdateMode {
  if (!packaged) return "off"
  // Squirrel.Mac only installs signed apps; outside an AppImage Linux has nothing to replace.
  if (platform === "darwin" || (platform === "linux" && !appImage)) return "notify"
  return "download"
}

function parts(version: string): number[] | null {
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(version.trim())
  return match ? match.slice(1).map((p) => Number(p ?? 0)) : null
}

export function newerVersion(latest: string, current: string): boolean {
  const a = parts(latest)
  const b = parts(current)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i]! > b[i]!
  return false
}

export async function latestRelease(repo: string, fetchFn: typeof fetch): Promise<Release | null> {
  const res = await fetchFn(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) return null
  const { tag_name: tag, html_url: url } = (await res.json()) as Record<string, unknown>
  if (typeof tag !== "string" || typeof url !== "string") return null
  if (!url.startsWith(`https://github.com/${repo}/`)) return null
  return { version: tag.replace(/^v/, ""), url }
}

export class Updates {
  private current: UpdateState
  private readonly listeners = new Set<(state: UpdateState) => void>()

  constructor(private readonly deps: UpdateDeps) {
    this.current = deps.mode === "off" ? { kind: "off" } : { kind: "none" }
  }

  get state(): UpdateState {
    return this.current
  }

  onChange(fn: (state: UpdateState) => void): void {
    this.listeners.add(fn)
  }

  async check(): Promise<UpdateState> {
    const { mode, downloader } = this.deps
    if (mode === "off" || this.current.kind === "ready") return this.current
    try {
      if (mode === "download" && downloader) {
        await downloader.check()
        return this.current
      }
      const release = await this.deps.latest()
      if (release && newerVersion(release.version, this.deps.current)) {
        this.set({ kind: "available", version: release.version, url: release.url })
      }
    } catch (err) {
      this.deps.log("Update check failed", err)
    }
    return this.current
  }

  downloaded(version: string): void {
    this.set({ kind: "ready", version })
  }

  async install(): Promise<void> {
    if (this.current.kind !== "ready" || !this.deps.downloader) return
    await this.deps.beforeInstall()
    this.deps.downloader.install()
  }

  private set(state: UpdateState): void {
    this.current = state
    for (const fn of this.listeners) fn(state)
  }
}
