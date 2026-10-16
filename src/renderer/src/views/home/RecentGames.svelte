<script lang="ts">
  import { onMount } from "svelte"
  import { Button } from "$lib/components/ui/button/index.js"
  import { gameLine, gameTitle } from "$lib/history-view.js"
  import { recentGames } from "$lib/home.js"
  import { t } from "$lib/i18n.js"
  import { dayText } from "$lib/messages.js"
  import type { HistoryGame } from "../../../../shared/api.js"

  let {
    saveHistory,
    onOpen,
    onTurnOn,
  }: {
    saveHistory: boolean
    onOpen: (game?: number) => void
    onTurnOn: () => void
  } = $props()

  let games = $state<HistoryGame[] | null>(null)
  let failed = $state(false)

  async function load() {
    try {
      games = recentGames(await window.quizpilot.listHistory())
    } catch {
      failed = true
    }
  }

  onMount(() => {
    if (saveHistory) void load()
  })
</script>

<section>
  <div class="flex h-9 items-center justify-between pl-3">
    <h2 class="text-sm font-semibold">{t.home.recent}</h2>
    {#if games?.length}
      <Button variant="ghost" size="sm" class="text-muted-foreground" onclick={() => onOpen()}>
        {t.home.allGames}
      </Button>
    {/if}
  </div>
  {#if !saveHistory}
    <p class="text-muted-foreground px-3 pb-2 text-sm">
      {t.home.historyOff}
      <button
        class="text-foreground font-medium underline-offset-4 hover:underline"
        onclick={onTurnOn}
      >
        {t.home.turnOn}
      </button>
    </p>
  {:else if failed}
    <p class="text-muted-foreground px-3 pb-2 text-sm">{t.history.loadFailed}</p>
  {:else if games?.length === 0}
    <p class="text-muted-foreground px-3 pb-2 text-sm">{t.home.noGames}</p>
  {:else if games}
    <ul>
      {#each games as g (g.id)}
        <li>
          <button
            class="hover:bg-background focus-visible:ring-ring/50 w-full rounded-md px-3 py-1.5 text-left outline-none focus-visible:ring-[3px]"
            onclick={() => onOpen(g.id)}
          >
            <span class="flex items-baseline gap-3">
              <span class="flex-1 truncate text-sm font-medium">{gameTitle(g)}</span>
              <span class="text-muted-foreground shrink-0 text-xs">{dayText(g.startedAt)}</span>
            </span>
            <span class="text-muted-foreground block truncate text-xs">{gameLine(g)}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>
