import type { SessionEvent } from "../core/session/game-session.js"
import type { Level } from "./log.js"

export interface LogEntry {
  level: Level
  message: string
  detail?: unknown
}

export function logEntry(event: SessionEvent): LogEntry | null {
  switch (event.type) {
    case "joinFailed":
      return {
        level: "warn",
        message: `${event.bot} couldn't join (${event.code})`,
        detail: event.message,
      }
    case "status": {
      if (event.status === "kicked") {
        return { level: "info", message: `${event.bot} was removed by the host` }
      }
      if (event.status === "disconnected") {
        // Without a cause the join failed, and its joinFailed event says why.
        if (!event.cause) return null
        if (event.cause === "ended") {
          return { level: "info", message: `The host ended the game for ${event.bot}` }
        }
        const entry: LogEntry = { level: "warn", message: `${event.bot} lost the connection` }
        return event.detail ? { ...entry, detail: event.detail } : entry
      }
      if (event.status === "joining" && event.detail === "reconnecting") {
        return { level: "info", message: `${event.bot} is reconnecting` }
      }
      return null
    }
    case "question": {
      const { index, type, raw } = event.question
      if (type !== "unknown") return { level: "info", message: `Question ${index + 1}: ${type}` }
      return { level: "warn", message: `Question ${index + 1} has an unknown type`, detail: raw }
    }
    case "decision": {
      const { source, confidence } = event.decision
      const sure = confidence === null ? "" : ` (${Math.round(confidence * 100)}%)`
      return { level: "info", message: `Answer ${event.index + 1} from ${source}${sure}` }
    }
    case "twoStepRequired":
      return { level: "info", message: "Two-step join required" }
    case "twoStepResult":
      return {
        level: "info",
        message: event.ok ? "Two-step code accepted" : "Two-step code was wrong",
      }
    case "ended":
      return { level: "info", message: `${event.bot} finished #${event.end.rank}` }
    case "gameReset":
      return { level: "info", message: "The host restarted the game" }
    default:
      return null
  }
}
