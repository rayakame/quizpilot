<script lang="ts">
  import Settings from "@lucide/svelte/icons/settings"
  import { ModeWatcher, setMode } from "mode-watcher"
  import { Button } from "$lib/components/ui/button/index.js"
  import { Toaster } from "$lib/components/ui/sonner/index.js"
  import { game } from "$lib/game.svelte.js"
  import Logo from "$lib/Logo.svelte"
  import type { PublicSettings } from "../../shared/api.js"
  import Dashboard from "./views/Dashboard.svelte"
  import FallbackSetup from "./views/FallbackSetup.svelte"
  import KeySetup from "./views/KeySetup.svelte"
  import SettingsPage from "./views/settings/Settings.svelte"
  import StartWizard from "./views/StartWizard.svelte"
  import TwoStepDialog from "./views/TwoStepDialog.svelte"

  let settings = $state<PublicSettings | null>(null)
  let view = $state<"fallback-setup" | "settings" | null>(null)

  const canOpenSettings = $derived(settings?.hasTypesafeKey === true && !game.started)

  async function refresh() {
    settings = await window.quizpilot.getSettings()
    setMode(settings.theme)
  }

  async function keySaved() {
    await refresh()
    view = "fallback-setup"
  }

  async function newGame() {
    await window.quizpilot.endGame()
    game.reset()
    await refresh()
  }

  window.quizpilot.onOpenSettings(() => {
    if (canOpenSettings) view = "settings"
  })

  void refresh()
</script>

<ModeWatcher />
<Toaster position="bottom-center" />
<div class="flex h-screen flex-col">
  <header
    class={[
      "flex h-12 shrink-0 items-center justify-between border-b pr-4 select-none [-webkit-app-region:drag]",
      window.quizpilot.platform === "darwin" ? "pl-22" : "pl-4",
    ]}
  >
    <div class="flex items-center gap-2">
      <Logo class="size-6" />
      <span class="font-semibold">QuizPilot</span>
    </div>
    {#if canOpenSettings && view === null}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Settings"
        class="[-webkit-app-region:no-drag]"
        onclick={() => (view = "settings")}
      >
        <Settings />
      </Button>
    {/if}
  </header>
  <main class="min-h-0 flex-1">
    {#if !settings}
      <div class="flex h-full items-center justify-center">
        <Logo class="size-16 animate-pulse" />
      </div>
    {:else if !settings.hasTypesafeKey}
      <KeySetup onDone={keySaved} />
    {:else if view === "fallback-setup"}
      <FallbackSetup
        {settings}
        onDone={async () => {
          view = null
          await refresh()
        }}
      />
    {:else if view === "settings"}
      <SettingsPage
        {settings}
        onChange={(next) => (settings = next)}
        onClose={() => (view = null)}
      />
    {:else if game.started}
      <Dashboard onNewGame={newGame} />
    {:else}
      {#key settings}
        <StartWizard {settings} />
      {/key}
    {/if}
  </main>
</div>
<TwoStepDialog />
