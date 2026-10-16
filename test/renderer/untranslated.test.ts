import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { parse } from "svelte/compiler"
import { describe, expect, it } from "vitest"

const ROOT = "src/renderer/src"
const SKIP = [join(ROOT, "lib/components/ui")]
const SHOWN = new Set(["aria-label", "placeholder", "title", "alt"])
const NAMES = new Set(["QuizPilot", "Jev", "TypeSafe", "Anthropic", "OpenAI", "Google"])
const IGNORED = new Set([
  "start",
  "end",
  "loc",
  "metadata",
  "css",
  "typeAnnotation",
  "typeArguments",
  "typeParameters",
  "returnType",
])

function files(dir: string): string[] {
  if (SKIP.includes(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return path.endsWith(".svelte") ? [path] : []
  })
}

const words = (s: string) => /\p{L}{2,}/u.test(s) && !NAMES.has(s.trim())
const label = (s: string) => /^[A-Z][a-z]/.test(s.trim()) && !NAMES.has(s.trim())

// The strings an expression can put on screen, not the ones it compares against.
function shown(node: unknown): string[] {
  const n = node as Record<string, unknown> | null
  switch (n?.type) {
    case "Literal":
      return typeof n.value === "string" ? [n.value] : []
    case "TemplateLiteral":
      return (n.quasis as { value: { cooked: string } }[]).map((q) => q.value.cooked)
    case "ConditionalExpression":
      return [...shown(n.consequent), ...shown(n.alternate)]
    case "LogicalExpression":
      return [...shown(n.left), ...shown(n.right)]
    default:
      return []
  }
}

function find(node: unknown, out: string[]): void {
  if (Array.isArray(node)) return node.forEach((n) => find(n, out))
  if (node === null || typeof node !== "object") return
  const n = node as Record<string, unknown>
  const type = typeof n.type === "string" ? n.type : ""
  if (type.startsWith("TS") || type === "ImportDeclaration" || type === "Comment") return
  if (type === "Attribute") {
    for (const part of Array.isArray(n.value) ? n.value : [n.value]) {
      const p = part as Record<string, unknown> | null
      if (p?.type !== "Text") {
        if (SHOWN.has(String(n.name))) out.push(...shown(p?.expression).filter(words))
        find(p, out)
      } else if (SHOWN.has(String(n.name)) && words(String(p.data))) out.push(String(p.data))
    }
    return
  }
  if (type === "Text" && words(String(n.data))) out.push(String(n.data).trim())
  if (type === "ExpressionTag") out.push(...shown(n.expression).filter(words))
  if (type === "Literal" && typeof n.value === "string" && label(n.value)) out.push(n.value)
  if (type === "TemplateElement") {
    const cooked = String((n.value as { cooked?: string }).cooked ?? "")
    if (words(cooked)) out.push(cooked)
  }
  for (const [key, child] of Object.entries(n)) if (!IGNORED.has(key)) find(child, out)
}

describe.skip("views", () => {
  it.each(files(ROOT))("%s takes its texts from the dictionary", (file) => {
    const ast = parse(readFileSync(file, "utf8"), { modern: true })
    const out: string[] = []
    find(ast.fragment, out)
    find(ast.instance, out)
    find(ast.module, out)
    expect(out).toEqual([])
  })
})
