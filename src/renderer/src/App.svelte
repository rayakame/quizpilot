<script lang="ts">
  import { ModeWatcher } from "mode-watcher"
  import { Button } from "$lib/components/ui/button/index.js"
  import { Toaster } from "$lib/components/ui/sonner/index.js"
  import type { PublicSettings } from "../../shared/api.js"
  import KeySetup from "./views/KeySetup.svelte"

  let settings = $state<PublicSettings | null>(null)
  let changingKey = $state(false)

  async function refresh() {
    settings = await window.quizpilot.getSettings()
  }

  void refresh()
</script>

<ModeWatcher />
<Toaster position="bottom-center" />
<div class="flex h-screen flex-col">
  <header class="flex h-12 shrink-0 items-center justify-between border-b px-4">
    <span class="font-semibold">QuizPilot</span>
    {#if settings?.hasTypesafeKey && !changingKey}
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
    {:else}
      <p class="text-muted-foreground p-6">Ready to play.</p>
    {/if}
  </main>
</div>
