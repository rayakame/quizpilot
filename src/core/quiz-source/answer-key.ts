import type { QuizSolutions } from "../answer/engine.js"
import { questionType, type QuizStartInfo } from "../kahoot/normalize.js"
import { cleanText } from "../kahoot/text.js"
import type { Answer, Choice, Question, QuestionType } from "../types.js"
import type { KnownQuestion } from "./link.js"

const MEDIA = "https://media.kahoot.it/"
const CHOICE_TYPES = new Set<QuestionType>([
  "quiz",
  "true_false",
  "multiple_select_quiz",
  "jumble",
  "survey",
])

interface KnownChoice {
  text: string | null
  image: string | null
  correct: boolean
}

export class AnswerKey implements QuizSolutions {
  private game: QuizStartInfo = { randomQuestions: null, randomAnswers: null, first: null }

  constructor(private readonly questions: KnownQuestion[]) {}

  start(info: QuizStartInfo): void {
    this.game = info
  }

  answerFor(q: Question): Answer | null {
    const k = this.find(q)
    return k ? this.solve(k, q) : null
  }

  private find(q: Question): KnownQuestion | null {
    const all = this.questions.map((k, index) => ({ k, index }))
    if (this.game.first) all.push({ k: this.game.first, index: 0 })
    const fits = all.filter(({ k }) => questionType(k.type, k.layout) === q.type)
    if (q.title !== null) {
      const title = normalize(q.title)
      const same = fits.filter(({ k }) => normalize(cleanText(k.question) ?? "") === title)
      const hit = same.find((e) => e.index === q.index) ?? (same.length === 1 ? same[0] : undefined)
      return hit?.k ?? null
    }
    // Without the question text only its position tells, so everything else has to match too.
    if (this.game.randomQuestions !== false) return null
    const hit = fits.find(
      ({ k, index }) =>
        index === q.index &&
        k.time === q.timeLimitMs &&
        (!CHOICE_TYPES.has(q.type) || knownChoices(k).length === q.choices.length),
    )
    return hit?.k ?? null
  }

  private solve(k: KnownQuestion, q: Question): Answer | null {
    const choices = knownChoices(k)
    switch (q.type) {
      case "quiz":
      case "true_false": {
        for (const [i, c] of choices.entries()) {
          const index = c.correct ? this.place(choices, i, q, false) : null
          if (index !== null) return { kind: "choice", index }
        }
        return null
      }
      case "multiple_select_quiz": {
        const picks = choices.flatMap((c, i) =>
          c.correct ? [this.place(choices, i, q, false)] : [],
        )
        const indices = picks.filter((i): i is number => i !== null)
        return indices.length > 0 && indices.length === picks.length
          ? { kind: "choices", indices }
          : null
      }
      case "jumble": {
        // Kahoot shuffles puzzle pieces in every game, so only their texts tell them apart.
        const order = choices.map((_, i) => this.place(choices, i, q, true))
        const placed = order.filter((i): i is number => i !== null)
        const complete =
          placed.length === order.length &&
          placed.length === q.choices.length &&
          new Set(placed).size === placed.length
        return complete && placed.length > 0 ? { kind: "order", order: placed } : null
      }
      case "slider": {
        const correct = record(k.choiceRange)?.correct
        return typeof correct === "number" && Number.isFinite(correct)
          ? { kind: "number", value: correct }
          : null
      }
      case "open_ended": {
        const text = choices.find((c) => c.text !== null)?.text
        return text ? { kind: "text", value: text } : null
      }
      default:
        return null
    }
  }

  private place(choices: KnownChoice[], i: number, q: Question, shuffled: boolean): number | null {
    const c = choices[i]!
    const matches = q.choices.flatMap((g, j) => (sameChoice(c, g) ? [j] : []))
    if (matches.length === 1) return matches[0]!
    const keepsOrder =
      !shuffled && this.game.randomAnswers === false && choices.length === q.choices.length
    const hidden = q.choices.every((g) => g.text === null && g.image === null)
    if (keepsOrder && (matches.length === 0 ? hidden : matches.includes(i))) return i
    return null
  }
}

function knownChoices(k: KnownQuestion): KnownChoice[] {
  if (!Array.isArray(k.choices)) return []
  return k.choices.map((raw) => {
    const c = record(raw)
    const id = record(c?.image)?.id
    return {
      text: cleanText(c?.answer),
      image: typeof id === "string" && id !== "" ? id : null,
      correct: c?.correct === true,
    }
  })
}

function sameChoice(c: KnownChoice, g: Choice): boolean {
  if (c.image !== null && g.image !== null) return g.image.url === MEDIA + c.image
  return c.text !== null && g.text !== null && normalize(c.text) === normalize(g.text)
}

function normalize(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim()
}

function record(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" ? (v as Record<string, unknown>) : null
}
