export type Platform = "mac" | "windows" | "linux" | "other"

export const REPO = "rayakame/quizpilot"
export const RELEASES = `https://github.com/${REPO}/releases/latest`

export const ASSETS = {
  macArm: "QuizPilot-arm64.dmg",
  macIntel: "QuizPilot-x64.dmg",
  windows: "QuizPilot-Setup.exe",
  linux: "QuizPilot-x86_64.AppImage",
} as const

export type Asset = keyof typeof ASSETS

export function assetUrl(asset: Asset): string {
  return `${RELEASES}/download/${ASSETS[asset]}`
}

export function detectPlatform(userAgent: string, platform: string, touchPoints: number): Platform {
  // ChromeOS says Linux, but an AppImage only runs in its Linux container.
  if (/Android|iPhone|iPad|iPod|Mobile|CrOS/i.test(userAgent)) return "other"
  if (/Mac/i.test(platform) || /Macintosh/.test(userAgent)) {
    // iPads ask for the desktop site and only give themselves away by touch.
    return touchPoints > 1 ? "other" : "mac"
  }
  if (/Win/i.test(platform) || /Windows/.test(userAgent)) return "windows"
  if (/Linux|X11/i.test(platform) || /Linux|X11/.test(userAgent)) {
    return /aarch64|arm/i.test(`${platform} ${userAgent}`) ? "other" : "linux"
  }
  return "other"
}

export interface PrimaryDownload {
  asset: Asset
  label: string
  note: string | null
  alternative: { asset: Asset; label: string } | null
}

// Browsers call every Mac "Intel", so Intel owners need their own way to the right file.
export function primaryDownload(platform: Platform): PrimaryDownload | null {
  switch (platform) {
    case "mac":
      return {
        asset: "macArm",
        label: "Download for Mac",
        note: "Apple Silicon",
        alternative: { asset: "macIntel", label: "Intel Mac?" },
      }
    case "windows":
      return { asset: "windows", label: "Download for Windows", note: null, alternative: null }
    case "linux":
      return { asset: "linux", label: "Download for Linux", note: null, alternative: null }
    case "other":
      return null
  }
}

export async function latestVersion(fetchFn: typeof fetch): Promise<string | null> {
  try {
    const res = await fetchFn(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    })
    if (!res.ok) return null
    const { tag_name: tag } = (await res.json()) as { tag_name?: unknown }
    return typeof tag === "string" ? tag.replace(/^v/, "") : null
  } catch {
    return null
  }
}
