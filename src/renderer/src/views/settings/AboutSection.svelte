<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js"
  import { saveDiagnostics } from "$lib/diagnostics.js"
  import { t } from "$lib/i18n.js"
  import Logo from "$lib/Logo.svelte"
  import { update } from "$lib/updates.svelte.js"
  import UpdateActions from "../UpdateActions.svelte"

  let version = $state("")
  void window.quizpilot.getAppInfo().then((info) => (version = info.version))
</script>

<section class="space-y-6">
  <div class="space-y-4">
    <div class="flex items-center gap-4">
      <Logo class="size-16" />
      <div>
        <h2 class="text-lg font-semibold">QuizPilot</h2>
        <p class="text-muted-foreground text-sm">{t.about.version(version)}</p>
      </div>
    </div>
    {#if update.state.kind !== "off"}
      <div class="flex flex-wrap items-center gap-3 text-sm">
        {#if update.state.kind === "none"}
          <Button
            variant="outline"
            size="sm"
            disabled={update.checking}
            onclick={() => void update.check()}
          >
            {update.checking ? t.updates.checking : t.updates.check}
          </Button>
          {#if update.checked && !update.checking}
            <span class="text-muted-foreground">
              {update.failed ? t.updates.failed : t.updates.upToDate}
            </span>
          {/if}
        {:else if update.state.kind === "downloading"}
          <span class="text-muted-foreground">{t.updates.downloading(update.state.version)}</span>
        {:else}
          <UpdateActions />
        {/if}
      </div>
    {/if}
    <p class="text-muted-foreground text-sm">{t.about.license}</p>
  </div>
  <div class="grid gap-3 border-t pt-6">
    <h3 class="font-medium">{t.about.diagnostics}</h3>
    <p class="text-muted-foreground text-sm">{t.about.diagnosticsText}</p>
    <Button variant="outline" class="w-fit" onclick={() => void saveDiagnostics()}>
      {t.about.saveDiagnostics}
    </Button>
  </div>
</section>
