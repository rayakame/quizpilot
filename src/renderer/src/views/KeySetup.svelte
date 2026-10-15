<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js"
  import * as Card from "$lib/components/ui/card/index.js"
  import { Input } from "$lib/components/ui/input/index.js"
  import { Label } from "$lib/components/ui/label/index.js"
  import { keyText } from "$lib/messages.js"
  import type { KeyCheck } from "../../../shared/api.js"

  let { firstRun, onDone }: { firstRun: boolean; onDone: () => void } = $props()

  let key = $state("")
  let checking = $state(false)
  let problem = $state<Exclude<KeyCheck, "ok"> | null>(null)

  async function save(event: SubmitEvent) {
    event.preventDefault()
    checking = true
    problem = null
    const result = await window.quizpilot.saveTypesafeKey(key)
    checking = false
    if (result === "ok") onDone()
    else problem = result
  }
</script>

<div class="flex h-full items-center justify-center p-6">
  <Card.Root class="w-full max-w-md">
    <Card.Header>
      <Card.Title>{firstRun ? "Welcome to QuizPilot" : "TypeSafe key"}</Card.Title>
      <Card.Description>
        QuizPilot answers with Jev from TypeSafe. Paste your API key, it stays on this computer.
      </Card.Description>
    </Card.Header>
    <form class="contents" onsubmit={save}>
      <Card.Content class="grid gap-2">
        <Label for="typesafe-key">API key</Label>
        <Input id="typesafe-key" type="password" autocomplete="off" bind:value={key} />
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
      </Card.Content>
      <Card.Footer class="justify-end gap-2">
        {#if !firstRun}
          <Button variant="ghost" onclick={onDone}>Cancel</Button>
        {/if}
        <Button type="submit" disabled={checking || !key.trim()}>
          {checking ? "Checking…" : "Check and save"}
        </Button>
      </Card.Footer>
    </form>
  </Card.Root>
</div>
