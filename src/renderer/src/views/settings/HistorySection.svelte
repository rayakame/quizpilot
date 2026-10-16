<script lang="ts">
  import { toast } from "svelte-sonner"
  import { Button } from "$lib/components/ui/button/index.js"
  import { Label } from "$lib/components/ui/label/index.js"
  import { Switch } from "$lib/components/ui/switch/index.js"
  import type { PublicSettings, SettingsPatch } from "../../../../shared/api.js"

  let { settings, patch }: { settings: PublicSettings; patch: (p: SettingsPatch) => void } =
    $props()

  let count = $state<number | null>(null)

  async function refresh() {
    count = (await window.quizpilot.listHistory().catch(() => [])).length
  }

  async function clear() {
    try {
      if (await window.quizpilot.clearHistory()) toast.success("History deleted")
    } catch {
      toast.error("Couldn't delete the history.")
    }
    await refresh()
  }

  void refresh()
</script>

<section class="space-y-6">
  <div>
    <h2 class="text-lg font-semibold">History</h2>
    <p class="text-muted-foreground text-sm">
      Played games stay on this computer, with their questions, answers and costs.
    </p>
  </div>
  <div class="flex items-center gap-2">
    <Switch
      id="save-history"
      checked={settings.saveHistory}
      onCheckedChange={(on) => patch({ saveHistory: on })}
    />
    <Label for="save-history" class="font-normal">Save played games</Label>
  </div>
  <div class="flex items-center gap-3">
    <Button variant="outline" disabled={!count} onclick={() => void clear()}
      >Delete all games</Button
    >
    {#if count !== null}
      <span class="text-muted-foreground text-sm">
        {count === 1 ? "1 game saved" : `${count} games saved`}
      </span>
    {/if}
  </div>
</section>
