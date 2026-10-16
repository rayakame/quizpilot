<script lang="ts">
  import Check from "@lucide/svelte/icons/check"
  import ChevronDown from "@lucide/svelte/icons/chevron-down"
  import Minus from "@lucide/svelte/icons/minus"
  import X from "@lucide/svelte/icons/x"
  import { answerText, correctAnswer } from "../../../../core/answer/describe.js"
  import type { Question } from "../../../../core/types.js"
  import { t } from "$lib/i18n.js"
  import { percent, secondsText, sourceText } from "$lib/messages.js"
  import type { HistoryQuestion } from "../../../../shared/api.js"
  import { questionOutcome } from "../../../../shared/history.js"

  let { item }: { item: HistoryQuestion } = $props()
  let open = $state(false)

  const q = $derived<Question>({ ...item.question, raw: null })
  const result = $derived(questionOutcome(item))
</script>

<li class="rounded-lg border text-sm">
  <button class="flex w-full items-start gap-2 p-3 text-left" onclick={() => (open = !open)}>
    {#if result === "right"}
      <Check class="mt-0.5 size-4 shrink-0 text-green-600" />
    {:else if result === "wrong"}
      <X class="text-destructive mt-0.5 size-4 shrink-0" />
    {:else}
      <Minus class="text-muted-foreground mt-0.5 size-4 shrink-0" />
    {/if}
    <div class="min-w-0 flex-1">
      <div class="font-medium">{q.index + 1}. {q.title ?? t.common.noText}</div>
      {#if item.decision}
        <div class="text-muted-foreground truncate">
          {answerText(item.decision.answer, q)} · {sourceText(item.decision)}
        </div>
      {/if}
    </div>
    <ChevronDown class={["mt-0.5 size-4 shrink-0 transition", open && "rotate-180"]} />
  </button>
  {#if open}
    <div class="grid gap-3 border-t p-3">
      {#if q.image}
        <img src={q.image.url} alt={q.imageAlt ?? ""} class="max-h-40 rounded object-contain" />
      {/if}
      {#if item.correctChoices}
        <div>
          <span class="text-muted-foreground">{t.history.rightAnswer}</span>
          {answerText(correctAnswer(q, item.correctChoices), q)}
        </div>
      {/if}
      {#if q.choices.length > 0}
        <ul class="grid gap-1">
          {#each q.choices as choice, i (i)}
            <li
              class={item.correctChoices?.includes(i) && q.type !== "jumble" ? "font-medium" : ""}
            >
              {#if choice.image}
                <img src={choice.image.url} alt="" class="inline h-10 rounded object-contain" />
              {:else}
                {choice.text ?? `#${i + 1}`}
              {/if}
              {#if item.decision?.jev?.probabilities?.[i] !== undefined}
                <span class="text-muted-foreground">
                  · {percent(item.decision.jev.probabilities[i]!)}
                </span>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
      {#if item.results.length > 0}
        <ul class="text-muted-foreground grid gap-1">
          {#each item.results as r (r.bot)}
            <li>
              {t.common.pair(
                r.bot,
                r.correct === null
                  ? "–"
                  : r.correct
                    ? t.history.result.right
                    : t.history.result.wrong,
              )}
              {#if r.points !== null}· {t.common.points(r.points)}{/if}
              {#if r.answeredMs !== null}· {secondsText(r.answeredMs)}{/if}
              {#if r.onPurpose}· {t.game.onPurpose}{/if}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</li>
