<script lang="ts">
  import { ModeWatcher } from "mode-watcher"
  import { Button } from "$lib/components/ui/button/index.js"
  import { Toaster } from "$lib/components/ui/sonner/index.js"
  import { game } from "$lib/game.svelte.js"
  import type { PublicSettings } from "../../shared/api.js"
  import Dashboard from "./views/Dashboard.svelte"
  import KeySetup from "./views/KeySetup.svelte"
  import StartWizard from "./views/StartWizard.svelte"
  import TwoStepDialog from "./views/TwoStepDialog.svelte"

  let settings = $state<PublicSettings | null>(null)
  let changingKey = $state(false)

  async function refresh() {
    settings = await window.quizpilot.getSettings()
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
    {#if settings?.hasTypesafeKey && !game.started && !changingKey}
      <Button variant="ghost" size="sm" onclick={() => (changingKey = true)}>TypeSafe key</Button>
    {/if}
  </header>
  <main class="min-h-0 flex-1">
    {#if !settings}
      <!-- loading -->
    {:else if !settings.hasTypesafeKey || changingKey}
      <KeySetup
        firstRun={!settings.hasTypesafeKey}
        onDone={async () => {
          changingKey = false
          await refresh()
        }}
      />
    {:else if game.started}
      <Dashboard onNewGame={newGame} />
    {:else}
      <StartWizard {settings} />
    {/if}
  </main>
</div>
<TwoStepDialog />
