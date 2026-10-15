/// <reference types="svelte" />
/// <reference types="vite/client" />
import type { QuizPilotApi } from "../../shared/api.js"

declare global {
  interface Window {
    quizpilot: QuizPilotApi
  }
}
