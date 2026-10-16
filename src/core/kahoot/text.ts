const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
}

const SUPERSCRIPT = map("0123456789+-−=()ni", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁻⁼⁽⁾ⁿⁱ")
const SUBSCRIPT = map("0123456789+-−=()", "₀₁₂₃₄₅₆₇₈₉₊₋₋₌₍₎")

export function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const text = decode(
    value
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<sup[^>]*>(.*?)<\/sup>/gis, (_, inner: string) => script(inner, SUPERSCRIPT, "^"))
      .replace(/<sub[^>]*>(.*?)<\/sub>/gis, (_, inner: string) => script(inner, SUBSCRIPT, "_"))
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim()
  return text === "" ? null : text
}

// Kahoot formats powers and indices as <sup>/<sub>; without them "5³" would read as "53".
function script(inner: string, chars: Map<string, string>, mark: string): string {
  const raw = inner.replace(/<[^>]*>/g, "").trim()
  const all = [...decode(raw)]
  if (all.length > 0 && all.every((c) => chars.has(c))) return all.map((c) => chars.get(c)).join("")
  // Entities stay encoded here; cleanText decodes the whole text once.
  return all.length === 1 ? `${mark}${raw}` : `${mark}(${raw})`
}

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith("#")) {
      const hex = code[1] === "x" || code[1] === "X"
      const n = hex ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) && n <= 0x10ffff ? String.fromCodePoint(n) : match
    }
    return NAMED[code.toLowerCase()] ?? match
  })
}

function map(from: string, to: string): Map<string, string> {
  const target = [...to]
  return new Map([...from].map((c, i) => [c, target[i]!]))
}
