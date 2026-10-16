import type { Answer, Question } from "../types.js"
import { Emitter } from "../util/emitter.js"
import {
  toKahootAnswer,
  toQuestion,
  toQuizEnd,
  toQuizStart,
  toResult,
  toUpcoming,
  type KahootPayload,
  type QuestionResult,
  type QuizEnd,
  type QuizStartInfo,
} from "./normalize.js"
import type { RawMessage } from "./raw.js"
import { recoveryRequest, TwoStepGate, twoStepAnswer, twoStepEvent } from "./two-step.js"

export interface KahootClientLike {
  handlers: Record<string, (message: unknown) => void>
  clientId: string
  on(event: string, listener: (...args: never[]) => void): unknown
  join(pin: string, name: string): Promise<unknown>
  answer(choice: number | number[] | string): Promise<unknown>
  leave(): Promise<unknown>
  reconnect(): Promise<unknown>
  _send(message: unknown): Promise<unknown>
  _message?(frame: string): void
  quiz?: { currentQuestion?: Record<string, unknown> }
}

export interface AdapterEvents {
  joined: Record<string, never>
  twoStepRequired: Record<string, never>
  twoStepResult: { ok: boolean }
  quizStarted: QuizStartInfo
  questionReady: { question: Question; startsInMs: number }
  questionStarted: { question: Question }
  questionEnded: QuestionResult
  quizEnded: QuizEnd
  gameReset: Record<string, never>
  disconnected: { reason: string; kicked: boolean; retryable: boolean }
}

export interface KahootAdapterLike {
  on<K extends keyof AdapterEvents>(event: K, fn: (payload: AdapterEvents[K]) => void): () => void
  join(pin: string, name: string): Promise<void>
  answer(answer: Answer): Promise<void>
  submitTwoStep(sequence: number[]): Promise<void>
  leave(): Promise<void>
  reconnect(): Promise<void>
}

export type JoinErrorCode = "not_found" | "duplicate_name" | "locked" | "unknown"

export class JoinError extends Error {
  constructor(
    readonly code: JoinErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "JoinError"
  }
}

export class KahootAdapter extends Emitter<AdapterEvents> implements KahootAdapterLike {
  private readonly gate = new TwoStepGate()
  private pin = ""
  private ended = false

  constructor(private readonly client: KahootClientLike) {
    super()
    const handle = client._message?.bind(client)
    if (handle) {
      // kahoot.js only reads the first message of a frame, but CometD may batch several.
      client._message = (frame: string) => {
        const messages: unknown = JSON.parse(frame)
        if (!Array.isArray(messages)) return handle(frame)
        for (const message of messages) handle(JSON.stringify([message]))
      }
    }
    client.handlers.quizpilot = (message) => void this.onRaw(message as RawMessage)
    client.on("QuizStart", (p: KahootPayload) => this.emit("quizStarted", toQuizStart(p)))
    client.on("QuestionReady", (p: KahootPayload) => this.emit("questionReady", toUpcoming(p)))
    client.on("QuestionStart", (p: KahootPayload) => {
      const question = toQuestion(p)
      // kahoot.js takes the answer's question index from QuestionReady, which late joiners miss.
      const quiz = (client.quiz ??= {})
      quiz.currentQuestion = {
        ...quiz.currentQuestion,
        ...p,
        questionIndex: question.index,
        gameBlockType: p.gameBlockType ?? p.type,
      }
      this.emit("questionStarted", { question })
    })
    client.on("QuestionEnd", (p: KahootPayload) => this.emit("questionEnded", toResult(p)))
    client.on("Podium", (p: KahootPayload) => {
      // Kahoot sends the podium twice.
      if (this.ended) return
      this.ended = true
      this.emit("quizEnded", toQuizEnd(p))
    })
    client.on("GameReset", () => {
      this.ended = false
      this.emit("gameReset", {})
    })
    client.on("Disconnect", (reason: string) =>
      this.emit("disconnected", {
        reason,
        kicked: reason === "Kicked",
        retryable: reason === "Lost Connection",
      }),
    )
  }

  async join(pin: string, name: string): Promise<void> {
    this.pin = pin
    try {
      await this.client.join(pin, name)
    } catch (err) {
      throw toJoinError(err)
    }
    this.emit("joined", {})
  }

  async answer(answer: Answer): Promise<void> {
    const choice = toKahootAnswer(answer)
    if (choice !== null) await this.client.answer(choice)
  }

  async submitTwoStep(sequence: number[]): Promise<void> {
    this.gate.answered()
    await this.client._send(twoStepAnswer(this.pin, sequence, this.client.clientId))
  }

  async leave(): Promise<void> {
    await this.client.leave()
  }

  async reconnect(): Promise<void> {
    await this.client.reconnect()
  }

  private async onRaw(message: RawMessage) {
    const event = twoStepEvent(message)
    const ask = this.gate.shouldAsk(event)
    if (event === "wrong") this.emit("twoStepResult", { ok: false })
    if (event === "correct") {
      this.emit("twoStepResult", { ok: true })
      // Without a fresh recovery request the host never lists the player.
      await this.client._send(recoveryRequest(this.pin, this.client.clientId)).catch(() => {})
    }
    if (ask) this.emit("twoStepRequired", {})
  }
}

const UNKNOWN_PIN = ["Invalid/Missing PIN", "Missing header token (pin doesn't exist)"]

function toJoinError(err: unknown): JoinError {
  const e = (err !== null && typeof err === "object" ? err : {}) as {
    description?: unknown
    status?: unknown
    error?: { response?: { statusCode?: unknown } }
  }
  if (e.description === "Duplicate name")
    return new JoinError("duplicate_name", "Name is already taken")
  if (e.status === "LOCKED") return new JoinError("locked", "Game is locked")
  // kahoot.js reports an unknown PIN as a failed request; only the HTTP status tells.
  const notFound = e.error?.response?.statusCode === 404
  if (notFound || (typeof e.description === "string" && UNKNOWN_PIN.includes(e.description))) {
    return new JoinError("not_found", "No game with this PIN")
  }
  const message =
    typeof err === "string"
      ? err
      : typeof e.description === "string"
        ? e.description
        : "Join failed"
  return new JoinError("unknown", message)
}
