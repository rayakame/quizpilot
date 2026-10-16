<script lang="ts">
  import { setMode } from "mode-watcher"
  import { Label } from "$lib/components/ui/label/index.js"
  import * as RadioGroup from "$lib/components/ui/radio-group/index.js"
  import { THEME_TEXT } from "$lib/messages.js"
  import { THEMES, type SettingsPatch, type Theme } from "../../../../shared/api.js"

  let { theme, patch }: { theme: Theme; patch: (p: SettingsPatch) => void } = $props()
</script>

<section class="space-y-6">
  <h2 class="text-lg font-semibold">Appearance</h2>
  <div class="grid gap-2">
    <Label>Theme</Label>
    <RadioGroup.Root
      value={theme}
      onValueChange={(v) => {
        setMode(v as Theme)
        patch({ theme: v as Theme })
      }}
    >
      {#each THEMES as option (option)}
        <div class="flex items-center gap-2">
          <RadioGroup.Item value={option} id="theme-{option}" />
          <Label for="theme-{option}" class="font-normal">{THEME_TEXT[option]}</Label>
        </div>
      {/each}
    </RadioGroup.Root>
  </div>
</section>
