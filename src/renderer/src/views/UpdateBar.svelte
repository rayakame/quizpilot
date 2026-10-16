<script lang="ts">
  import { update } from "$lib/updates.svelte.js"
  import UpdateActions from "./UpdateActions.svelte"
</script>

{#if update.state.kind === "available" || update.state.kind === "ready"}
  <div class="bg-muted flex items-center justify-center gap-3 border-b px-4 py-2 text-sm">
    <UpdateActions />
  </div>
{/if}
