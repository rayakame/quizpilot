<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js"
  import * as Card from "$lib/components/ui/card/index.js"
  import type { PublicSettings } from "../../../shared/api.js"
  import FallbackForm from "./forms/FallbackForm.svelte"

  let { settings, onDone }: { settings: PublicSettings; onDone: () => void } = $props()
</script>

<div class="h-full overflow-y-auto">
  <div class="flex min-h-full items-center justify-center p-6">
    <Card.Root class="w-full max-w-md">
      <Card.Header>
        <Card.Title>Backup AI (optional)</Card.Title>
        <Card.Description>
          When Jev is unsure, QuizPilot can ask a second AI. It needs its own API key and costs a
          little per question. You can set it up later in the settings.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <FallbackForm {settings} onSaved={onDone}>
          <Button variant="ghost" onclick={onDone}>Skip</Button>
        </FallbackForm>
      </Card.Content>
    </Card.Root>
  </div>
</div>
