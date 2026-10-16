<script lang="ts">
  import type { Snippet } from "svelte"
  import { Button } from "$lib/components/ui/button/index.js"
  import { Input } from "$lib/components/ui/input/index.js"
  import { Label } from "$lib/components/ui/label/index.js"
  import { keyText } from "$lib/messages.js"
  import type { KeyCheck } from "../../../../shared/api.js"

  let { saved, onSaved, children }: { saved: boolean; onSaved: () => void; children?: Snippet } =
    $props()

  let key = $state("")
  let checking = $state(false)
  let problem = $state<Exclude<KeyCheck, "ok"> | null>(null)

  async function save(event: SubmitEvent) {
    event.preventDefault()
    checking = true
    problem = null
    try {
      const result = await window.quizpilot.saveTypesafeKey(key)
      if (result === "ok") {
        key = ""
        onSaved()
      } else problem = result
    } catch {
      problem = "error"
    } finally {
      checking = false
    }
  }
</script>

<form class="grid gap-2" onsubmit={save}>
  <Label for="typesafe-key">API key</Label>
  <Input
    id="typesafe-key"
    type="password"
    autocomplete="off"
    placeholder={saved ? "Saved, paste a new key to replace it" : ""}
    bind:value={key}
  />
  {#if problem}
    <p class="text-destructive text-sm">{keyText(problem, "TypeSafe")}</p>
  {/if}
  <Button
    variant="link"
    class="h-auto w-fit p-0"
    onclick={() => window.quizpilot.openExternal("https://typesafe.ai")}
  >
    Get a key at typesafe.ai
  </Button>
  <div class="flex justify-end gap-2 pt-2">
    {@render children?.()}
    <Button type="submit" disabled={checking || !key.trim()}>
      {checking ? "Checking…" : "Check and save"}
    </Button>
  </div>
</form>
