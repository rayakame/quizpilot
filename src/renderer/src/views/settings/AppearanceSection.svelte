<script lang="ts">
  import { setMode } from "mode-watcher"
  import { Label } from "$lib/components/ui/label/index.js"
  import * as RadioGroup from "$lib/components/ui/radio-group/index.js"
  import { setLanguage, t } from "$lib/i18n.js"
  import {
    THEMES,
    type PublicSettings,
    type SettingsPatch,
    type Theme,
  } from "../../../../shared/api.js"
  import { LANGUAGE_NAMES, LANGUAGES, type Language } from "../../../../shared/i18n/index.js"

  let { settings, patch }: { settings: PublicSettings; patch: (p: SettingsPatch) => void } =
    $props()
</script>

<section class="space-y-6">
  <h2 class="text-lg font-semibold">{t.settings.sections.appearance}</h2>
  <div class="grid gap-2">
    <Label>{t.settings.language}</Label>
    <RadioGroup.Root
      value={settings.language}
      onValueChange={(v) => {
        setLanguage(v as Language)
        patch({ language: v as Language })
      }}
    >
      {#each LANGUAGES as option (option)}
        <div class="flex items-center gap-2">
          <RadioGroup.Item value={option} id="language-{option}" />
          <Label for="language-{option}" class="font-normal">{LANGUAGE_NAMES[option]}</Label>
        </div>
      {/each}
    </RadioGroup.Root>
  </div>
  <div class="grid gap-2">
    <Label>{t.settings.theme}</Label>
    <RadioGroup.Root
      value={settings.theme}
      onValueChange={(v) => {
        setMode(v as Theme)
        patch({ theme: v as Theme })
      }}
    >
      {#each THEMES as option (option)}
        <div class="flex items-center gap-2">
          <RadioGroup.Item value={option} id="theme-{option}" />
          <Label for="theme-{option}" class="font-normal">{t.themes[option]}</Label>
        </div>
      {/each}
    </RadioGroup.Root>
  </div>
</section>
