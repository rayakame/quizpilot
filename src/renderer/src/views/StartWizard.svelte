<script lang="ts">
  import Dices from "@lucide/svelte/icons/dices"
  import Plus from "@lucide/svelte/icons/plus"
  import X from "@lucide/svelte/icons/x"
  import * as Alert from "$lib/components/ui/alert/index.js"
  import { Button } from "$lib/components/ui/button/index.js"
  import * as Card from "$lib/components/ui/card/index.js"
  import { Input } from "$lib/components/ui/input/index.js"
  import { Label } from "$lib/components/ui/label/index.js"
  import * as RadioGroup from "$lib/components/ui/radio-group/index.js"
  import { Switch } from "$lib/components/ui/switch/index.js"
  import { Textarea } from "$lib/components/ui/textarea/index.js"
  import MistakesPicker from "./forms/MistakesPicker.svelte"
  import { saveDiagnostics } from "$lib/diagnostics.js"
  import { game } from "$lib/game.svelte.js"
  import { t } from "$lib/i18n.js"
  import { quizLinkText } from "$lib/messages.js"
  import {
    addField,
    botName,
    checkFor,
    newForm,
    reusableCheck,
    stepProblem,
    toRequest,
    type LinkCheck,
  } from "$lib/start-form.js"
  import { generateName } from "../../../core/names/names.js"
  import { MAX_BOTS } from "../../../core/session/game-session.js"
  import type { PublicSettings, QuizCheck, StartResult } from "../../../shared/api.js"

  let { settings }: { settings: PublicSettings } = $props()

  const STEPS = ["game", "bots", "options"] as const
  const BACK_TO_PIN = ["pin", "not_found", "locked", "unknown"]

  // svelte-ignore state_referenced_locally
  let form = $state(newForm(settings))
  let step = $state(0)
  let error = $state<(() => string) | null>(null)
  let unknownJoin = $state(false)
  let starting = $state(false)
  let linkCheck = $state<LinkCheck | null>(null)
  const shownCheck = $derived(checkFor(linkCheck, form.quizLink))

  function next(event: SubmitEvent) {
    event.preventDefault()
    const problem = stepProblem(form, step)
    error = problem ? () => t.errors[problem] : null
    unknownJoin = false
    if (problem) return
    if (step < STEPS.length - 1) step += 1
    else void start()
  }

  async function checkLink(): Promise<QuizCheck | null> {
    const link = form.quizLink.trim()
    if (!link) return null
    const known = reusableCheck(linkCheck, link)
    if (known) return known
    linkCheck = { link, result: null }
    const result = await window.quizpilot
      .checkQuizLink(link)
      .catch((): QuizCheck => ({ ok: false, error: "unknown" }))
    if (linkCheck?.link === link) linkCheck = { link, result }
    return result
  }

  async function start() {
    starting = true
    unknownJoin = false
    const check = await checkLink()
    if (check && !check.ok) {
      starting = false
      const problem = check.error
      error = () => t.quizLink[problem]
      return
    }
    game.reset()
    let result: StartResult
    try {
      result = await window.quizpilot.startGame(toRequest($state.snapshot(form)))
    } catch (err) {
      result = {
        ok: false,
        error: "unknown",
        message: err instanceof Error ? err.message : String(err),
      }
    } finally {
      starting = false
    }
    if (result.ok) return game.begin()
    game.reset()
    const failed = result
    error =
      failed.error === "unknown"
        ? () => `${t.errors.unknown} (${failed.message})`
        : () => t.errors[failed.error]
    unknownJoin = failed.error === "unknown"
    if (BACK_TO_PIN.includes(result.error)) step = 0
  }

  function randomName(i: number) {
    const others = form.bots.filter((_, j) => j !== i).map(botName)
    form.bots[i]!.value = generateName(others)
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>{t.start.title}</Card.Title>
    <Card.Description>
      {#each STEPS as id, i (id)}
        <span class={i === step ? "text-foreground font-medium" : ""}
          >{i + 1}. {t.start.steps[id]}</span
        >
        {#if i < STEPS.length - 1}<span class="px-1">›</span>{/if}
      {/each}
    </Card.Description>
  </Card.Header>
  <form class="contents" onsubmit={next}>
    <Card.Content class="grid gap-4">
      {#if step === 0}
        <div class="grid gap-2">
          <Label for="pin">{t.start.pin}</Label>
          <Input id="pin" bind:value={form.pin} placeholder={t.start.pinPlaceholder} autofocus />
        </div>
      {:else if step === 1}
        <div class="grid gap-2">
          <Label>{t.start.bots}</Label>
          {#each form.bots as bot, i (i)}
            <div class="flex gap-2">
              <Input bind:value={bot.value} placeholder={bot.placeholder} maxlength={15} />
              <Button
                variant="ghost"
                size="icon"
                aria-label={t.start.randomName}
                onclick={() => randomName(i)}
              >
                <Dices />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t.start.removeBot}
                disabled={form.bots.length === 1}
                onclick={() => form.bots.splice(i, 1)}
              >
                <X />
              </Button>
            </div>
          {/each}
          {#if form.bots.length < MAX_BOTS}
            <Button
              variant="outline"
              class="w-fit"
              onclick={() => (form.bots = addField(form.bots))}
            >
              <Plus />
              {t.start.addBot}
            </Button>
          {/if}
        </div>
      {:else}
        <div class="grid gap-2">
          <Label>{t.start.whenToAnswer}</Label>
          <RadioGroup.Root
            value={form.human ? "human" : "instant"}
            onValueChange={(v) => (form.human = v === "human")}
          >
            <div class="flex items-center gap-2">
              <RadioGroup.Item value="instant" id="instant" />
              <Label for="instant" class="font-normal">{t.start.instant}</Label>
            </div>
            <div class="flex items-center gap-2">
              <RadioGroup.Item value="human" id="human" />
              <Label for="human" class="font-normal">{t.start.human}</Label>
            </div>
          </RadioGroup.Root>
          {#if form.human}
            <div class="flex items-center gap-2 pl-6 text-sm">
              <Input
                type="number"
                min="0"
                max="30"
                step="0.5"
                class="w-20"
                bind:value={form.minSeconds}
              />
              {t.common.to}
              <Input
                type="number"
                min="0"
                max="30"
                step="0.5"
                class="w-20"
                bind:value={form.maxSeconds}
              />
              {t.common.seconds}
            </div>
          {/if}
        </div>
        <MistakesPicker value={form.mistakes} onChange={(rate) => (form.mistakes = rate)} />
        <div class="grid gap-2">
          <Label for="quiz-link">{t.start.quizLink}</Label>
          <Input
            id="quiz-link"
            bind:value={form.quizLink}
            placeholder="create.kahoot.it/details/…"
            onblur={() => void checkLink()}
          />
          {#if shownCheck}
            <p
              class={[
                "text-sm",
                shownCheck.result?.ok === false ? "text-destructive" : "text-muted-foreground",
              ]}
            >
              {quizLinkText(shownCheck)}
            </p>
          {:else}
            <p class="text-muted-foreground text-sm">{t.start.quizLinkHint}</p>
          {/if}
        </div>
        <div class="grid gap-2">
          <Label for="context">{t.start.context}</Label>
          <Textarea
            id="context"
            bind:value={form.context}
            placeholder={t.start.contextPlaceholder}
          />
        </div>
        <div class="flex items-center gap-2">
          <Switch id="previous" bind:checked={form.includePrevious} />
          <Label for="previous" class="font-normal">{t.start.previous}</Label>
        </div>
      {/if}
      {#if error}
        <Alert.Root variant="destructive">
          <Alert.Description>
            <p>{error()}</p>
            {#if unknownJoin}
              <p>{t.start.unknownHint}</p>
              <Button
                size="sm"
                variant="outline"
                class="mt-2"
                onclick={() => void saveDiagnostics()}
              >
                {t.about.saveDiagnostics}
              </Button>
            {/if}
          </Alert.Description>
        </Alert.Root>
      {/if}
    </Card.Content>
    <Card.Footer class="justify-between">
      <Button variant="ghost" disabled={step === 0 || starting} onclick={() => (step -= 1)}>
        {t.common.back}
      </Button>
      <Button type="submit" disabled={starting}>
        {step < STEPS.length - 1 ? t.common.next : starting ? t.start.joining : t.start.join}
      </Button>
    </Card.Footer>
  </form>
</Card.Root>
