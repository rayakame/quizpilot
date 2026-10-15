import Anthropic from "@anthropic-ai/sdk"
import { GoogleGenAI } from "@google/genai"
import OpenAI from "openai"
import type { FallbackProvider } from "../../answer/engine.js"
import { createClaudeFallback } from "./anthropic.js"
import { createGeminiFallback } from "./gemini.js"
import { DEFAULT_MODELS, type FallbackProviderId } from "./ids.js"
import { createOpenAIFallback } from "./openai.js"

export function createFallback(
  provider: FallbackProviderId,
  apiKey: string,
  model = DEFAULT_MODELS[provider],
): FallbackProvider {
  switch (provider) {
    case "anthropic":
      return createClaudeFallback(new Anthropic({ apiKey }), model)
    case "openai":
      return createOpenAIFallback(new OpenAI({ apiKey }), model)
    case "gemini":
      return createGeminiFallback(new GoogleGenAI({ apiKey }), model)
  }
}
