import type { RawMessage } from "./raw.js"

export type TwoStepEvent = "reset" | "wrong" | "correct"

const IDS: Record<number, TwoStepEvent> = { 53: "reset", 51: "wrong", 52: "correct" }

export function twoStepEvent(msg: RawMessage): TwoStepEvent | null {
  if (msg.channel !== "/service/player" || msg.data?.id === undefined) return null
  return IDS[msg.data.id] ?? null
}

// Kahoot keeps broadcasting resets every 10 s, even to players who already got in.
export class TwoStepGate {
  done = false
  private asking = false

  shouldAsk(event: TwoStepEvent | null): boolean {
    if (event === "correct") this.done = true
    if (event !== "reset" || this.done || this.asking) return false
    this.asking = true
    return true
  }

  answered() {
    this.asking = false
  }
}

export function parseSequence(input: string): number[] | null {
  const digits = input.replace(/\s+/g, "")
  if (!/^[0-3]{4}$/.test(digits)) return null
  const sequence = [...digits].map(Number)
  return new Set(sequence).size === 4 ? sequence : null
}

// kahoot.js still sends {"sequence":"0123"}; the current client sends a list plus the game id.
export function twoStepAnswer(pin: string, sequence: number[], clientId: string) {
  return controllerMessage(pin, clientId, 50, { gameId: pin, sequence })
}

export function recoveryRequest(pin: string, clientId: string) {
  return controllerMessage(pin, clientId, 16, { usingNamerator: false })
}

function controllerMessage(pin: string, clientId: string, id: number, content: unknown) {
  return {
    channel: "/service/controller",
    clientId,
    ext: {},
    data: { id, type: "message", gameid: pin, host: "kahoot.it", content: JSON.stringify(content) },
  }
}
