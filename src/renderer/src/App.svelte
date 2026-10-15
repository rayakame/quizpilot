<script lang="ts">
  import { ModeWatcher } from "mode-watcher"
  import { Button } from "$lib/components/ui/button/index.js"
  import { Toaster } from "$lib/components/ui/sonner/index.js"
  import { game } from "$lib/game.svelte.js"
  import type { PublicSettings } from "../../shared/api.js"
  import Dashboard from "./views/Dashboard.svelte"
  import FallbackSetup from "./views/FallbackSetup.svelte"
  import KeySetup from "./views/KeySetup.svelte"
  import StartWizard from "./views/StartWizard.svelte"
  import TwoStepDialog from "./views/TwoStepDialog.svelte"

  let settings = $state<PublicSettings | null>(null)
  let editing = $state<"key" | "fallback" | null>(null)
  let firstRun = $state(false)

  async function refresh() {
    settings = await window.quizpilot.getSettings()
  }

  async function keySaved() {
    const first = !settings?.hasTypesafeKey
    await refresh()
    firstRun = first
    editing = first ? "fallback" : null
  }

  async function fallbackDone() {
    firstRun = false
    editing = null
    await refresh()
  }

  async function newGame() {
    await window.quizpilot.endGame()
    game.reset()
    await refresh()
  }

  void refresh()
</script>

<ModeWatcher />
<Toaster position="bottom-center" />
<div class="flex h-screen flex-col">
  <header class="flex h-12 shrink-0 items-center justify-between border-b px-4">
    <span class="font-semibold">QuizPilot</span>
    {#if settings?.hasTypesafeKey && !game.started && editing === null}
      <div class="flex gap-1">
        <Button variant="ghost" size="sm" onclick={() => (editing = "fallback")}>Backup AI</Button>
        <Button variant="ghost" size="sm" onclick={() => (editing = "key")}>TypeSafe key</Button>
      </div>
    {/if}
  </header>
  <main class="min-h-0 flex-1">
    {#if !settings}
      <!-- loading -->
    {:else if !settings.hasTypesafeKey || editing === "key"}
      <KeySetup firstRun={!settings.hasTypesafeKey} onDone={keySaved} />
    {:else if editing === "fallback"}
      <FallbackSetup {settings} {firstRun} onDone={fallbackDone} />
    {:else if game.started}
      <Dashboard onNewGame={newGame} />
    {:else}
      <StartWizard {settings} />
    {/if}
  </main>
</div>
<TwoStepDialog />
