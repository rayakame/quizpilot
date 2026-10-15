import type Anthropic from "@anthropic-ai/sdk"
import type { FallbackProvider } from "../../answer/engine.js"
import { DEFAULT_MODELS } from "./ids.js"
import { base64, buildRequest, parseAnswer, type FallbackPart } from "./request.js"

type CreateParams = Anthropic.Beta.MessageCreateParamsNonStreaming
type ContentBlock = Anthropic.Beta.BetaContentBlockParam

export interface AnthropicLike {
  beta: {
    messages: {
      create(
        params: CreateParams,
        options?: { signal?: AbortSignal },
      ): PromiseLike<Anthropic.Beta.BetaMessage>
    }
  }
}

export function createClaudeFallback(
  client: AnthropicLike,
  model = DEFAULT_MODELS.anthropic,
): FallbackProvider {
  return {
    async decide(input, { signal, webSearch }) {
      const request = buildRequest(input, webSearch)
      const message = await client.beta.messages.create(
        {
          model,
          max_tokens: 8000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          // Opus 5.5 always thinks; low effort keeps that short.
          output_config: { effort: "low", format: { type: "json_schema", schema: request.schema } },
          system: request.system,
          messages: [{ role: "user", content: request.parts.map(toBlock) }],
          ...(webSearch
            ? { tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 2 }] }
            : {}),
        },
        { signal },
      )
      if (message.stop_reason === "refusal") throw new Error("Claude declined the question")
      const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("")
      const parsed = parseAnswer(input.question, text)
      return {
        ...parsed,
        provider: "anthropic",
        model: message.model,
        usage: {
          provider: "anthropic",
          model: message.model,
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
        },
      }
    },
  }
}

function toBlock(part: FallbackPart): ContentBlock {
  if (part.type === "text") return { type: "text", text: part.text }
  return {
    type: "image",
    source: { type: "base64", media_type: "image/jpeg", data: base64(part.jpeg) },
  }
}
