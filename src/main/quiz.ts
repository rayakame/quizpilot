import { loadQuiz, parseQuizLink, QuizLoadError, type KnownQuiz } from "../core/quiz-source/link.js"
import type { QuizCheck } from "../shared/api.js"

const TIMEOUT_MS = 10_000

export class QuizCache {
  private readonly quizzes = new Map<string, Promise<KnownQuiz>>()

  constructor(private readonly fetchFn: typeof fetch = fetch) {}

  get(link: string): Promise<KnownQuiz> {
    const id = parseQuizLink(link)
    if (!id) return Promise.reject(new QuizLoadError("link"))
    let quiz = this.quizzes.get(id)
    if (!quiz) {
      quiz = loadQuiz(id, this.fetchFn, AbortSignal.timeout(TIMEOUT_MS))
      this.quizzes.set(id, quiz)
      quiz.catch(() => this.quizzes.delete(id))
    }
    return quiz
  }

  async check(link: string): Promise<QuizCheck> {
    try {
      const quiz = await this.get(link)
      const questions = quiz.questions.filter((q) => q.type !== "content").length
      return { ok: true, title: quiz.title, questions }
    } catch (err) {
      return { ok: false, error: err instanceof QuizLoadError ? err.code : "unknown" }
    }
  }
}
