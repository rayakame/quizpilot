import type { RawMessage } from "./fixtures.js"

export type TwoStepEvent = "reset" | "wrong" | "correct"

const IDS: Record<number, TwoStepEvent> = { 53: "reset", 51: "wrong", 52: "correct" }

export function twoStepEvent(msg: RawMessage): TwoStepEvent | null {
  if (msg.channel !== "/service/player" || msg.data?.id === undefined) return null
  return IDS[msg.data.id] ?? null
}

export function parseSequence(input: string): number[] | null {
  const digits = input.replace(/\s+/g, "")
  if (!/^[0-3]{4}$/.test(digits)) return null
  const sequence = [...digits].map(Number)
  return new Set(sequence).size === 4 ? sequence : null
}

// kahoot.js still sends {"sequence":"0123"}; the current client sends a list plus the game id.
export function twoStepAnswer(pin: string, sequence: number[], clientId: string) {
  return {
    channel: "/service/controller",
    clientId,
    ext: {},
    data: {
      id: 50,
      type: "message",
      gameid: pin,
      host: "kahoot.it",
      content: JSON.stringify({ gameId: pin, sequence }),
    },
  }
}
