import { APIConnectionError, AuthenticationError, InternalServerError } from "@typesafe-ai/sdk"
import { describe, expect, it, vi } from "vitest"
import { checkTypesafeKey } from "../../src/main/typesafe.js"

function client(result: () => Promise<unknown>) {
  const list = vi.fn(result)
  const connect = vi.fn<(key: string) => { models: { list: typeof list } }>(() => ({
    models: { list },
  }))
  return { connect, list }
}

describe("checkTypesafeKey", () => {
  it("accepts a key the API knows", async () => {
    const { connect } = client(async () => [])
    expect(await checkTypesafeKey("  ts-key \n", connect)).toBe("ok")
    expect(connect).toHaveBeenCalledWith("ts-key")
  })

  it("rejects an empty key without asking the API", async () => {
    const { connect } = client(async () => [])
    expect(await checkTypesafeKey("   ", connect)).toBe("invalid")
    expect(connect).not.toHaveBeenCalled()
  })

  it("tells a wrong key from a missing connection", async () => {
    const wrong = client(() => Promise.reject(new AuthenticationError(401, {}, new Headers())))
    const offline = client(() => Promise.reject(new APIConnectionError("fetch failed")))
    const broken = client(() => Promise.reject(new InternalServerError(500, {}, new Headers())))
    expect(await checkTypesafeKey("ts-key", wrong.connect)).toBe("invalid")
    expect(await checkTypesafeKey("ts-key", offline.connect)).toBe("offline")
    expect(await checkTypesafeKey("ts-key", broken.connect)).toBe("error")
  })
})
