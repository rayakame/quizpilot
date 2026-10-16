import { parseSequence } from "../core/kahoot/two-step.js"
import type { KnownQuiz } from "../core/quiz-source/link.js"
import type { GameSession, JoinOutcome, SessionEvent } from "../core/session/game-session.js"
import type { GameEvent, QuestionView, StartRequest, StartResult } from "../shared/api.js"
import { startProblem } from "../shared/start.js"

export interface GameRecorder {
  begin(request: StartRequest, quiz: KnownQuiz | null): void
  event(event: GameEvent): void
  finish(): void
}

export interface ControllerDeps {
  createSession(request: StartRequest, quiz: KnownQuiz | null): GameSession
  loadQuiz(link: string): Promise<KnownQuiz>
  send(event: GameEvent): void
  recorder?: GameRecorder
}

export class GameController {
  private session: GameSession | null = null
  private pin = ""
  private unsubscribe = () => {}

  constructor(private readonly deps: ControllerDeps) {}

  get active(): boolean {
    return this.session !== null
  }

  async start(request: StartRequest): Promise<StartResult> {
    const problem = startProblem(request)
    if (problem) return { ok: false, error: problem, message: problem }
    let quiz: KnownQuiz | null = null
    if (request.quizLink !== null) {
      try {
        quiz = await this.deps.loadQuiz(request.quizLink)
      } catch (err) {
        return { ok: false, error: "quiz_link", message: errorText(err) }
      }
    }
    await this.end()
    let session: GameSession
    try {
      session = this.deps.createSession(request, quiz)
    } catch (err) {
      return { ok: false, error: "unknown", message: errorText(err) }
    }
    this.session = session
    this.pin = request.pin
    this.unsubscribe = session.on((event) => {
      const e = toGameEvent(event)
      this.deps.send(e)
      this.deps.recorder?.event(e)
    })
    const [first, ...rest] = request.names
    const [outcome] = await session.join(request.pin, [first!])
    if (outcome && !outcome.ok && outcome.code !== "duplicate_name") {
      await this.end()
      return { ok: false, error: outcome.code, message: outcome.message }
    }
    this.deps.recorder?.begin(request, quiz)
    if (rest.length > 0) void session.join(request.pin, rest).catch(() => {})
    return { ok: true }
  }

  async addBot(name: string): Promise<JoinOutcome> {
    if (!this.session) return { name, ok: false, code: "unknown", message: "No game is running" }
    try {
      const [outcome] = await this.session.join(this.pin, [name.trim()])
      return outcome!
    } catch (err) {
      return { name, ok: false, code: "unknown", message: errorText(err) }
    }
  }

  async submitTwoStep(sequence: number[]): Promise<void> {
    const valid = parseSequence(sequence.join(""))
    if (valid) await this.session?.submitTwoStep(valid)
  }

  pause(bot: string | null, paused: boolean): void {
    this.session?.pause(bot, paused)
  }

  async leave(bot: string | null): Promise<void> {
    await this.session?.leave(bot ?? undefined)
  }

  async end(): Promise<void> {
    const session = this.session
    if (!session) return
    this.session = null
    this.unsubscribe()
    this.deps.recorder?.finish()
    await session.leave()
  }
}

export function toGameEvent(event: SessionEvent): GameEvent {
  if (event.type !== "question") return event
  const q = event.question
  const question: QuestionView = {
    index: q.index,
    type: q.type,
    title: q.title,
    choices: q.choices.map((c) => ({ text: c.text, image: c.image })),
    image: q.image,
    imageAlt: q.imageAlt ?? null,
    timeLimitMs: q.timeLimitMs,
    ...(q.slider ? { slider: q.slider } : {}),
  }
  return { type: "question", question }
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
