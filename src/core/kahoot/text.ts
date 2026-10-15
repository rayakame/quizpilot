const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }

export function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const text = value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
      if (code.startsWith("#")) {
        const hex = code[1] === "x" || code[1] === "X"
        const n = hex ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
        return Number.isFinite(n) && n <= 0x10ffff ? String.fromCodePoint(n) : match
      }
      return NAMED[code.toLowerCase()] ?? match
    })
    .replace(/\s+/g, " ")
    .trim()
  return text === "" ? null : text
}
