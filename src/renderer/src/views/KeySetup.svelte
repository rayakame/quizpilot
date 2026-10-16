<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js"
  import Logo from "$lib/Logo.svelte"
  import KeyForm from "./forms/KeyForm.svelte"

  let { onDone }: { onDone: () => void } = $props()
</script>

<div class="flex h-full items-center justify-center p-6">
  <Card.Root class="w-full max-w-md">
    <Card.Header>
      <Logo class="mb-2 size-12" />
      <Card.Title>Welcome to QuizPilot</Card.Title>
      <Card.Description>
        QuizPilot answers with Jev from TypeSafe. Paste your API key, it stays on this computer.
      </Card.Description>
    </Card.Header>
    <Card.Content>
      <KeyForm saved={false} onSaved={onDone} />
    </Card.Content>
  </Card.Root>
</div>
