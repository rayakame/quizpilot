import type { BrowserWindowConstructorOptions } from "electron"

// The native macOS title bar never matches the app's colors; the header takes its place.
export function frameOptions(platform: NodeJS.Platform): BrowserWindowConstructorOptions {
  if (platform !== "darwin") return {}
  return { titleBarStyle: "hidden", trafficLightPosition: { x: 16, y: 16 } }
}
