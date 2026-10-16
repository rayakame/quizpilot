<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js"
  import { Label } from "$lib/components/ui/label/index.js"
  import { t } from "$lib/i18n.js"
  import { percent } from "$lib/messages.js"
  import { MISTAKE_STEPS } from "../../../../shared/start.js"

  let { value, onChange }: { value: number; onChange: (rate: number) => void } = $props()
</script>

<div class="grid gap-2">
  <Label>{t.mistakes.title}</Label>
  <div class="flex flex-wrap gap-2" role="radiogroup" aria-label={t.mistakes.title}>
    {#each MISTAKE_STEPS as rate (rate)}
      <Button
        size="sm"
        variant={value === rate ? "secondary" : "outline"}
        role="radio"
        aria-checked={value === rate}
        onclick={() => onChange(rate)}
      >
        {rate === 0 ? t.mistakes.off : percent(rate)}
      </Button>
    {/each}
  </div>
  <p class="text-muted-foreground text-sm">{t.mistakes.hint}</p>
</div>
