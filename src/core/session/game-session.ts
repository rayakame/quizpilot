import type { AskContext, PreviousQuestion } from "../answer/context.js"
import { answerText, correctAnswer } from "../answer/describe.js"
import type { AdapterEvents, KahootAdapterLike } from "../kahoot/adapter.js"
import type { QuestionResult, QuizEnd } from "../kahoot/normalize.js"
import type { Decision, Question } from "../types.js"
import { sleep } from "../util/async.js"

export const MAX_BOTS = 5
export const RECONNECT_DELAYS_MS = [1000, 3000, 9000] as const

export type BotStatus =
  | "joining"
  | "twoStep"
  | "lobby"
  | "playing"
  | "paused"
  | "left"
  | "kicked"
  | "disconnected"
  | "finished"

export interface SessionSettings {
  timing: { mode: "instant" | "human"; minMs: number; maxMs: number }
  quizContext: string | null
  includePrevious: boolean
  reconnect: boolean
}

export interface SessionDeps {
  createAdapter(): KahootAdapterLike
  decide(question: Question, startedAt: number, context: AskContext): Promise<Decision>
  now(): number
  random(): number
}

export type SessionEvent =
  | { type: "status"; bot: string; status: BotStatus; detail?: string }
  | { type: "twoStepRequired" }
  | { type: "twoStepResult"; ok: boolean }
  | { type: "question"; question: Question }
  | { type: "decision"; index: number; decision: Decision }
  | { type: "answered"; bot: string; index: number; afterMs: number }
  | { type: "result"; bot: string; result: QuestionResult }
  | { type: "ended"; bot: string; end: QuizEnd }

interface Bot {
  name: string
  adapter: KahootAdapterLike
  status: BotStatus
  paused: boolean
  reconnects: number
  current: number | null
}

interface Round {
  question: Question
  decision: Promise<Decision | null>
  resolved: Decision | null
  recorded: boolean
}

const GONE: BotStatus[] = ["left", "kicked", "finished"]

export class GameSession {
  private readonly bots: Bot[] = []
  private readonly rounds = new Map<number, Round>()
  private readonly previous: PreviousQuestion[] = []
  private readonly listeners = new Set<(event: SessionEvent) => void>()
  private twoStepPending = false

  constructor(
    private readonly settings: SessionSettings,
    private readonly deps: SessionDeps,
  ) {}

