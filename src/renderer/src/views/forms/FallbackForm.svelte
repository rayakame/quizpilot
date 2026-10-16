<script lang="ts">
  import type { Snippet } from "svelte"
  import { Button } from "$lib/components/ui/button/index.js"
  import { Input } from "$lib/components/ui/input/index.js"
  import { Label } from "$lib/components/ui/label/index.js"
  import * as RadioGroup from "$lib/components/ui/radio-group/index.js"
  import { Switch } from "$lib/components/ui/switch/index.js"
  import { t } from "$lib/i18n.js"
  import { keyText } from "$lib/messages.js"
  import {
    FALLBACK_PROVIDERS,
    PROVIDER_NAMES,
    type FallbackProviderId,
  } from "../../../../core/providers/fallback/ids.js"
  import { MODELS, resolveChoice } from "../../../../core/providers/fallback/models.js"
  import type { KeyCheck, PublicSettings } from "../../../../shared/api.js"

  let {
    settings,
    onSaved,
    children,
  }: { settings: PublicSettings; onSaved: () => void; children?: Snippet } = $props()

  const COMPANY: Record<FallbackProviderId, string> = {
    anthropic: "Anthropic",
    openai: "OpenAI",
    gemini: "Google",
  }
  const KEY_PAGES: Record<FallbackProviderId, string> = {
    anthropic: "https://platform.claude.com/settings/keys",
    openai: "https://platform.openai.com/api-keys",
    gemini: "https://aistudio.google.com/apikey",
  }

  // svelte-ignore state_referenced_locally
  let provider = $state<FallbackProviderId>(settings.fallback.provider)
  // svelte-ignore state_referenced_locally
  let webSearch = $state(settings.fallback.webSearch)
  // svelte-ignore state_referenced_locally
  let choices = $state($state.snapshot(settings.fallback.choices))
  let key = $state("")
  let checking = $state(false)
  let problem = $state<Exclude<KeyCheck, "ok"> | null>(null)

  const saved = $derived(settings.fallback.savedKeys.includes(provider))
  const choice = $derived(choices[provider])
  const option = $derived(MODELS[provider].find((o) => o.id === choice.model)!)
  const active = $derived(settings.fallback.savedKeys.includes(settings.fallback.provider))

  async function save(event: SubmitEvent) {
    event.preventDefault()
    checking = true
    problem = null
    try {
      const result = await window.quizpilot.saveFallback({
        provider,
        key,
        webSearch,
        model: choice.model,
        effort: choice.effort,
      })
      if (result === "ok") {
        key = ""
        onSaved()
      } else problem = result
    } catch {
      problem = "error"
    } finally {
      checking = false
    }
  }

  async function turnOff() {
    await window.quizpilot.removeFallback()
    onSaved()
  }
</script>

<form class="grid gap-4" onsubmit={save}>
  <RadioGroup.Root
    value={provider}
    onValueChange={(v) => {
      provider = v as FallbackProviderId
      key = ""
      problem = null
    }}
  >
    {#each FALLBACK_PROVIDERS as id (id)}
      <div class="flex items-center gap-2">
        <RadioGroup.Item value={id} id="provider-{id}" />
        <Label for="provider-{id}" class="font-normal">
          {PROVIDER_NAMES[id]}
          {#if COMPANY[id] !== PROVIDER_NAMES[id]}
            <span class="text-muted-foreground">({COMPANY[id]})</span>
          {/if}
        </Label>
      </div>
    {/each}
  </RadioGroup.Root>
  <div class="grid gap-2">
    <Label for="fallback-key">{t.common.apiKey}</Label>
    <Input
      id="fallback-key"
      type="password"
      autocomplete="off"
      placeholder={saved ? t.backup.keySaved : ""}
      bind:value={key}
    />
    {#if problem}
      <p class="text-destructive text-sm">{keyText(problem, PROVIDER_NAMES[provider])}</p>
    {/if}
    <Button
      variant="link"
      class="h-auto w-fit p-0"
      onclick={() => window.quizpilot.openExternal(KEY_PAGES[provider])}
    >
      {t.backup.getKey(COMPANY[provider])}
    </Button>
  </div>
  <div class="grid gap-2">
    <Label>{t.backup.model}</Label>
    <RadioGroup.Root
      value={choice.model}
      onValueChange={(m) => (choices[provider] = resolveChoice(provider, m, choice.effort))}
    >
      {#each MODELS[provider] as model (model.id)}
        <div class="flex items-center gap-2">
          <RadioGroup.Item value={model.id} id="model-{model.id}" />
          <Label for="model-{model.id}" class="font-normal">
            {model.name} <span class="text-muted-foreground">· {t.backup.tiers[model.tier]}</span>
          </Label>
        </div>
      {/each}
    </RadioGroup.Root>
  </div>
  <div class="grid gap-2">
    <Label>{t.backup.effort}</Label>
    {#if option.efforts.length === 0}
      <p class="text-muted-foreground text-sm">{t.backup.noEffort(option.name)}</p>
    {:else}
      <RadioGroup.Root
        class="flex flex-wrap gap-4"
        value={choice.effort ?? ""}
        onValueChange={(e) => (choices[provider] = resolveChoice(provider, choice.model, e))}
      >
        {#each option.efforts as effort (effort)}
          <div class="flex items-center gap-2">
            <RadioGroup.Item value={effort} id="effort-{effort}" />
            <Label for="effort-{effort}" class="font-normal">{t.backup.efforts[effort]}</Label>
          </div>
        {/each}
      </RadioGroup.Root>
      <p class="text-muted-foreground text-sm">{t.backup.effortHint}</p>
    {/if}
  </div>
  <div class="flex items-center gap-2">
    <Switch id="web-search" bind:checked={webSearch} />
    <Label for="web-search" class="font-normal">{t.backup.webSearch}</Label>
  </div>
  <div class="flex justify-end gap-2 pt-2">
    {@render children?.()}
    {#if active}
      <Button variant="outline" onclick={turnOff}>{t.backup.turnOff}</Button>
    {/if}
    <Button type="submit" disabled={checking || (!key.trim() && !saved)}>
      {checking ? t.common.checking : t.common.save}
    </Button>
  </div>
</form>
