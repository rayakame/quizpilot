<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js"
  import { setupRows, type SettingsSection } from "$lib/home.js"
  import { t } from "$lib/i18n.js"
  import type { PublicSettings } from "../../../../shared/api.js"

  let {
    settings,
    onOpen,
  }: { settings: PublicSettings; onOpen: (section?: SettingsSection) => void } = $props()
</script>

<section>
  <div class="flex h-9 items-center justify-between pl-3">
    <h2 class="text-sm font-semibold">{t.home.setup}</h2>
    <Button variant="ghost" size="sm" class="text-muted-foreground" onclick={() => onOpen()}>
      {t.home.openSettings}
    </Button>
  </div>
  <ul>
    {#each setupRows(settings) as row (row.id)}
      <li>
        <button
          class="hover:bg-background focus-visible:ring-ring/50 flex w-full items-baseline justify-between gap-4 rounded-md px-3 py-1.5 text-left text-sm outline-none focus-visible:ring-[3px]"
          onclick={() => onOpen(row.section)}
        >
          <span class="text-muted-foreground shrink-0">{row.label}</span>
          <span class="truncate font-medium">{row.value}</span>
        </button>
      </li>
    {/each}
  </ul>
</section>
