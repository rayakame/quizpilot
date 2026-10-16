<script lang="ts">
  import { toast } from "svelte-sonner"
  import { Button } from "$lib/components/ui/button/index.js"
  import * as Card from "$lib/components/ui/card/index.js"
  import { game } from "$lib/game.svelte.js"
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
      if (result === "saved") toast.success("Game exported")
      if (result === "missing") toast.error("This game isn't in the history.")
    } catch {
      toast.error("Couldn't export the game.")
    }
  }
</script>

<div class="p-6 pb-0">
  <Card.Root>
    <Card.Header>
      <Card.Title>Game over</Card.Title>
    </Card.Header>
    <Card.Content class="grid gap-4 sm:grid-cols-2">
      <ol class="space-y-1 text-sm">
        {#each standings as bot (bot.name)}
          <li>
            <span class="font-medium">{bot.rank ? `#${bot.rank}` : "–"} {bot.name}</span>
            <span class="text-muted-foreground">· {bot.totalScore} points</span>
          </li>
        {/each}
      </ol>
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt class="text-muted-foreground">Right</dt>
        <dd>{summary.correct} of {summary.graded}</dd>
        <dt class="text-muted-foreground">Answers</dt>
        <dd>{sourceCounts(summary.sources)}</dd>
        <dt class="text-muted-foreground">Answer time</dt>
        <dd>{summary.averageMs === null ? "–" : secondsText(summary.averageMs)}</dd>
        <dt class="text-muted-foreground">AI cost</dt>
        <dd>{costText(summary.cost)}</dd>
      </dl>
    </Card.Content>
    <Card.Footer class="gap-2">
      <Button onclick={onNewGame}>New game</Button>
      {#if onReview}
        <Button variant="outline" onclick={onReview}>Review questions</Button>
        <Button variant="outline" onclick={exportGame}>Export</Button>
      {/if}
    </Card.Footer>
  </Card.Root>
</div>
