import Anthropic from "@anthropic-ai/sdk"
import { GoogleGenAI } from "@google/genai"
import OpenAI from "openai"
import type { FallbackProvider } from "../../answer/engine.js"
import { createClaudeFallback } from "./anthropic.js"
import { createGeminiFallback } from "./gemini.js"
import type { FallbackProviderId } from "./ids.js"
import { resolveChoice, type ModelChoice } from "./models.js"
import { createOpenAIFallback } from "./openai.js"

export function createFallback(
  provider: FallbackProviderId,
  apiKey: string,
  choice: ModelChoice = resolveChoice(provider),
): FallbackProvider {
  switch (provider) {
    case "anthropic":
      return createClaudeFallback(new Anthropic({ apiKey }), choice)
    case "openai":
      return createOpenAIFallback(new OpenAI({ apiKey }), choice)
    case "gemini":
      return createGeminiFallback(new GoogleGenAI({ apiKey }), choice)
  }
}
