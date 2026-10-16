import type { Answer, QuestionType } from "../types.js"

export function isRight(
  answer: Answer,
  type: QuestionType,
  correctChoices: number[],
): boolean | null {
  switch (answer.kind) {
    case "choice":
      return correctChoices.includes(answer.index)
    case "choices": {
      if (type !== "multiple_select_quiz") return null
      const want = new Set(correctChoices)
      return answer.indices.length === want.size && answer.indices.every((i) => want.has(i))
    }
    case "order":
      return (
        answer.order.length === correctChoices.length &&
        answer.order.every((v, i) => v === correctChoices[i])
      )
    default:
      return null
  }
}
