import { TypeSafeClient } from "@typesafe-ai/sdk"
import Kahoot from "kahoot.js-latest"
import { decide, type EngineSettings } from "../core/answer/engine.js"
import { KahootAdapter } from "../core/kahoot/adapter.js"
import { createImageLoader } from "../core/media/image-loader.js"
import { createJev } from "../core/providers/jev.js"
import { AnswerKey } from "../core/quiz-source/answer-key.js"
import type { KnownQuiz } from "../core/quiz-source/link.js"
import { GameSession } from "../core/session/game-session.js"
import type { StartRequest } from "../shared/api.js"
import { MAX_MISTAKES } from "../shared/start.js"
import { fallbackFor } from "./fallback.js"
import type { LogEntry } from "./game-log.js"
import { watchJev } from "./jev-watch.js"
import type { Config } from "./settings.js"

export function mistakeRate(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0
  return Math.min(MAX_MISTAKES, Math.max(0, value))
}

export interface SessionHooks {
  log?(entry: LogEntry): void
  keyRejected?(): void
}

export function createSession(
  request: StartRequest,
  config: Config,
  quiz: KnownQuiz | null,
  hooks: SessionHooks = {},
): GameSession {
  const answers = new AnswerKey(quiz?.questions ?? [])
  const jev = watchJev(createJev(new TypeSafeClient({ apiKey: config.keys.typesafe })), {
    failed: (err) => hooks.log?.({ level: "warn", message: "Jev failed", detail: err }),
    keyRejected: () => hooks.keyRejected?.(),
  })
  const fallback = fallbackFor(config, (message) => hooks.log?.({ level: "warn", message }))
  const loadImage = createImageLoader()
  const engine: EngineSettings = {
    fallbackBelow: config.fallback.below,
    imageInstantAt: config.fallback.imageInstantAt,
    webSearch: config.fallback.webSearch,
  }
  return new GameSession(
    {
      timing: request.timing,
      quizContext: request.quizContext,
      includePrevious: request.includePrevious,
      reconnect: config.behavior.reconnect,
      mistakes: mistakeRate(request.mistakes),
    },
    {
      createAdapter: () => new KahootAdapter(new Kahoot()),
      decide: (q, startedAt, context) =>
        decide(q, startedAt, context, engine, {
          jev,
          fallback,
          loadImage,
          solutions: answers,
          now: Date.now,
          random: Math.random,
        }),
      quizStarted: (info) => answers.start(info),
      now: Date.now,
      random: Math.random,
    },
  )
}
