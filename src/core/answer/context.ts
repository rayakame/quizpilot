export interface PreviousQuestion {
  index: number
  title: string
  answer: string
  correct: boolean | null
  correctAnswer: string | null
}

export interface AskContext {
  quizContext: string | null
  previous: PreviousQuestion[]
}

export const NO_CONTEXT: AskContext = { quizContext: null, previous: [] }

export function formatPrevious(previous: PreviousQuestion[]): string[] {
  return previous.map((p) => {
    const mark = p.correct === null ? "" : p.correct ? " ✓" : " ✗"
    const fix = p.correct === false && p.correctAnswer ? ` (correct: ${p.correctAnswer})` : ""
    return `Q${p.index + 1}: ${p.title} → ${p.answer}${mark}${fix}`
  })
}
