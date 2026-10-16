<script lang="ts">
  import LogOut from "@lucide/svelte/icons/log-out"
  import Pause from "@lucide/svelte/icons/pause"
  import Play from "@lucide/svelte/icons/play"
  import { toast } from "svelte-sonner"
  import { Badge } from "$lib/components/ui/badge/index.js"
  import { Button } from "$lib/components/ui/button/index.js"
  import { game } from "$lib/game.svelte.js"
  import { canLeave, canPause, type BotView } from "$lib/game-state.js"
  import { ERROR_TEXT, statusText } from "$lib/messages.js"
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
    if (!outcome.ok) toast.error(`${name}: ${outcome.message}`)
  }
</script>

<aside class="flex min-h-0 flex-col">
  <div class="flex-1 space-y-2 overflow-y-auto p-3">
    {#each bots as bot (bot.name)}
      <div class="space-y-1 rounded-lg border p-3">
        <div class="flex items-center justify-between gap-2">
          <span class="truncate font-medium">{bot.name}</span>
          <Badge variant={bot.joinError || bot.status === "kicked" ? "destructive" : "secondary"}>
            {statusText(bot.status, bot.detail)}
          </Badge>
        </div>
        <div class="text-muted-foreground text-sm">
          {bot.totalScore} points{bot.rank ? ` · #${bot.rank}` : ""}
        </div>
        {#if bot.joinError}
          <p class="text-destructive text-sm">{ERROR_TEXT[bot.joinError]}</p>
          {#if bot.joinError === "duplicate_name" || bot.joinError === "unknown"}
            <Button size="sm" variant="outline" onclick={() => retry(bot)}>
              Join as {retryName(bot)}
            </Button>
          {/if}
        {:else if bot.detail && bot.status !== "joining"}
          <p class="text-muted-foreground text-sm">{bot.detail}</p>
        {/if}
        {#if canPause(bot) || canLeave(bot)}
          <div class="flex gap-1">
            {#if canPause(bot)}
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={bot.status === "paused" ? "Resume" : "Pause"}
                onclick={() => window.quizpilot.pause(bot.name, bot.status !== "paused")}
              >
                {#if bot.status === "paused"}<Play />{:else}<Pause />{/if}
              </Button>
            {/if}
            {#if canLeave(bot)}
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Leave"
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
      <Button onclick={() => (game.twoStepOpen = true)}>Enter two-step code</Button>
    {/if}
    {#if bots.some(canPause)}
      <Button variant="outline" onclick={() => window.quizpilot.pause(null, !allPaused)}>
        {allPaused ? "Resume all" : "Pause all"}
      </Button>
    {/if}
    <Button variant="ghost" onclick={onNewGame}>Leave and start over</Button>
  </div>
</aside>
