import type Anthropic from "@anthropic-ai/sdk"
import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai"
import type OpenAI from "openai"
import { describe, expect, it } from "vitest"
import { NO_CONTEXT } from "../../../../src/core/answer/context.js"
import type { FallbackInput } from "../../../../src/core/answer/engine.js"
import { createClaudeFallback } from "../../../../src/core/providers/fallback/anthropic.js"
import { createGeminiFallback } from "../../../../src/core/providers/fallback/gemini.js"
import { createOpenAIFallback } from "../../../../src/core/providers/fallback/openai.js"

const input: FallbackInput = {
  question: {
    index: 0,
    type: "quiz",
    title: "Welches Land?",
    choices: ["Frankreich", "Spanien"].map((text) => ({ text, image: null })),
    image: { url: "https://media.kahoot.it/x" },
    timeLimitMs: 20_000,
    raw: null,
  },
  questionImage: new Uint8Array([255, 216, 255]),
  optionImages: [null, null],
  context: NO_CONTEXT,
  jev: null,
}

const signal = new AbortController().signal
const answer = '{"choice":0,"confidence":0.9}'

function claude(message: Partial<Anthropic.Beta.BetaMessage>) {
  const calls: { params: Anthropic.Beta.MessageCreateParamsNonStreaming; signal?: AbortSignal }[] =
    []
  const provider = createClaudeFallback({
    beta: {
      messages: {
        create: async (params, options) => {
          calls.push({ params, signal: options?.signal })
          return {
            model: "claude-opus-5-5",
            stop_reason: "end_turn",
            content: [{ type: "text", text: answer, citations: null }],
            usage: { input_tokens: 900, output_tokens: 40 },
            ...message,
          } as Anthropic.Beta.BetaMessage
        },
      },
    },
  })
  return { provider, calls }
}

describe("Claude fallback", () => {
  it("asks Opus with low effort, a JSON schema and the image", async () => {
    const { provider, calls } = claude({})
    const r = await provider.decide(input, { signal, webSearch: false })
    expect(r).toEqual({
      answer: { kind: "choice", index: 0 },
      confidence: 0.9,
      provider: "anthropic",
      model: "claude-opus-5-5",
      usage: {
        provider: "anthropic",
        model: "claude-opus-5-5",
        inputTokens: 900,
        outputTokens: 40,
      },
    })
    const { params } = calls[0]!
    expect(params.model).toBe("claude-opus-5-5")
    expect(params.fallbacks).toBe("default")
    expect(params.betas).toEqual(["server-side-fallback-2026-07-01"])
    expect(params.output_config?.effort).toBe("low")
    expect(params.output_config?.format?.type).toBe("json_schema")
    expect(params.tools).toBeUndefined()
    const content = params.messages[0]!.content as Anthropic.Beta.BetaContentBlockParam[]
    expect(content[2]).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: "/9j/" },
    })
    expect(calls[0]!.signal).toBe(signal)
  })

  it("adds web search only when allowed", async () => {
    const { provider, calls } = claude({})
    await provider.decide(input, { signal, webSearch: true })
    expect(calls[0]!.params.tools).toEqual([
      { type: "web_search_20260209", name: "web_search", max_uses: 2 },
    ])
  })

  it("joins text split by citations", async () => {
    const { provider } = claude({
      content: [
        { type: "text", text: '{"choice":1,', citations: null },
        { type: "text", text: '"confidence":0.6}', citations: null },
      ],
    })
    expect((await provider.decide(input, { signal, webSearch: true })).answer).toEqual({
      kind: "choice",
      index: 1,
    })
  })

  it("gives up when Claude declines", async () => {
    const { provider } = claude({ stop_reason: "refusal", content: [] })
    await expect(provider.decide(input, { signal, webSearch: false })).rejects.toThrow("declined")
  })
})

describe("OpenAI fallback", () => {
  function openai(output_text = answer) {
    const calls: {
      params: OpenAI.Responses.ResponseCreateParamsNonStreaming
      signal?: AbortSignal
    }[] = []
    const provider = createOpenAIFallback({
      responses: {
        create: async (params, options) => {
          calls.push({ params, signal: options?.signal })
          return {
            model: "gpt-6.1-sol",
            output_text,
            usage: { input_tokens: 700, output_tokens: 30 },
          } as OpenAI.Responses.Response
        },
      },
    })
    return { provider, calls }
  }

  it("uses the Responses API with a strict schema, no storage and the image", async () => {
    const { provider, calls } = openai()
    const r = await provider.decide(input, { signal, webSearch: false })
    expect(r.usage).toEqual({
      provider: "openai",
      model: "gpt-6.1-sol",
      inputTokens: 700,
      outputTokens: 30,
    })
    const { params } = calls[0]!
    expect(params).toMatchObject({
      model: "gpt-6.1-sol",
      store: false,
      reasoning: { effort: "low" },
      text: { format: { type: "json_schema", name: "answer", strict: true } },
    })
    expect(params.tools).toBeUndefined()
    const content = (params.input as OpenAI.Responses.ResponseInputItem[])[0] as {
      content: OpenAI.Responses.ResponseInputContent[]
    }
    expect(content.content[2]).toEqual({
      type: "input_image",
      image_url: "data:image/jpeg;base64,/9j/",
      detail: "auto",
    })
    expect(calls[0]!.signal).toBe(signal)
  })

  it("adds web search only when allowed", async () => {
    const { provider, calls } = openai()
    await provider.decide(input, { signal, webSearch: true })
    expect(calls[0]!.params.tools).toEqual([{ type: "web_search", search_context_size: "low" }])
  })

  it("fails on an empty answer, for example a refusal", async () => {
    const { provider } = openai("")
    await expect(provider.decide(input, { signal, webSearch: false })).rejects.toThrow()
  })
})

describe("Gemini fallback", () => {
  function gemini(response: Partial<GenerateContentResponse> = {}) {
    const calls: GenerateContentParameters[] = []
    const provider = createGeminiFallback({
      models: {
        generateContent: async (params) => {
          calls.push(params)
          return {
            text: answer,
            modelVersion: "gemini-3.8-flash",
            usageMetadata: {
              promptTokenCount: 600,
              candidatesTokenCount: 20,
              thoughtsTokenCount: 50,
            },
            ...response,
          } as GenerateContentResponse
        },
      },
    })
    return { provider, calls }
  }

  it("asks for JSON with low thinking and counts thoughts as output", async () => {
    const { provider, calls } = gemini()
    const r = await provider.decide(input, { signal, webSearch: false })
    expect(r.usage).toEqual({
      provider: "gemini",
      model: "gemini-3.8-flash",
      inputTokens: 600,
      outputTokens: 70,
    })
    const config = calls[0]!.config!
    expect(config.responseMimeType).toBe("application/json")
    expect(config.thinkingConfig).toEqual({ thinkingLevel: "LOW" })
    expect(config.abortSignal).toBe(signal)
    expect(config.tools).toBeUndefined()
    const parts = (calls[0]!.contents as { parts: unknown[] }[])[0]!.parts
    expect(parts[2]).toEqual({ inlineData: { mimeType: "image/jpeg", data: "/9j/" } })
  })

  it("adds Google Search only when allowed", async () => {
    const { provider, calls } = gemini()
    await provider.decide(input, { signal, webSearch: true })
    expect(calls[0]!.config!.tools).toEqual([{ googleSearch: {} }])
  })

  it("fails when Gemini sends no text", async () => {
    const { provider } = gemini({ text: undefined })
    await expect(provider.decide(input, { signal, webSearch: false })).rejects.toThrow()
  })
})
