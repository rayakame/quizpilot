import { toast } from "svelte-sonner"
import { t } from "./i18n.js"

export async function saveDiagnostics(): Promise<void> {
  try {
    const result = await window.quizpilot.saveDiagnostics()
    if (result === "saved") toast.success(t.about.diagnosticsSaved)
  } catch {
    toast.error(t.about.diagnosticsFailed)
  }
}
