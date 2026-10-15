import {
  APIConnectionError,
  AuthenticationError,
  PermissionDeniedError,
  TypeSafeClient,
} from "@typesafe-ai/sdk"
import type { KeyCheck } from "../shared/api.js"

export interface ModelList {
  models: { list(): PromiseLike<unknown> }
}

function connect(apiKey: string): ModelList {
  return new TypeSafeClient({ apiKey, retry: { maxRetries: 0 }, timeout: 8000 })
}

export async function checkTypesafeKey(
  key: string,
  client: (apiKey: string) => ModelList = connect,
): Promise<KeyCheck> {
  const apiKey = key.trim()
  if (!apiKey) return "invalid"
  try {
    await client(apiKey).models.list()
    return "ok"
  } catch (err) {
    if (err instanceof AuthenticationError || err instanceof PermissionDeniedError) return "invalid"
    if (err instanceof APIConnectionError) return "offline"
    return "error"
  }
}
