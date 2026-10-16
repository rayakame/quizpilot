import type { GameEvent } from "../shared/api.js"
import type { Messages } from "../shared/i18n/index.js"

export const BATCH_MS = 1500

export interface NotifierDeps {
  show(title: string, body: string): void
  focused(): boolean
  enabled(): boolean
  text(): Messages["notify"]
  later(run: () => void, ms: number): void
}

export class Notifier {
  private asking = false
  private over = false
  private keyWarned = false
  private hostEnded = false
  private waiting = false
  private finished: { bot: string; rank: number }[] = []
  private readonly lost = new Set<string>()
  private readonly kicked = new Set<string>()

  constructor(private readonly deps: NotifierDeps) {}

  reset(): void {
    this.asking = false
    this.over = false
    this.keyWarned = false
    this.hostEnded = false
    this.finished = []
    this.lost.clear()
    this.kicked.clear()
  }

  event(e: GameEvent): void {
    const text = this.deps.text()
    switch (e.type) {
      case "twoStepRequired":
        if (!this.asking) this.notify(text.twoStepTitle, text.twoStepBody)
        this.asking = true
        return
      case "twoStepResult":
        if (e.ok) this.asking = false
        return
      case "notice":
        if (this.keyWarned) return
        this.keyWarned = true
        return this.notify(text.jevKeyTitle, text.jevKeyBody)
      case "gameReset":
        this.over = false
        this.hostEnded = false
        this.finished = []
        return
      case "ended":
        if (this.over) return
        this.finished.push({ bot: e.bot, rank: e.end.rank })
        return this.soon()
      case "status":
        if (e.status === "kicked") this.kicked.add(e.bot)
        // Only bots that were in the game have a cause; a failed join has none.
        else if (e.status !== "disconnected" || !e.cause) return
        else if (e.cause === "ended") this.hostEnded = true
        else this.lost.add(e.bot)
        return this.soon()
    }
  }

  // Bots drop out or finish within moments of each other; one message says it all.
  private soon(): void {
    if (this.waiting) return
    this.waiting = true
    this.deps.later(() => this.flush(), BATCH_MS)
  }

  private flush(): void {
    this.waiting = false
    const text = this.deps.text()
    const best = [...this.finished].sort((a, b) => a.rank - b.rank)[0]
    if ((best || this.hostEnded) && !this.over) {
      this.over = true
      this.notify(text.overTitle, best ? text.overBody(best.bot, best.rank) : text.hostEnded)
    }
    if (this.lost.size > 0) this.notify(text.lostTitle, text.lostBody([...this.lost]))
    if (this.kicked.size > 0) this.notify(text.kickedTitle, text.kickedBody([...this.kicked]))
    this.lost.clear()
    this.kicked.clear()
  }

  private notify(title: string, body: string): void {
    if (this.deps.enabled() && !this.deps.focused()) this.deps.show(title, body)
  }
}
