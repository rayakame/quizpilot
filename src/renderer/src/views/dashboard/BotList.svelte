<script lang="ts">
  import LogOut from "@lucide/svelte/icons/log-out"
  import Pause from "@lucide/svelte/icons/pause"
  import Play from "@lucide/svelte/icons/play"
  import { toast } from "svelte-sonner"
  import { Badge } from "$lib/components/ui/badge/index.js"
  import { Button } from "$lib/components/ui/button/index.js"
  import { game } from "$lib/game.svelte.js"
  import { canLeave, canPause, type BotView } from "$lib/game-state.js"
  import { t } from "$lib/i18n.js"
  import { statusText } from "$lib/messages.js"
  import { suggestName } from "../../../../core/names/names.js"

  let { onNewGame }: { onNewGame: () => void } = $props()

  const bots = $derived(game.state.bots)
  const allPaused = $derived(
    bots.some(canPause) && bots.filter(canPause).every((b) => b.status === "paused"),
  )

  function retryName(bot: BotView): string {
    if (bot.joinError !== "duplicate_name") return bot.name
    return suggestName(
      bot.name,
      bots.map((b) => b.name),
    )
  }

  async function retry(bot: BotView) {
    const name = retryName(bot)
    game.forget(bot.name)
    const outcome = await window.quizpilot.addBot(name)
    if (!outcome.ok) toast.error(t.common.pair(name, t.errors[outcome.code]))
  }
</script>

<aside class="flex min-h-0 flex-col">
  <div class="flex-1 space-y-2 overflow-y-auto p-3">
    {#each bots as bot (bot.name)}
      <div class="space-y-1 rounded-lg border p-3">
        <div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span class="truncate font-medium">{bot.name}</span>
          <Badge variant={bot.joinError || bot.status === "kicked" ? "destructive" : "secondary"}>
            {statusText(bot.status, bot.detail)}
          </Badge>
        </div>
        <div class="text-muted-foreground text-sm">
          {t.common.points(bot.totalScore)}{bot.rank ? ` · ${t.common.rank(bot.rank)}` : ""}
        </div>
        {#if bot.joinError}
          <p class="text-destructive text-sm">{t.errors[bot.joinError]}</p>
          {#if bot.joinError === "duplicate_name" || bot.joinError === "unknown"}
            <Button
              size="sm"
              variant="outline"
              class="h-auto max-w-full py-1 text-left whitespace-normal"
              onclick={() => retry(bot)}
            >
              {t.game.joinAs(retryName(bot))}
            </Button>
          {/if}
        {:else if bot.status === "disconnected" && bot.cause}
          <p class="text-muted-foreground text-sm">{t.game.causes[bot.cause]}</p>
        {/if}
        {#if canPause(bot) || canLeave(bot)}
          <div class="flex gap-1">
            {#if canPause(bot)}
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={bot.status === "paused" ? t.game.resume : t.game.pause}
                onclick={() => window.quizpilot.pause(bot.name, bot.status !== "paused")}
              >
                {#if bot.status === "paused"}<Play />{:else}<Pause />{/if}
              </Button>
            {/if}
            {#if canLeave(bot)}
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t.game.leave}
                onclick={() => window.quizpilot.leave(bot.name)}
              >
                <LogOut />
              </Button>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>
  <div class="grid gap-2 border-t p-3">
    {#if game.state.twoStep !== "none"}
      <Button onclick={() => (game.twoStepOpen = true)}>{t.game.enterCode}</Button>
    {/if}
    {#if bots.some(canPause)}
      <Button variant="outline" onclick={() => window.quizpilot.pause(null, !allPaused)}>
        {allPaused ? t.game.resumeAll : t.game.pauseAll}
      </Button>
    {/if}
    <Button variant="ghost" onclick={onNewGame}>{t.game.startOver}</Button>
  </div>
</aside>
