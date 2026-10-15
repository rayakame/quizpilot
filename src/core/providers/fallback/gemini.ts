import {
  ThinkingLevel,
  type GenerateContentParameters,
  type GenerateContentResponse,
  type Part,
} from "@google/genai"
import type { FallbackProvider } from "../../answer/engine.js"
import { DEFAULT_MODELS } from "./ids.js"
import { base64, buildRequest, parseAnswer, type FallbackPart } from "./request.js"

export interface GeminiLike {
  models: { generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse> }
}

export function createGeminiFallback(
  client: GeminiLike,
  model = DEFAULT_MODELS.gemini,
): FallbackProvider {
  return {
    async decide(input, { signal, webSearch }) {
      const request = buildRequest(input, webSearch)
      const response = await client.models.generateContent({
        model,
        contents: [{ role: "user", parts: request.parts.map(toPart) }],
        config: {
          systemInstruction: request.system,
          responseMimeType: "application/json",
          responseJsonSchema: request.schema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          abortSignal: signal,
          ...(webSearch ? { tools: [{ googleSearch: {} }] } : {}),
        },
      })
      const parsed = parseAnswer(input.question, response.text ?? "")
      const used = response.modelVersion ?? model
      const meta = response.usageMetadata
      return {
        ...parsed,
        provider: "gemini",
        model: used,
        usage: {
          provider: "gemini",
          model: used,
          inputTokens: meta?.promptTokenCount ?? null,
          outputTokens: meta
            ? (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0)
            : null,
        },
      }
    },
  }
}

function toPart(part: FallbackPart): Part {
  if (part.type === "text") return { text: part.text }
  return { inlineData: { mimeType: "image/jpeg", data: base64(part.jpeg) } }
}
