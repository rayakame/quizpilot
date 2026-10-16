<script lang="ts">
  import { Input } from "$lib/components/ui/input/index.js"
  import { Label } from "$lib/components/ui/label/index.js"
  import * as RadioGroup from "$lib/components/ui/radio-group/index.js"
  import { Switch } from "$lib/components/ui/switch/index.js"
  import { t } from "$lib/i18n.js"
  import { toTiming } from "$lib/start-form.js"
  import type { PublicSettings, SettingsPatch } from "../../../../shared/api.js"
  import { timingProblem } from "../../../../shared/start.js"

  let { settings, patch }: { settings: PublicSettings; patch: (p: SettingsPatch) => void } =
    $props()

  // svelte-ignore state_referenced_locally
  let human = $state(settings.timing.mode === "human")
  // svelte-ignore state_referenced_locally
  let minSeconds = $state(settings.timing.minMs / 1000)
  // svelte-ignore state_referenced_locally
  let maxSeconds = $state(settings.timing.maxMs / 1000)
  let invalid = $state(false)

  function saveTiming() {
    const timing = toTiming(human, minSeconds, maxSeconds)
    invalid = timingProblem({ ...timing, mode: "human" }) !== null
    if (!invalid) patch({ timing })
  }
</script>

<section class="space-y-6">
  <div>
    <h2 class="text-lg font-semibold">{t.settings.sections.behavior}</h2>
    <p class="text-muted-foreground text-sm">{t.settings.behaviorText}</p>
  </div>
  <div class="grid gap-2">
    <Label>{t.start.whenToAnswer}</Label>
    <RadioGroup.Root
      value={human ? "human" : "instant"}
      onValueChange={(v) => {
        human = v === "human"
        saveTiming()
      }}
    >
      <div class="flex items-center gap-2">
        <RadioGroup.Item value="instant" id="default-instant" />
        <Label for="default-instant" class="font-normal">{t.start.instant}</Label>
      </div>
      <div class="flex items-center gap-2">
        <RadioGroup.Item value="human" id="default-human" />
        <Label for="default-human" class="font-normal">{t.start.human}</Label>
      </div>
    </RadioGroup.Root>
    <div class="flex items-center gap-2 pl-6 text-sm">
      <Input
        type="number"
        min="0"
        max="30"
        step="0.5"
        class="w-20"
        bind:value={minSeconds}
        onchange={saveTiming}
      />
      {t.common.to}
      <Input
        type="number"
        min="0"
        max="30"
        step="0.5"
        class="w-20"
        bind:value={maxSeconds}
        onchange={saveTiming}
      />
      {t.common.seconds}
    </div>
    {#if invalid}
      <p class="text-destructive text-sm">{t.errors.timing}</p>
    {/if}
  </div>
  <div class="flex items-center gap-2">
    <Switch
      id="default-previous"
      checked={settings.includePrevious}
      onCheckedChange={(v) => patch({ includePrevious: v })}
    />
    <Label for="default-previous" class="font-normal">{t.start.previous}</Label>
  </div>
  <div class="flex items-center gap-2">
    <Switch
      id="reconnect"
      checked={settings.reconnect}
      onCheckedChange={(v) => patch({ reconnect: v })}
    />
    <Label for="reconnect" class="font-normal">{t.settings.reconnect}</Label>
  </div>
  <div class="flex items-center gap-2">
    <Switch id="notify" checked={settings.notify} onCheckedChange={(v) => patch({ notify: v })} />
    <Label for="notify" class="font-normal">{t.settings.notify}</Label>
  </div>
</section>
