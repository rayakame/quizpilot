<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js"
  import * as Card from "$lib/components/ui/card/index.js"
  import { Input } from "$lib/components/ui/input/index.js"
  import { Label } from "$lib/components/ui/label/index.js"
  import * as RadioGroup from "$lib/components/ui/radio-group/index.js"
  import { Switch } from "$lib/components/ui/switch/index.js"
  import { keyText } from "$lib/messages.js"
  import {
    FALLBACK_PROVIDERS,
    PROVIDER_NAMES,
    type FallbackProviderId,
  } from "../../../core/providers/fallback/ids.js"
  import type { KeyCheck, PublicSettings } from "../../../shared/api.js"

  let {
    settings,
    firstRun,
    onDone,
  }: { settings: PublicSettings; firstRun: boolean; onDone: () => void } = $props()

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
  let key = $state("")
  let checking = $state(false)
  let problem = $state<Exclude<KeyCheck, "ok"> | null>(null)

  const saved = $derived(settings.fallback.savedKeys.includes(provider))
  const active = $derived(settings.fallback.savedKeys.includes(settings.fallback.provider))

  async function save(event: SubmitEvent) {
    event.preventDefault()
    checking = true
    problem = null
    const result = await window.quizpilot.saveFallback({ provider, key, webSearch })
    checking = false
    if (result === "ok") onDone()
    else problem = result
  }

  async function turnOff() {
    await window.quizpilot.removeFallback()
    onDone()
  }
</script>

<div class="flex h-full items-center justify-center p-6">
  <Card.Root class="w-full max-w-md">
    <Card.Header>
      <Card.Title>{firstRun ? "Backup AI (optional)" : "Backup AI"}</Card.Title>
      <Card.Description>
        When Jev is unsure, QuizPilot can ask a second AI. It needs its own API key and costs a
        little per question.
      </Card.Description>
    </Card.Header>
    <form class="contents" onsubmit={save}>
      <Card.Content class="grid gap-4">
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
          <Label for="fallback-key">API key</Label>
          <Input
            id="fallback-key"
            type="password"
            autocomplete="off"
            placeholder={saved ? "Saved, leave empty to keep it" : ""}
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
            Get a key from {COMPANY[provider]}
          </Button>
        </div>
        <div class="flex items-center gap-2">
          <Switch id="web-search" bind:checked={webSearch} />
          <Label for="web-search" class="font-normal">Search the web when there's time</Label>
        </div>
      </Card.Content>
      <Card.Footer class="justify-end gap-2">
        {#if firstRun}
          <Button variant="ghost" onclick={onDone}>Skip</Button>
        {:else}
          <Button variant="ghost" onclick={onDone}>Cancel</Button>
          {#if active}
            <Button variant="outline" onclick={turnOff}>Turn off</Button>
          {/if}
        {/if}
        <Button type="submit" disabled={checking || (!key.trim() && !saved)}>
          {checking ? "Checking…" : "Save"}
        </Button>
      </Card.Footer>
    </form>
  </Card.Root>
</div>
