<script lang="ts">
  import type { SettingsSection } from "$lib/home.js"
  import { t } from "$lib/i18n.js"
  import type { PublicSettings } from "../../../shared/api.js"
  import RecentGames from "./home/RecentGames.svelte"
  import SetupCard from "./home/SetupCard.svelte"
  import StartWizard from "./StartWizard.svelte"

  let {
    settings,
    onSettings,
    onHistory,
  }: {
    settings: PublicSettings
    onSettings: (section?: SettingsSection) => void
    onHistory: (game?: number) => void
  } = $props()
</script>

<div class="h-full overflow-y-auto">
  <div class="mx-auto flex min-h-full max-w-[56rem] flex-col justify-center gap-5 p-6">
    <h1 class="text-2xl font-semibold tracking-tight">{t.home.greeting}</h1>
    <div class="grid items-start gap-6 min-[60rem]:grid-cols-[minmax(0,1fr)_20rem]">
      {#key settings}
        <StartWizard {settings} />
      {/key}
      <aside class="bg-muted/50 rounded-xl p-2">
        <RecentGames
          saveHistory={settings.saveHistory}
          onOpen={onHistory}
          onTurnOn={() => onSettings("history")}
        />
        <div class="bg-border mx-3 my-2 h-px"></div>
        <SetupCard {settings} onOpen={onSettings} />
      </aside>
    </div>
  </div>
</div>
