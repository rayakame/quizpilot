<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js"
  import * as Card from "$lib/components/ui/card/index.js"
  import { game } from "$lib/game.svelte.js"

  let { onNewGame }: { onNewGame: () => void } = $props()

  const standings = $derived(
    [...game.state.bots].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity)),
  )
</script>

<div class="p-6 pb-0">
  <Card.Root>
    <Card.Header>
      <Card.Title>Game over</Card.Title>
    </Card.Header>
    <Card.Content>
      <ol class="space-y-1 text-sm">
        {#each standings as bot (bot.name)}
          <li>
            <span class="font-medium">{bot.rank ? `#${bot.rank}` : "–"} {bot.name}</span>
            <span class="text-muted-foreground">· {bot.totalScore} points</span>
          </li>
        {/each}
      </ol>
    </Card.Content>
    <Card.Footer>
      <Button onclick={onNewGame}>New game</Button>
    </Card.Footer>
  </Card.Root>
</div>
