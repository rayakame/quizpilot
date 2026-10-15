import type { Answer, Question } from "../types.js"

export function choiceLabel(q: Question, index: number): string {
  return q.choices[index]?.text ?? `#${index + 1}`
}

export function answerText(answer: Answer, q: Question): string {
  switch (answer.kind) {
    case "choice":
      return choiceLabel(q, answer.index)
    case "choices":
      return answer.indices.map((i) => choiceLabel(q, i)).join(", ")
    case "order":
      return answer.order.map((i) => choiceLabel(q, i)).join(" → ")
    case "number":
      return String(answer.value)
    case "text":
      return answer.value
    case "none":
      return "–"
  }
}

export function correctAnswer(q: Question, correctChoices: number[]): Answer {
  if (q.type === "jumble") return { kind: "order", order: correctChoices }
  if (q.type === "multiple_select_quiz") return { kind: "choices", indices: correctChoices }
  return { kind: "choice", index: correctChoices[0] ?? 0 }
}
