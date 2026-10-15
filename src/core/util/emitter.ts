type Listener = (payload: never) => void

export class Emitter<E extends object> {
  private readonly listeners = new Map<keyof E, Set<Listener>>()

  on<K extends keyof E>(event: K, fn: (payload: E[K]) => void): () => void {
    const set = this.listeners.get(event) ?? new Set<Listener>()
    this.listeners.set(event, set)
    set.add(fn as Listener)
    return () => set.delete(fn as Listener)
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    for (const fn of this.listeners.get(event) ?? []) (fn as (payload: E[K]) => void)(payload)
  }
}
