<script lang="ts">
  import { toast } from "svelte-sonner"
  import { Button } from "$lib/components/ui/button/index.js"
  import * as Card from "$lib/components/ui/card/index.js"
  import { game } from "$lib/game.svelte.js"
  import { t } from "$lib/i18n.js"
  import { costText, secondsText, sourceCounts } from "$lib/messages.js"
  import { gameSummary } from "$lib/summary.js"

  let { onNewGame, onReview }: { onNewGame: () => void; onReview: (() => void) | null } = $props()

  const standings = $derived(
    [...game.state.bots].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity)),
  )
  const summary = $derived(gameSummary(game.state))

  async function exportGame() {
    try {
      const result = await window.quizpilot.exportHistory(null)
      if (result === "saved") toast.success(t.game.exported)
      if (result === "missing") toast.error(t.game.notInHistory)
    } catch {
      toast.error(t.game.exportFailed)
    }
  }
</script>

<div class="p-6 pb-0">
  <Card.Root class="@container">
    <Card.Header>
      <Card.Title>{t.game.over}</Card.Title>
    </Card.Header>
    <Card.Content class="grid gap-4 @md:grid-cols-2">
      <ol class="space-y-1 text-sm">
        {#each standings as bot (bot.name)}
          <li>
            <span class="font-medium"
              >{bot.rank ? t.common.rank(bot.rank) : "–"}&nbsp;{bot.name}</span
            >
            <span class="text-muted-foreground">· {t.common.points(bot.totalScore)}</span>
          </li>
        {/each}
      </ol>
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt class="text-muted-foreground">{t.game.right}</dt>
        <dd>{t.game.of(summary.correct, summary.graded)}</dd>
        <dt class="text-muted-foreground">{t.game.answers}</dt>
        <dd>{sourceCounts(summary.sources)}</dd>
        <dt class="text-muted-foreground">{t.game.answerTime}</dt>
        <dd>{summary.averageMs === null ? "–" : secondsText(summary.averageMs)}</dd>
        <dt class="text-muted-foreground">{t.game.aiCost}</dt>
        <dd>{costText(summary.cost)}</dd>
      </dl>
    </Card.Content>
    <Card.Footer class="flex-wrap gap-2">
      <Button onclick={onNewGame}>{t.game.newGame}</Button>
      {#if onReview}
        <Button variant="outline" onclick={onReview}>{t.game.review}</Button>
        <Button variant="outline" onclick={exportGame}>{t.common.export}</Button>
      {/if}
    </Card.Footer>
  </Card.Root>
</div>
