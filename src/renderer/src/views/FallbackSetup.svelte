<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js"
  import * as Card from "$lib/components/ui/card/index.js"
  import { t } from "$lib/i18n.js"
  import type { PublicSettings } from "../../../shared/api.js"
  import FallbackForm from "./forms/FallbackForm.svelte"

  let { settings, onDone }: { settings: PublicSettings; onDone: () => void } = $props()
</script>

<div class="h-full overflow-y-auto">
  <div class="flex min-h-full items-center justify-center p-6">
    <Card.Root class="w-full max-w-md">
      <Card.Header>
        <Card.Title>{t.setup.backupTitle}</Card.Title>
        <Card.Description>{t.setup.backupText}</Card.Description>
      </Card.Header>
      <Card.Content>
        <FallbackForm {settings} onSaved={onDone}>
          <Button variant="ghost" onclick={onDone}>{t.common.skip}</Button>
        </FallbackForm>
      </Card.Content>
    </Card.Root>
  </div>
</div>
