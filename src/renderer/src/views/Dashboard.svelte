<script lang="ts">
  import * as Alert from "$lib/components/ui/alert/index.js"
  import { game } from "$lib/game.svelte.js"
  import { currentRound, isOver, pastRounds } from "$lib/game-state.js"
  import { t } from "$lib/i18n.js"
  import BotList from "./dashboard/BotList.svelte"
  import GameOver from "./dashboard/GameOver.svelte"
  import HistoryList from "./dashboard/HistoryList.svelte"
  import QuestionPanel from "./dashboard/QuestionPanel.svelte"

  let { onNewGame, onReview }: { onNewGame: () => void; onReview: (() => void) | null } = $props()
</script>

<div class="grid h-full grid-cols-[16rem_1fr_19rem] divide-x">
  <BotList {onNewGame} />
  <div class="min-h-0 overflow-y-auto">
    {#if game.state.notices.includes("jev_key")}
      <div class="p-6 pb-0">
        <Alert.Root variant="destructive">
          <Alert.Description>{t.game.jevKey}</Alert.Description>
        </Alert.Root>
      </div>
    {/if}
    {#if isOver(game.state)}
      <GameOver {onNewGame} {onReview} />
    {/if}
    <QuestionPanel round={currentRound(game.state)} />
  </div>
  <HistoryList rounds={pastRounds(game.state)} />
</div>
