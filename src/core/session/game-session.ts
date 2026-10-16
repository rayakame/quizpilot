import type { AskContext, PreviousQuestion } from "../answer/context.js"
import { answerText, correctAnswer } from "../answer/describe.js"
import {
  JoinError,
  type AdapterEvents,
  type JoinErrorCode,
  type KahootAdapterLike,
} from "../kahoot/adapter.js"
import type { QuestionResult, QuizEnd, QuizStartInfo } from "../kahoot/normalize.js"
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
  quizStarted?(info: QuizStartInfo): void
  now(): number
  random(): number
}

export type JoinOutcome =
  { name: string; ok: true } | { name: string; ok: false; code: JoinErrorCode; message: string }

export type SessionEvent =
  | { type: "status"; bot: string; status: BotStatus; detail?: string }
  | { type: "joinFailed"; bot: string; code: JoinErrorCode; message: string }
  | { type: "twoStepRequired" }
  | { type: "twoStepResult"; ok: boolean }
  | { type: "question"; question: Question }
  | { type: "decision"; index: number; decision: Decision }
  | { type: "answered"; bot: string; index: number; afterMs: number }
  | { type: "result"; bot: string; result: QuestionResult }
  | { type: "ended"; bot: string; end: QuizEnd }
  | { type: "gameReset" }

interface Bot {
  name: string
  adapter: KahootAdapterLike
  status: BotStatus
  paused: boolean
  joined: boolean
  reconnecting: boolean
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
  private closed = false

  constructor(
    private readonly settings: SessionSettings,
    private readonly deps: SessionDeps,
  ) {}

  on(fn: (event: SessionEvent) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  async join(pin: string, names: string[]): Promise<JoinOutcome[]> {
    const active = this.bots.filter((b) => !GONE.includes(b.status) && b.status !== "disconnected")
    if (names.length === 0 || active.length + names.length > MAX_BOTS) {
      throw new Error(`Use between 1 and ${MAX_BOTS} bots`)
    }
    const used = this.bots.map((b) => b.name.toLowerCase())
    for (const name of names) {
      if (used.includes(name.toLowerCase())) throw new Error(`${name} is already in the game`)
      used.push(name.toLowerCase())
    }
    const outcomes: JoinOutcome[] = []
    for (const name of names) {
      if (this.closed) break
      const bot = this.addBot(name)
      try {
        await bot.adapter.join(pin, name)
        bot.joined = true
        if (bot.status === "joining") this.setStatus(bot, "lobby")
        outcomes.push({ name, ok: true })
      } catch (err) {
        const code = err instanceof JoinError ? err.code : "unknown"
        const message = err instanceof Error ? err.message : String(err)
        this.bots.splice(this.bots.indexOf(bot), 1)
        this.setStatus(bot, "disconnected", message)
        this.emit({ type: "joinFailed", bot: name, code, message })
        // kahoot.js keeps the socket open after a taken name so the player can retry.
        void bot.adapter.leave().catch(() => {})
        outcomes.push({ name, ok: false, code, message })
      }
    }
    return outcomes
  }

  async submitTwoStep(sequence: number[]): Promise<void> {
    this.twoStepPending = false
    const waiting = this.bots.filter((b) => b.status === "twoStep")
    await Promise.all(waiting.map((b) => b.adapter.submitTwoStep(sequence)))
  }

  pause(name: string | null, paused: boolean): void {
    for (const bot of this.bots) {
      if (name !== null && bot.name !== name) continue
      if (GONE.includes(bot.status) || bot.status === "disconnected") continue
      bot.paused = paused
      this.setStatus(bot, paused ? "paused" : bot.current === null ? "lobby" : "playing")
    }
  }

  async leave(name?: string): Promise<void> {
    if (name === undefined) this.closed = true
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
      joined: false,
      reconnecting: false,
      current: null,
    }
    this.bots.push(bot)
    this.setStatus(bot, "joining")
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
    a.on("quizStarted", (info) => this.deps.quizStarted?.(info))
    a.on("questionEnded", (result) => this.finish(bot, result))
    a.on("quizEnded", (end) => {
      this.setStatus(bot, "finished")
      this.emit({ type: "ended", bot: bot.name, end })
    })
    a.on("gameReset", () => {
      if (this.rounds.size > 0 || this.previous.length > 0) {
        this.rounds.clear()
        this.previous.length = 0
        this.emit({ type: "gameReset" })
      }
      bot.current = null
      if (bot.status === "finished") this.setStatus(bot, bot.paused ? "paused" : "lobby")
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
    // A failed reconnect makes kahoot.js report another lost connection; the running loop owns it.
    if (bot.reconnecting || GONE.includes(bot.status) || bot.status === "disconnected") return
    if (d.kicked) return this.setStatus(bot, "kicked")
    if (!bot.joined || !d.retryable || !this.settings.reconnect) {
      return this.setStatus(bot, "disconnected", d.reason)
    }
    bot.reconnecting = true
    for (const wait of RECONNECT_DELAYS_MS) {
      this.setStatus(bot, "joining", "reconnecting")
      await sleep(wait)
      if (GONE.includes(bot.status)) break
      try {
        await bot.adapter.reconnect()
        bot.reconnecting = false
        return this.setStatus(bot, bot.paused ? "paused" : "lobby")
      } catch {
        continue
      }
    }
    bot.reconnecting = false
    if (!GONE.includes(bot.status)) this.setStatus(bot, "disconnected", d.reason)
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
