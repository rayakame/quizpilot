<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left"
  import { toast } from "svelte-sonner"
  import { Button } from "$lib/components/ui/button/index.js"
  import type { PublicSettings, SettingsPatch } from "../../../../shared/api.js"
  import FallbackForm from "../forms/FallbackForm.svelte"
  import KeyForm from "../forms/KeyForm.svelte"
  import AboutSection from "./AboutSection.svelte"
  import AppearanceSection from "./AppearanceSection.svelte"
  import BehaviorSection from "./BehaviorSection.svelte"
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

  const SECTIONS = [
    { id: "keys", label: "TypeSafe key" },
    { id: "backup", label: "Backup AI" },
    { id: "behavior", label: "Behavior" },
    { id: "appearance", label: "Appearance" },
    { id: "about", label: "About" },
  ] as const

  let section = $state<(typeof SECTIONS)[number]["id"]>("keys")
  let saves = $state(0)

  async function patch(p: SettingsPatch) {
    try {
      onChange(await window.quizpilot.saveSettings(p))
    } catch {
      toast.error("Couldn't save the settings.")
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
      <ArrowLeft /> Back
    </Button>
    {#each SECTIONS as item (item.id)}
      <Button
        variant={section === item.id ? "secondary" : "ghost"}
        class="justify-start"
        onclick={() => (section = item.id)}
      >
        {item.label}
      </Button>
    {/each}
  </nav>
  <div class="min-h-0 overflow-y-auto">
    <div class="mx-auto max-w-xl p-8">
      {#if section === "keys"}
        <section class="space-y-6">
          <div>
            <h2 class="text-lg font-semibold">TypeSafe key</h2>
            <p class="text-muted-foreground text-sm">
              Jev answers every question. The key stays on this computer.
            </p>
          </div>
          <KeyForm saved={settings.hasTypesafeKey} onSaved={() => saved("TypeSafe key saved")} />
        </section>
      {:else if section === "backup"}
        <section class="space-y-6">
          <div>
            <h2 class="text-lg font-semibold">Backup AI</h2>
            <p class="text-muted-foreground text-sm">
              Asked when Jev is unsure, on picture questions, for typed answers and word clouds.
            </p>
          </div>
          {#key saves}
            <FallbackForm {settings} onSaved={() => saved("Backup AI saved")} />
          {/key}
          <ThresholdsSection {settings} {patch} />
        </section>
      {:else if section === "behavior"}
        <BehaviorSection {settings} {patch} />
      {:else if section === "appearance"}
        <AppearanceSection theme={settings.theme} {patch} />
      {:else}
        <AboutSection />
      {/if}
    </div>
  </div>
</div>