  on(fn: (event: SessionEvent) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  async join(pin: string, names: string[]): Promise<void> {
    if (names.length === 0 || names.length > MAX_BOTS) {
      throw new Error(`Use between 1 and ${MAX_BOTS} bots`)
    }
    for (const name of names) {
      const bot = this.addBot(name)
      try {
        await bot.adapter.join(pin, name)
        if (bot.status === "joining") this.setStatus(bot, "lobby")
      } catch (err) {
        this.setStatus(bot, "disconnected", err instanceof Error ? err.message : String(err))
      }
    }
  }

  async submitTwoStep(sequence: number[]): Promise<void> {
    this.twoStepPending = false
    const waiting = this.bots.filter((b) => b.status === "twoStep")
    await Promise.all(waiting.map((b) => b.adapter.submitTwoStep(sequence)))
  }

  pause(name: string, paused: boolean): void {
    const bot = this.bots.find((b) => b.name === name)
    if (!bot || GONE.includes(bot.status) || bot.status === "disconnected") return
    bot.paused = paused
    this.setStatus(bot, paused ? "paused" : bot.current === null ? "lobby" : "playing")
  }

  async leave(name?: string): Promise<void> {
    const leaving = this.bots.filter((b) => name === undefined || b.name === name)
    await Promise.all(
      leaving.map(async (bot) => {
        this.setStatus(bot, "left")
        await bot.adapter.leave().catch(() => {})
      }),
    )
  }

  private addBot(name: string): Bot {
    const bot: Bot = {
      name,
      adapter: this.deps.createAdapter(),
      status: "joining",
      paused: false,
      reconnects: 0,
      current: null,
    }
    this.bots.push(bot)
    const a = bot.adapter
    a.on("twoStepRequired", () => {
      this.setStatus(bot, "twoStep")
      if (this.twoStepPending) return
      this.twoStepPending = true
      this.emit({ type: "twoStepRequired" })
    })
    a.on("twoStepResult", ({ ok }) => {
      if (ok && bot.status === "twoStep") this.setStatus(bot, "lobby")
      this.emit({ type: "twoStepResult", ok })
    })
    a.on("questionReady", ({ question, startsInMs }) => {
      this.prepare(question, this.deps.now() + startsInMs)
    })
    a.on("questionStarted", ({ question }) => void this.play(bot, question))
    a.on("questionEnded", (result) => this.finish(bot, result))
    a.on("quizEnded", (end) => {
      this.setStatus(bot, "finished")
      this.emit({ type: "ended", bot: bot.name, end })
    })
    a.on("disconnected", (d) => void this.onDisconnect(bot, d))
    return bot
  }

  private prepare(question: Question, startedAt: number): Round {
    const existing = this.rounds.get(question.index)
    if (existing) return existing
    const context: AskContext = {
      quizContext: this.settings.quizContext,
      previous: this.settings.includePrevious ? [...this.previous] : [],
    }
    const round: Round = {
      question,
      decision: this.deps.decide(question, startedAt, context).catch(() => null),
      resolved: null,
      recorded: false,
    }
    this.rounds.set(question.index, round)
    this.emit({ type: "question", question })
    void round.decision.then((decision) => {
      if (!decision) return
      round.resolved = decision
      this.emit({ type: "decision", index: question.index, decision })
    })
    return round
  }

  private async play(bot: Bot, question: Question): Promise<void> {
    if (GONE.includes(bot.status) || bot.status === "disconnected") return
    bot.current = question.index
    if (!bot.paused) this.setStatus(bot, "playing")
    const start = this.deps.now()
    const round = this.rounds.get(question.index) ?? this.prepare(question, start)
    const [decision] = await Promise.all([round.decision, sleep(this.delay())])
    if (!decision || decision.answer.kind === "none") return
    if (bot.paused || bot.current !== question.index || GONE.includes(bot.status)) return
    await bot.adapter.answer(decision.answer).catch(() => {})
    this.emit({
      type: "answered",
      bot: bot.name,
      index: question.index,
      afterMs: this.deps.now() - start,
    })
  }

  private finish(bot: Bot, result: QuestionResult): void {
    const index = result.index ?? bot.current
    bot.current = null
    this.emit({ type: "result", bot: bot.name, result })
    const round = index === null ? undefined : this.rounds.get(index)
    const title = round?.question.title
    if (!round || round.recorded || !title) return
    round.recorded = true
    const q = round.question
    this.previous.push({
      index: q.index,
      title,
      answer: round.resolved ? answerText(round.resolved.answer, q) : "–",
      correct: result.correct,
      correctAnswer: result.correctChoices
        ? answerText(correctAnswer(q, result.correctChoices), q)
        : null,
    })
  }

  private async onDisconnect(bot: Bot, d: AdapterEvents["disconnected"]): Promise<void> {
    if (GONE.includes(bot.status)) return
    if (d.kicked) return this.setStatus(bot, "kicked")
    const wait = RECONNECT_DELAYS_MS[bot.reconnects]
    if (!d.retryable || !this.settings.reconnect || wait === undefined) {
      return this.setStatus(bot, "disconnected", d.reason)
    }
    bot.reconnects++
    this.setStatus(bot, "joining", "reconnecting")
    await sleep(wait)
    try {
      await bot.adapter.reconnect()
      bot.reconnects = 0
      this.setStatus(bot, bot.paused ? "paused" : "lobby")
    } catch {
      await this.onDisconnect(bot, d)
    }
  }

  private delay(): number {
    const { mode, minMs, maxMs } = this.settings.timing
    return mode === "human" ? minMs + this.deps.random() * (maxMs - minMs) : 0
  }

  private setStatus(bot: Bot, status: BotStatus, detail?: string): void {
    bot.status = status
    this.emit({ type: "status", bot: bot.name, status, ...(detail ? { detail } : {}) })
  }

  private emit(event: SessionEvent): void {
    for (const fn of this.listeners) fn(event)
  }
}
