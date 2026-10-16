<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js"
  import { currentLanguage, setLanguage, t } from "$lib/i18n.js"
  import Logo from "$lib/Logo.svelte"
  import type { Language } from "../../../shared/i18n/index.js"
  import KeyForm from "./forms/KeyForm.svelte"
  import LanguageSelect from "./forms/LanguageSelect.svelte"

  let { onDone }: { onDone: () => void } = $props()

  function choose(language: Language) {
    setLanguage(language)
    void window.quizpilot.saveSettings({ language })
  }
</script>

<div class="flex h-full items-center justify-center p-6">
  <Card.Root class="w-full max-w-md">
    <Card.Header>
      <div class="mb-2 flex items-start justify-between">
        <Logo class="size-12" />
        <LanguageSelect value={currentLanguage()} onChange={choose} class="w-44" />
      </div>
      <Card.Title>{t.setup.welcome}</Card.Title>
      <Card.Description>{t.setup.welcomeText}</Card.Description>
    </Card.Header>
    <Card.Content>
      <KeyForm saved={false} onSaved={onDone} />
    </Card.Content>
  </Card.Root>
</div>
