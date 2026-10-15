export type QuestionType =
  | "quiz"
  | "true_false"
  | "multiple_select_quiz"
  | "jumble"
  | "slider"
  | "open_ended"
  | "survey"
  | "word_cloud"
  | "content"
  | "unknown"

export interface ImageRef {
  url: string
}

export interface Choice {
  text: string | null
  image: ImageRef | null
}

export interface SliderRange {
  min: number
  max: number
  step: number
}

export interface Question {
  index: number
  type: QuestionType
  title: string | null
  choices: Choice[]
  image: ImageRef | null
  timeLimitMs: number
  slider?: SliderRange
  raw: unknown
}

export type Answer =
  | { kind: "choice"; index: number }
  | { kind: "choices"; indices: number[] }
  | { kind: "order"; order: number[] }
  | { kind: "number"; value: number }
  | { kind: "text"; value: string }
  | { kind: "none" }

export type DecisionSource = "quiz-link" | "jev" | "fallback" | "random" | "skip"

export interface Usage {
  provider: string
  model: string
  inputTokens: number | null
  outputTokens: number | null
}

export interface Decision {
  answer: Answer
  source: DecisionSource
  confidence: number | null
  jev?: { answer: Answer; confidence: number | null; probabilities?: number[] }
  fallback?: { provider: string; model: string; latencyMs: number }
  usage: Usage[]
}
