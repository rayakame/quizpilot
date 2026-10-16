import { costOf } from "../../core/cost/prices.js"
import type { KnownQuiz } from "../../core/quiz-source/link.js"
import type { GameEvent, StartRequest } from "../../shared/api.js"
import type { GameRecorder } from "../game-controller.js"
import type { HistoryStore } from "./store.js"

export interface RecorderDeps {
  store: HistoryStore
  enabled(): boolean
  saveImage(gameId: number, index: number, url: string): Promise<string | null>
  now(): number
  log(message: string, err: unknown): void
}

interface Current {
  id: number
  request: StartRequest
  quiz: KnownQuiz | null
  last: number | null
}

export class HistoryRecorder implements GameRecorder {
  private current: Current | null = null
  private failed = false

  constructor(private readonly deps: RecorderDeps) {}

  begin(request: StartRequest, quiz: KnownQuiz | null): void {
    this.finish()
    if (this.deps.enabled()) this.safely(() => this.open(request, quiz))
  }

  event(event: GameEvent): void {
    const current = this.current
    if (current) this.safely(() => this.apply(current, event))
  }

  finish(): void {
    const current = this.current
    this.current = null
    if (current) this.safely(() => this.deps.store.endGame(current.id, this.deps.now()))
  }

  private open(request: StartRequest, quiz: KnownQuiz | null): void {
    const store = this.deps.store
    const id = store.startGame({
      pin: request.pin,
      quizTitle: quiz?.title ?? null,
      quizId: quiz?.id ?? null,
      context: request.quizContext,
      quizLink: request.quizLink,
      timing: request.timing,
      includePrevious: request.includePrevious,
      startedAt: this.deps.now(),
    })
    for (const name of request.names) store.saveBot(id, name, null)
    this.current = { id, request, quiz, last: null }
  }

  private apply(current: Current, e: GameEvent): void {
    const { store } = this.deps
    const id = current.id
    switch (e.type) {
      case "status":
        return store.saveBot(id, e.bot, e.status)
      case "question": {
        const index = e.question.index
        store.saveQuestion(id, e.question)
        current.last = index
        const url = e.question.image?.url
        if (url) {
          void this.deps
            .saveImage(id, index, url)
            .then((path) => path && this.safely(() => store.setImagePath(id, index, path)))
            .catch(() => {})
        }
        return
      }
      case "decision":
        return store.saveDecision(id, e.index, e.decision, costOf(e.decision.usage))
      case "answered":
        return store.saveAnswered(id, e.index, e.bot, e.afterMs)
      case "result": {
        const index = e.result.index ?? current.last
        if (index !== null) store.saveResult(id, index, e.bot, e.result)
        return
      }
      case "ended":
        store.endBot(id, e.bot, e.end)
        return store.endGame(id, this.deps.now())
      case "gameReset":
        this.finish()
        return this.open(current.request, current.quiz)
      default:
        return
    }
  }

  private safely(fn: () => void): void {
    try {
      fn()
    } catch (err) {
      // One broken database must not flood the log once per event.
      if (!this.failed) this.deps.log("Couldn't save the game history", err)
      this.failed = true
    }
  }
}
