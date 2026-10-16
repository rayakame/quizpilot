import { AuthenticationError, PermissionDeniedError } from "@typesafe-ai/sdk"
import type { JevApi } from "../core/providers/jev.js"

export interface JevHooks {
  failed(err: unknown): void
  keyRejected(): void
}

export function isKeyRejection(err: unknown): boolean {
  return err instanceof AuthenticationError || err instanceof PermissionDeniedError
}

// The engine swallows Jev errors and guesses, so this is the only place they show up.
export function watchJev(jev: JevApi, hooks: JevHooks): JevApi {
  let rejected = false
  const watch = <T>(call: Promise<T>, signal: AbortSignal): Promise<T> =>
    call.catch((err: unknown) => {
      if (!signal.aborted) {
        hooks.failed(err)
        if (!rejected && isKeyRejection(err)) {
          rejected = true
          hooks.keyRejected()
        }
      }
      throw err
    })
  return {
    chooseOne: (input, opts) => watch(jev.chooseOne(input, opts), opts.signal),
    checkEach: (input, opts) => watch(jev.checkEach(input, opts), opts.signal),
    placeEach: (input, opts) => watch(jev.placeEach(input, opts), opts.signal),
    estimateNumber: (input, range, opts) =>
      watch(jev.estimateNumber(input, range, opts), opts.signal),
  }
}
