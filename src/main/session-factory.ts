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
import { fallbackFor } from "./fallback.js"
import type { Config } from "./settings.js"

export function createSession(
  request: StartRequest,
  config: Config,
  quiz: KnownQuiz | null,
): GameSession {
  const answers = new AnswerKey(quiz?.questions ?? [])
  const jev = createJev(new TypeSafeClient({ apiKey: config.keys.typesafe }))
  const fallback = fallbackFor(config)
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
