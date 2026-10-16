<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js"
  import * as Card from "$lib/components/ui/card/index.js"
  import { currentLanguage, setLanguage, t } from "$lib/i18n.js"
  import Logo from "$lib/Logo.svelte"
  import { LANGUAGE_NAMES, LANGUAGES, type Language } from "../../../shared/i18n/index.js"
  import KeyForm from "./forms/KeyForm.svelte"

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
        <div class="flex gap-1">
          {#each LANGUAGES as language (language)}
            <Button
              size="sm"
              variant={currentLanguage() === language ? "secondary" : "ghost"}
              onclick={() => choose(language)}
            >
              {LANGUAGE_NAMES[language]}
            </Button>
          {/each}
        </div>
      </div>
      <Card.Title>{t.setup.welcome}</Card.Title>
      <Card.Description>{t.setup.welcomeText}</Card.Description>
    </Card.Header>
    <Card.Content>
      <KeyForm saved={false} onSaved={onDone} />
    </Card.Content>
  </Card.Root>
</div>
