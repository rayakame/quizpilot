<script lang="ts">
  import Check from "@lucide/svelte/icons/check"
  import Minus from "@lucide/svelte/icons/minus"
  import X from "@lucide/svelte/icons/x"
  import { answerSummary, outcome, type RoundView } from "$lib/game-state.js"
  import { sourceText } from "$lib/messages.js"

  let { rounds }: { rounds: RoundView[] } = $props()
</script>

<aside class="min-h-0 overflow-y-auto p-3">
  <h3 class="text-muted-foreground px-1 pb-2 text-sm font-medium">Earlier questions</h3>
  {#if rounds.length === 0}
    <p class="text-muted-foreground px-1 text-sm">Nothing yet.</p>
  {/if}
  <ol class="space-y-2">
    {#each rounds as round (round.question.index)}
      {@const result = outcome(round)}
      <li class="rounded-lg border p-3 text-sm">
        <div class="flex items-start gap-2">
          {#if result === "right"}
            <Check class="mt-0.5 size-4 shrink-0 text-green-600" />
          {:else if result === "wrong"}
            <X class="text-destructive mt-0.5 size-4 shrink-0" />
          {:else}
            <Minus class="text-muted-foreground mt-0.5 size-4 shrink-0" />
          {/if}
          <div class="min-w-0">
            <div class="line-clamp-2 font-medium">
              {round.question.index + 1}. {round.question.title ?? "(no text)"}
            </div>
            {#if round.decision}
              <div class="text-muted-foreground truncate">
                {answerSummary(round)} · {sourceText(round.decision)}
              </div>
            {/if}
          </div>
        </div>
      </li>
    {/each}
  </ol>
</aside>
