<script lang="ts">
  import { t } from "$lib/i18n.js"
  import Logo from "$lib/Logo.svelte"

  let version = $state("")
  void window.quizpilot.getAppInfo().then((info) => (version = info.version))
</script>

<section class="space-y-4">
  <div class="flex items-center gap-4">
    <Logo class="size-16" />
    <div>
      <h2 class="text-lg font-semibold">QuizPilot</h2>
      <p class="text-muted-foreground text-sm">{t.about.version(version)}</p>
    </div>
  </div>
  <p class="text-muted-foreground text-sm">{t.about.license}</p>
</section>
