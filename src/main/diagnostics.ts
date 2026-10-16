import { localDay } from "./history/export.js"
import { redact } from "./log.js"
import type { Config } from "./settings.js"

export const MAX_LOG = 400_000

export interface DiagnosticsInfo {
  version: string
  electron: string
  chrome: string
  node: string
  os: string
  systemLanguages: string[]
}

export function diagnosticsReport(
  info: DiagnosticsInfo,
  config: Config,
  log: string,
  now: Date,
): string {
  const keys = Object.fromEntries(
    Object.entries(config.keys).map(([name, key]) => [name, key ? "set" : "not set"]),
  )
  const tail = log.length > MAX_LOG ? log.slice(log.indexOf("\n", log.length - MAX_LOG) + 1) : log
  const report = [
    `QuizPilot ${info.version} diagnostics, ${now.toISOString()}`,
    `Electron ${info.electron} · Chrome ${info.chrome} · Node ${info.node}`,
    `System: ${info.os} · languages: ${info.systemLanguages.join(", ") || "unknown"}`,
    "",
    "Settings:",
    JSON.stringify({ ...config, keys }, null, 2),
    "",
    "Log:",
    tail || "(empty)",
  ].join("\n")
  return redact(report, Object.values(config.keys))
}

export function diagnosticsName(now: Date): string {
  return `quizpilot-diagnostics-${localDay(now)}`
}
