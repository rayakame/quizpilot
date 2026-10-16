<script lang="ts">
  import Check from "@lucide/svelte/icons/check"
  import X from "@lucide/svelte/icons/x"
  import { Badge } from "$lib/components/ui/badge/index.js"
  import { Progress } from "$lib/components/ui/progress/index.js"
  import { answerSummary, choiceRows, type RoundView } from "$lib/game-state.js"
  import { choiceStyle } from "$lib/kahoot-style.js"
  import { t } from "$lib/i18n.js"
  import { percent, secondsText, sourceText } from "$lib/messages.js"

  let { round }: { round: RoundView | null } = $props()

  const rows = $derived(round ? choiceRows(round) : [])
  const results = $derived(round ? Object.entries(round.results) : [])
</script>

{#if !round}
  <div class="text-muted-foreground flex h-full items-center justify-center p-6">
    {t.game.waiting}
  </div>
{:else}
  <section class="space-y-4 p-6">
    <div class="text-muted-foreground text-sm">
      {t.game.question(round.question.index + 1, t.types[round.question.type])}
    </div>
    <h2 class="text-xl font-semibold">
      {round.question.title ?? t.game.hidden}
    </h2>
    {#if round.question.image}
      <img
        src={round.question.image.url}
        alt={round.question.imageAlt ?? ""}
        class="max-h-64 rounded-lg object-contain"
      />
    {/if}
    {#if rows.length > 0}
      <div class="grid grid-cols-2 gap-2">
        {#each rows as row (row.index)}
          {@const style = choiceStyle(round.question.type, row.index)}
          <div class="space-y-2 rounded-lg border p-3 {row.chosen ? 'ring-primary ring-2' : ''}">
            <div class="flex items-center gap-2">
              <span
                class="{style.color} flex size-7 shrink-0 items-center justify-center rounded text-white"
              >
                {style.shape}
              </span>
              {#if row.image}
                <img src={row.image} alt="" class="h-12 rounded object-contain" />
              {/if}
              <span class="min-w-0 flex-1 break-words">{row.text ?? ""}</span>
              {#if row.position}
                <Badge variant="outline">#{row.position}</Badge>
              {/if}
              {#if row.correct === true}
                <Check class="size-4 shrink-0 text-green-600" />
              {:else if row.correct === false && row.chosen}
                <X class="text-destructive size-4 shrink-0" />
              {/if}
            </div>
            {#if row.probability !== null}
              <div class="flex items-center gap-2">
                <Progress value={row.probability * 100} class="flex-1" />
                <span class="text-muted-foreground w-12 text-right text-xs">
                  {percent(row.probability)}
                </span>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
    <div class="flex items-center gap-2">
      {#if round.decision}
        <span>{t.game.answer} <strong>{answerSummary(round)}</strong></span>
        <Badge variant="secondary">{sourceText(round.decision)}</Badge>
      {:else}
        <span class="text-muted-foreground">{t.game.thinking}</span>
      {/if}
    </div>
    {#if results.length > 0}
      <ul class="space-y-1 text-sm">
        {#each results as [bot, result] (bot)}
          <li class="flex items-center gap-2">
            {#if result.correct === true}
              <Check class="size-4 shrink-0 text-green-600" />
            {:else if result.correct === false}
              <X class="text-destructive size-4 shrink-0" />
            {/if}
            <span class="font-medium">{bot}</span>
            <span class="text-muted-foreground">
              +{result.points ?? 0}
              {#if round.answeredMs[bot] !== undefined}
                ·&nbsp;{t.game.answeredAfter(secondsText(round.answeredMs[bot]))}
              {/if}
            </span>
            {#if round.onPurpose.includes(bot)}
              <Badge variant="outline">{t.game.onPurpose}</Badge>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}
