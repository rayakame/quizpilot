import type Anthropic from "@anthropic-ai/sdk"
import type { FallbackProvider } from "../../answer/engine.js"
import { resolveChoice, type ModelChoice } from "./models.js"
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
  choice: ModelChoice = resolveChoice("anthropic"),
): FallbackProvider {
  // Haiku 4.5 predates server-side refusal fallback and the current web search tool.
  const current = choice.model !== "claude-haiku-4-5"
  const effort = choice.effort === "minimal" ? null : choice.effort
  const search = current
    ? ({ type: "web_search_20260209", name: "web_search", max_uses: 2 } as const)
    : ({ type: "web_search_20250305", name: "web_search", max_uses: 2 } as const)
  return {
    async decide(input, { signal, webSearch }) {
      const request = buildRequest(input, webSearch)
      const message = await client.beta.messages.create(
        {
          model: choice.model,
          max_tokens: 8000,
          ...(current
            ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
            : {}),
          output_config: {
            ...(effort ? { effort } : {}),
            format: { type: "json_schema", schema: request.schema },
          },
          system: request.system,
          messages: [{ role: "user", content: request.parts.map(toBlock) }],
          ...(webSearch ? { tools: [search] } : {}),
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
