import type { RawMessage } from "./fixtures.js"

export type TwoStepEvent = "reset" | "wrong" | "correct"

const IDS: Record<number, TwoStepEvent> = { 53: "reset", 51: "wrong", 52: "correct" }

export function twoStepEvent(msg: RawMessage): TwoStepEvent | null {
  if (msg.channel !== "/service/player" || msg.data?.id === undefined) return null
  return IDS[msg.data.id] ?? null
}
