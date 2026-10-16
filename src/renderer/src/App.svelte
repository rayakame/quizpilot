<script lang="ts">
  import History from "@lucide/svelte/icons/history"
  import Settings from "@lucide/svelte/icons/settings"
  import { ModeWatcher, setMode } from "mode-watcher"
  import { Button } from "$lib/components/ui/button/index.js"
  import { Toaster } from "$lib/components/ui/sonner/index.js"
  import { game } from "$lib/game.svelte.js"
  import type { SettingsSection } from "$lib/home.js"
  import { setLanguage, t } from "$lib/i18n.js"
  import Logo from "$lib/Logo.svelte"
  import type { PublicSettings } from "../../shared/api.js"
  import Dashboard from "./views/Dashboard.svelte"
  import FallbackSetup from "./views/FallbackSetup.svelte"
  import HistoryPage from "./views/history/HistoryPage.svelte"
  import Home from "./views/Home.svelte"
  import KeySetup from "./views/KeySetup.svelte"
  import SettingsPage from "./views/settings/Settings.svelte"
  import TwoStepDialog from "./views/TwoStepDialog.svelte"
  import UpdateBar from "./views/UpdateBar.svelte"

  let settings = $state<PublicSettings | null>(null)
  let view = $state<"fallback-setup" | "settings" | "history" | null>(null)
  let settingsSection = $state<SettingsSection | undefined>()
  let historyGame = $state<number | undefined>()

  const canOpenSettings = $derived(settings?.hasTypesafeKey === true && !game.started)

  async function refresh() {
    settings = await window.quizpilot.getSettings()
    setMode(settings.theme)
    setLanguage(settings.language)
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

  function openSettings(section?: SettingsSection) {
    settingsSection = section
    view = "settings"
  }

  function openHistory(game?: number) {
    historyGame = game
    view = "history"
  }

  window.quizpilot.onOpenSettings(() => {
    if (canOpenSettings) openSettings()
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
      <div class="flex items-center gap-1 [-webkit-app-region:no-drag]">
        <Button variant="ghost" size="sm" onclick={() => openHistory()}>
          <History />
          {t.app.history}
        </Button>
        <Button variant="ghost" size="sm" onclick={() => openSettings()}>
          <Settings />
          {t.app.settings}
        </Button>
      </div>
    {/if}
  </header>
  {#if !game.started}
    <UpdateBar />
  {/if}
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
        section={settingsSection}
        onChange={(next) => (settings = next)}
        onClose={() => (view = null)}
      />
    {:else if view === "history"}
      <HistoryPage {settings} game={historyGame} onClose={() => (view = null)} />
    {:else if game.started}
      <Dashboard onNewGame={newGame} onReview={settings.saveHistory ? () => openHistory() : null} />
    {:else}
      <Home {settings} onSettings={openSettings} onHistory={openHistory} />
    {/if}
  </main>
</div>
<TwoStepDialog />
