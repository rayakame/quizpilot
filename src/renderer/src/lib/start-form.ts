import { generateName } from "../../../core/names/names.js"
import { MAX_BOTS } from "../../../core/session/game-session.js"
import type { PublicSettings, StartProblem, StartRequest, Timing } from "../../../shared/api.js"
import { nameProblem, parsePin, timingProblem } from "../../../shared/start.js"

export interface BotField {
  value: string
  placeholder: string
}

export interface StartForm {
  pin: string
  bots: BotField[]
  human: boolean
  minSeconds: number
  maxSeconds: number
  context: string
  includePrevious: boolean
}

export function botName(field: BotField): string {
  return field.value.trim() || field.placeholder
}

export function addField(bots: BotField[], random: () => number = Math.random): BotField[] {
  if (bots.length >= MAX_BOTS) return bots
  const taken = bots.flatMap((b) => [b.value.trim(), b.placeholder]).filter(Boolean)
  return [...bots, { value: "", placeholder: generateName(taken, random) }]
}

export function newForm(settings: PublicSettings, random: () => number = Math.random): StartForm {
  return {
    pin: "",
    bots: addField([], random),
    human: settings.timing.mode === "human",
    minSeconds: settings.timing.minMs / 1000,
    maxSeconds: settings.timing.maxMs / 1000,
    context: "",
    includePrevious: settings.includePrevious,
  }
}

export function toRequest(form: StartForm): StartRequest {
  return {
    pin: parsePin(form.pin) ?? form.pin.trim(),
    names: form.bots.map(botName),
    timing: toTiming(form.human, form.minSeconds, form.maxSeconds),
    quizContext: form.context.trim() || null,
    includePrevious: form.includePrevious,
  }
}

export function toTiming(human: boolean, minSeconds: number, maxSeconds: number): Timing {
  return {
    mode: human ? "human" : "instant",
    minMs: Math.round(Number(minSeconds) * 1000),
    maxMs: Math.round(Number(maxSeconds) * 1000),
  }
}

export function stepProblem(form: StartForm, step: number): StartProblem | null {
  const request = toRequest(form)
  if (step === 0) return parsePin(form.pin) ? null : "pin"
  if (step === 1) {
    for (const [i, name] of request.names.entries()) {
      const problem = nameProblem(name, request.names.slice(0, i))
      if (problem) return problem
    }
    return null
  }
  return timingProblem(request.timing)
}
