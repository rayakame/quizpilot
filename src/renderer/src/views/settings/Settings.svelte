<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left"
  import { toast } from "svelte-sonner"
  import { Button } from "$lib/components/ui/button/index.js"
  import { t } from "$lib/i18n.js"
  import type { PublicSettings, SettingsPatch } from "../../../../shared/api.js"
  import FallbackForm from "../forms/FallbackForm.svelte"
  import KeyForm from "../forms/KeyForm.svelte"
  import AboutSection from "./AboutSection.svelte"
  import AppearanceSection from "./AppearanceSection.svelte"
  import BehaviorSection from "./BehaviorSection.svelte"
  import HistorySection from "./HistorySection.svelte"
  import ThresholdsSection from "./ThresholdsSection.svelte"

  let {
    settings,
    onChange,
    onClose,
  }: {
    settings: PublicSettings
    onChange: (settings: PublicSettings) => void
    onClose: () => void
  } = $props()

  const SECTIONS = ["keys", "backup", "behavior", "history", "appearance", "about"] as const

  let section = $state<(typeof SECTIONS)[number]>("keys")
  let saves = $state(0)

  async function patch(p: SettingsPatch) {
    try {
      onChange(await window.quizpilot.saveSettings(p))
    } catch {
      toast.error(t.settings.saveFailed)
    }
  }

  async function saved(message: string) {
    onChange(await window.quizpilot.getSettings())
    saves += 1
    toast.success(message)
  }
</script>

<div class="grid h-full grid-cols-[14rem_1fr]">
  <nav class="flex flex-col gap-1 border-r p-3">
    <Button variant="ghost" class="mb-2 justify-start" onclick={onClose}>
      <ArrowLeft />
      {t.common.back}
    </Button>
    {#each SECTIONS as id (id)}
      <Button
        variant={section === id ? "secondary" : "ghost"}
        class="justify-start"
        onclick={() => (section = id)}
      >
        {t.settings.sections[id]}
      </Button>
    {/each}
  </nav>
  <div class="min-h-0 overflow-y-auto">
    <div class="mx-auto max-w-xl p-8">
      {#if section === "keys"}
        <section class="space-y-6">
          <div>
            <h2 class="text-lg font-semibold">{t.settings.sections.keys}</h2>
            <p class="text-muted-foreground text-sm">{t.settings.keyText}</p>
          </div>
          <KeyForm saved={settings.hasTypesafeKey} onSaved={() => saved(t.settings.keySaved)} />
        </section>
      {:else if section === "backup"}
        <section class="space-y-6">
          <div>
            <h2 class="text-lg font-semibold">{t.settings.sections.backup}</h2>
            <p class="text-muted-foreground text-sm">{t.settings.backupText}</p>
          </div>
          {#key saves}
            <FallbackForm {settings} onSaved={() => saved(t.settings.backupSaved)} />
          {/key}
          <ThresholdsSection {settings} {patch} />
        </section>
      {:else if section === "behavior"}
        <BehaviorSection {settings} {patch} />
      {:else if section === "history"}
        <HistorySection {settings} {patch} />
      {:else if section === "appearance"}
        <AppearanceSection {settings} {patch} />
      {:else}
        <AboutSection />
      {/if}
    </div>
  </div>
</div>
