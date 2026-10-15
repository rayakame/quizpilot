import { DEFAULT_MODELS, type FallbackProviderId } from "./ids.js"

export type Effort = "minimal" | "low" | "medium" | "high"

export interface ModelOption {
  id: string
  name: string
  note: string
  efforts: Effort[]
}

export interface ModelChoice {
  model: string
  effort: Effort | null
}

const STANDARD: Effort[] = ["low", "medium", "high"]

export const MODELS: Record<FallbackProviderId, ModelOption[]> = {
  anthropic: [
    { id: "claude-opus-5-5", name: "Claude Opus 5.5", note: "most accurate", efforts: STANDARD },
    { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", note: "balanced", efforts: STANDARD },
    // Haiku 4.5 rejects the effort setting.
    { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", note: "fastest", efforts: [] },
  ],
  openai: [
    { id: "gpt-6-astra", name: "GPT-6 Astra", note: "most accurate", efforts: STANDARD },
    { id: "gpt-6.1-sol", name: "GPT-6.1 Sol", note: "balanced", efforts: STANDARD },
    { id: "gpt-6-luna", name: "GPT-6 Luna", note: "fastest", efforts: STANDARD },
  ],
  gemini: [
    { id: "gemini-4-argon", name: "Gemini 4 Argon", note: "most accurate", efforts: STANDARD },
    { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", note: "balanced", efforts: STANDARD },
    {
      id: "gemini-3.5-flash-lite",
      name: "Gemini 3.5 Flash-Lite",
      note: "fastest",
      efforts: ["minimal", ...STANDARD],
    },
  ],
}

export function resolveChoice(
  provider: FallbackProviderId,
  model?: string,
  effort?: string | null,
): ModelChoice {
  const options = MODELS[provider]
  const option =
    options.find((o) => o.id === model) ?? options.find((o) => o.id === DEFAULT_MODELS[provider])!
  if (option.efforts.length === 0) return { model: option.id, effort: null }
  return { model: option.id, effort: option.efforts.find((e) => e === effort) ?? "low" }
}
