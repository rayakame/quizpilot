import type { QuestionType } from "../../../core/types.js"

export interface ChoiceStyle {
  shape: string
  color: string
  name: string
}

export const COLORS: ChoiceStyle[] = [
  { shape: "▲", color: "bg-[#e21b3c]", name: "red triangle" },
  { shape: "◆", color: "bg-[#1368ce]", name: "blue diamond" },
  { shape: "●", color: "bg-[#d89e00]", name: "yellow circle" },
  { shape: "■", color: "bg-[#26890c]", name: "green square" },
]

export function choiceStyle(type: QuestionType, index: number): ChoiceStyle {
  // Kahoot shows "true" in blue and "false" in red.
  const slot = type === "true_false" ? ([1, 0][index] ?? index) : index
  return COLORS[slot] ?? { shape: String(index + 1), color: "bg-neutral-500", name: "gray" }
}
