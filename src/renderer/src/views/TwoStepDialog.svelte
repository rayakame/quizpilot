<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js"
  import * as Dialog from "$lib/components/ui/dialog/index.js"
  import { game } from "$lib/game.svelte.js"
  import { COLORS } from "$lib/kahoot-style.js"

  let picked = $state<number[]>([])
  let sending = $state(false)

  async function send() {
    sending = true
    await window.quizpilot.submitTwoStep([...picked])
    sending = false
    picked = []
  }
</script>

<Dialog.Root bind:open={game.twoStepOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Two-step join</Dialog.Title>
      <Dialog.Description>
        Tap the four symbols in the order the host's screen shows them.
      </Dialog.Description>
    </Dialog.Header>
    {#if game.state.twoStep === "wrong"}
      <p class="text-destructive text-sm">
        That wasn't right. The code changes every few seconds, so check the screen and try again.
      </p>
    {/if}
    <div class="grid grid-cols-2 gap-2">
      {#each COLORS as color, i (color.name)}
        <button
          type="button"
          class="{color.color} h-16 rounded-lg text-3xl text-white transition-opacity disabled:opacity-30"
          aria-label={color.name}
          disabled={picked.includes(i) || sending}
          onclick={() => (picked = [...picked, i])}
        >
          {color.shape}
        </button>
      {/each}
    </div>
    <div class="flex justify-center gap-2">
      {#each [0, 1, 2, 3] as slot (slot)}
        {@const color = COLORS[picked[slot] ?? -1]}
        <div
          class="flex size-10 items-center justify-center rounded-md text-white {color?.color ??
            'border border-dashed'}"
        >
          {color?.shape ?? ""}
        </div>
      {/each}
    </div>
    <Dialog.Footer>
      <Button variant="ghost" disabled={picked.length === 0} onclick={() => (picked = [])}>
        Clear
      </Button>
      <Button disabled={picked.length < 4 || sending} onclick={send}>Send code</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
