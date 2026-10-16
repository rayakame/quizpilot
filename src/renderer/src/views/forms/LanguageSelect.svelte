<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down"
  import { t } from "$lib/i18n.js"
  import { cn } from "$lib/utils.js"
  import {
    LANGUAGE_NAMES,
    LANGUAGES,
    messagesFor,
    type Language,
  } from "../../../../shared/i18n/index.js"

  let {
    value,
    onChange,
    id,
    class: className,
  }: {
    value: Language
    onChange: (next: Language) => void
    id?: string
    class?: string
  } = $props()
</script>

<div class={cn("relative", className)}>
  <select
    {id}
    {value}
    aria-label={t.settings.language}
    onchange={(e) => onChange(e.currentTarget.value as Language)}
    class="dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full appearance-none rounded-lg border bg-transparent py-1 pr-8 pl-2.5 text-sm transition-colors outline-none focus-visible:ring-3"
  >
    {#each LANGUAGES as language (language)}
      <option
        value={language}
        lang={messagesFor(language).locale}
        class="bg-popover text-popover-foreground"
      >
        {LANGUAGE_NAMES[language]}
      </option>
    {/each}
  </select>
  <ChevronDown
    class="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2"
  />
</div>
