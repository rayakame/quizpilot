import type OpenAI from "openai"
import type { FallbackProvider } from "../../answer/engine.js"
import { DEFAULT_MODELS } from "./ids.js"
import { base64, buildRequest, parseAnswer, type FallbackPart } from "./request.js"

type CreateParams = OpenAI.Responses.ResponseCreateParamsNonStreaming
type InputContent = OpenAI.Responses.ResponseInputContent

export interface OpenAILike {
  responses: {
    create(
      params: CreateParams,
      options?: { signal?: AbortSignal },
    ): PromiseLike<OpenAI.Responses.Response>
  }
}

export function createOpenAIFallback(
  client: OpenAILike,
  model = DEFAULT_MODELS.openai,
): FallbackProvider {
  return {
    async decide(input, { signal, webSearch }) {
      const request = buildRequest(input, webSearch)
      const response = await client.responses.create(
        {
          model,
          store: false,
          reasoning: { effort: "low" },
          instructions: request.system,
          input: [{ role: "user", content: request.parts.map(toContent) }],
          text: {
            format: { type: "json_schema", name: "answer", schema: request.schema, strict: true },
          },
          ...(webSearch ? { tools: [{ type: "web_search", search_context_size: "low" }] } : {}),
        },
        { signal },
      )
      const parsed = parseAnswer(input.question, response.output_text)
      return {
        ...parsed,
        provider: "openai",
        model: response.model,
        usage: {
          provider: "openai",
          model: response.model,
          inputTokens: response.usage?.input_tokens ?? null,
          outputTokens: response.usage?.output_tokens ?? null,
        },
      }
    },
  }
}

function toContent(part: FallbackPart): InputContent {
  if (part.type === "text") return { type: "input_text", text: part.text }
  return {
    type: "input_image",
    image_url: `data:image/jpeg;base64,${base64(part.jpeg)}`,
    detail: "auto",
  }
}
