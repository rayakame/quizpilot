<script lang="ts">
  import { game } from "$lib/game.svelte.js"
  import { currentRound, isOver, pastRounds } from "$lib/game-state.js"
  import BotList from "./dashboard/BotList.svelte"
  import GameOver from "./dashboard/GameOver.svelte"
  import HistoryList from "./dashboard/HistoryList.svelte"
  import QuestionPanel from "./dashboard/QuestionPanel.svelte"

  let { onNewGame }: { onNewGame: () => void } = $props()
</script>

<div class="grid h-full grid-cols-[16rem_1fr_19rem] divide-x">
  <BotList {onNewGame} />
  <div class="min-h-0 overflow-y-auto">
    {#if isOver(game.state)}
      <GameOver {onNewGame} />
    {/if}
    <QuestionPanel round={currentRound(game.state)} />
  </div>
  <HistoryList rounds={pastRounds(game.state)} />
</div>
