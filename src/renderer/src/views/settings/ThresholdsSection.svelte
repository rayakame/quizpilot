<script lang="ts">
  import { Label } from "$lib/components/ui/label/index.js"
  import { Slider } from "$lib/components/ui/slider/index.js"
  import { t } from "$lib/i18n.js"
  import { percent } from "$lib/messages.js"
  import type { PublicSettings, SettingsPatch } from "../../../../shared/api.js"

  let { settings, patch }: { settings: PublicSettings; patch: (p: SettingsPatch) => void } =
    $props()

  // svelte-ignore state_referenced_locally
  let below = $state(Math.round(settings.fallback.below * 100))
  // svelte-ignore state_referenced_locally
  let instant = $state(Math.round(settings.fallback.imageInstantAt * 100))
</script>

<div class="space-y-6 border-t pt-6">
  <div class="grid gap-3">
    <Label>{t.backup.below(percent(below / 100))}</Label>
    <Slider
      type="single"
      min={0}
      max={100}
      step={5}
      bind:value={below}
      onValueCommit={(v) => patch({ fallbackBelow: v / 100 })}
    />
  </div>
  <div class="grid gap-3">
    <Label>{t.backup.instantAt(percent(instant / 100))}</Label>
    <Slider
      type="single"
      min={0}
      max={100}
      step={5}
      bind:value={instant}
      onValueCommit={(v) => patch({ imageInstantAt: v / 100 })}
    />
  </div>
</div>
