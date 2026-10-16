<script lang="ts">
  import { toast } from "svelte-sonner"
  import { Button } from "$lib/components/ui/button/index.js"
  import { Label } from "$lib/components/ui/label/index.js"
  import { Switch } from "$lib/components/ui/switch/index.js"
  import { t } from "$lib/i18n.js"
  import type { PublicSettings, SettingsPatch } from "../../../../shared/api.js"

  let { settings, patch }: { settings: PublicSettings; patch: (p: SettingsPatch) => void } =
    $props()

  let count = $state<number | null>(null)

  async function refresh() {
    count = (await window.quizpilot.listHistory().catch(() => [])).length
  }

  async function clear() {
    try {
      if (await window.quizpilot.clearHistory()) toast.success(t.settings.historyDeleted)
    } catch {
      toast.error(t.settings.deleteFailed)
    }
    await refresh()
  }

  void refresh()
</script>

<section class="space-y-6">
  <div>
    <h2 class="text-lg font-semibold">{t.settings.sections.history}</h2>
    <p class="text-muted-foreground text-sm">{t.settings.historyText}</p>
  </div>
  <div class="flex items-center gap-2">
    <Switch
      id="save-history"
      checked={settings.saveHistory}
      onCheckedChange={(on) => patch({ saveHistory: on })}
    />
    <Label for="save-history" class="font-normal">{t.settings.saveGames}</Label>
  </div>
  <div class="flex items-center gap-3">
    <Button variant="outline" disabled={!count} onclick={() => void clear()}>
      {t.settings.deleteAll}
    </Button>
    {#if count !== null}
      <span class="text-muted-foreground text-sm">
        {t.settings.gamesSaved(count)}
      </span>
    {/if}
  </div>
</section>
