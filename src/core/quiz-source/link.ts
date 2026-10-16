import { cleanText } from "../kahoot/text.js"

export type KnownQuestion = Record<string, unknown>

export interface KnownQuiz {
  id: string
  title: string
  questions: KnownQuestion[]
}

export type QuizLoadProblem = "link" | "not_found" | "private" | "offline" | "unknown"

export class QuizLoadError extends Error {
  constructor(readonly code: QuizLoadProblem) {
    super(code)
    this.name = "QuizLoadError"
  }
}

export const QUIZ_API = "https://create.kahoot.it/rest/kahoots/"

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

export function parseQuizLink(text: string): string | null {
  return UUID.exec(text)?.[0].toLowerCase() ?? null
}

export async function loadQuiz(
  id: string,
  fetchFn: typeof fetch,
  signal?: AbortSignal,
): Promise<KnownQuiz> {
  let res: Response
  try {
    res = await fetchFn(QUIZ_API + id, { signal, headers: { accept: "application/json" } })
  } catch {
    throw new QuizLoadError("offline")
  }
  if (res.status === 400 || res.status === 404) throw new QuizLoadError("not_found")
  if (res.status === 401 || res.status === 403) throw new QuizLoadError("private")
  if (!res.ok) throw new QuizLoadError("unknown")
  const body: unknown = await res.json().catch(() => null)
  if (!isRecord(body) || !Array.isArray(body.questions)) throw new QuizLoadError("unknown")
  return {
    id,
    title: cleanText(body.title) ?? "Untitled quiz",
    questions: body.questions.map((q) => (isRecord(q) ? q : {})),
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v)
}
