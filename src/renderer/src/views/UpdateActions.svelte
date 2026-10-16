<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js"
  import { t } from "$lib/i18n.js"
  import { update } from "$lib/updates.svelte.js"

  const current = $derived(update.state)
</script>

{#if current.kind === "available"}
  <span>{t.updates.available(current.version)}</span>
  <Button size="sm" variant="outline" onclick={() => window.quizpilot.openExternal(current.url)}>
    {t.updates.download}
  </Button>
{:else if current.kind === "ready"}
  <span>{t.updates.ready(current.version)}</span>
  <Button size="sm" onclick={() => void update.install()}>{t.updates.restart}</Button>
{/if}
