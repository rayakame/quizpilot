export type FallbackProviderId = "anthropic" | "openai" | "gemini"

export const FALLBACK_PROVIDERS: FallbackProviderId[] = ["anthropic", "openai", "gemini"]

export const PROVIDER_NAMES: Record<FallbackProviderId, string> = {
  anthropic: "Claude",
  openai: "OpenAI",
  gemini: "Gemini",
}

export const DEFAULT_MODELS: Record<FallbackProviderId, string> = {
  anthropic: "claude-sonnet-5-5",
  openai: "gpt-6.1-sol",
  gemini: "gemini-3.8-flash",
}
