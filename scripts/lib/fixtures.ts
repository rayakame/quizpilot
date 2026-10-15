import type { RawMessage } from "../../src/core/kahoot/raw.js"

export function fixtureName(seq: number, label: string): string {
  const slug = label.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")
  return `${String(seq).padStart(4, "0")}-${slug}.json`
}

export function rawLabel(msg: RawMessage): string {
  return `${msg.channel ?? "unknown"}-${msg.data?.id ?? msg.data?.type ?? "msg"}`
}

export function toFixture(msg: RawMessage): unknown {
  const content = msg.data?.content
  if (typeof content !== "string") return msg
  try {
    return { ...msg, contentParsed: JSON.parse(content) }
  } catch {
    return msg
  }
}
