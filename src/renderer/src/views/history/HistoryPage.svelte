<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left"
  import { onMount } from "svelte"
  import { toast } from "svelte-sonner"
  import { Button } from "$lib/components/ui/button/index.js"
  import {
    gameLine,
    gameTitle,
    HISTORY_FILTERS,
    matches,
    type HistoryFilter,
  } from "$lib/history-view.js"
  import { t } from "$lib/i18n.js"
  import { dateText } from "$lib/messages.js"
  import type { HistoryGame, HistoryRecord, PublicSettings } from "../../../../shared/api.js"
  import QuestionRow from "./QuestionRow.svelte"

  let {
    settings,
    game,
    onClose,
  }: { settings: PublicSettings; game?: number; onClose: () => void } = $props()

  let games = $state<HistoryGame[] | null>(null)
  let selected = $state<number | null>(null)
  let record = $state<HistoryRecord | null>(null)
  let filter = $state<HistoryFilter>("all")

  const shown = $derived(
    record?.questions.filter(
      (q) => q.question.type !== "content" && matches(q, filter, settings.fallback.below),
    ) ?? [],
  )

  async function load(id: number | null = null) {
    try {
      games = await window.quizpilot.listHistory()
      await select(id ?? games[0]?.id ?? null)
    } catch {
      games = []
      toast.error(t.history.loadFailed)
    }
  }

  async function select(id: number | null) {
    selected = id
    filter = "all"
    record = id === null ? null : await window.quizpilot.getHistory(id)
  }

  async function remove(id: number) {
    if (await window.quizpilot.deleteHistory(id)) await load()
  }

  async function exportGame(id: number) {
    const result = await window.quizpilot.exportHistory(id)
    if (result === "saved") toast.success(t.game.exported)
  }

  onMount(() => void load(game))
</script>

<div class="grid h-full grid-cols-[18rem_1fr]">
  <nav class="flex min-h-0 flex-col gap-1 overflow-y-auto border-r p-3">
    <Button variant="ghost" class="mb-2 justify-start" onclick={onClose}>
      <ArrowLeft />
      {t.common.back}
    </Button>
    {#if games?.length === 0}
      <p class="text-muted-foreground px-3 text-sm">{t.history.noGames}</p>
    {/if}
    {#each games ?? [] as g (g.id)}
      <button
        class={[
          "rounded-md px-3 py-2 text-left text-sm",
          g.id === selected ? "bg-secondary" : "hover:bg-accent",
        ]}
        onclick={() => void select(g.id)}
      >
        <div class="truncate font-medium">{gameTitle(g)}</div>
        <div class="text-muted-foreground text-xs">
          {dateText(g.startedAt)} · {gameLine(g)}
        </div>
      </button>
    {/each}
  </nav>
  <div class="min-h-0 overflow-y-auto">
    {#if record}
      <div class="mx-auto grid max-w-3xl gap-4 p-8">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold">{gameTitle(record.game)}</h2>
            <p class="text-muted-foreground text-sm">
              {t.history.pin(record.game.pin)} · {dateText(record.game.startedAt)} ·
              {record.bots
                .map((b) => (b.rank ? `${t.common.rank(b.rank)} ${b.name}` : b.name))
                .join(", ")}
            </p>
          </div>
          <div class="flex gap-2">
            <Button variant="outline" onclick={() => void exportGame(record!.game.id)}>
              {t.common.export}
            </Button>
            <Button variant="ghost" onclick={() => void remove(record!.game.id)}>
              {t.common.delete}
            </Button>
          </div>
        </div>
        <div class="flex gap-1">
          {#each HISTORY_FILTERS as f (f)}
            <Button
              size="sm"
              variant={filter === f ? "secondary" : "ghost"}
              onclick={() => (filter = f)}
            >
              {t.history.filters[f]}
            </Button>
          {/each}
        </div>
        {#if shown.length === 0}
          <p class="text-muted-foreground text-sm">{t.history.noQuestions}</p>
        {/if}
        <ol class="grid gap-2">
          {#each shown as item (item.question.index)}
            <QuestionRow {item} />
          {/each}
        </ol>
      </div>
    {/if}
  </div>
</div>
