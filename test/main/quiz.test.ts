import { describe, expect, it, vi } from "vitest"
import { QuizCache } from "../../src/main/quiz.js"

const ID = "fba5cd05-96af-4506-b8ce-388ff9b33fbb"
const LINK = `https://create.kahoot.it/details/geo/${ID}`
const quizBody = {
  title: "Geo",
  questions: [{ type: "quiz" }, { type: "content" }, { type: "slider" }],
}
const ok = () => new Response(JSON.stringify(quizBody), { status: 200 })

describe("QuizCache", () => {
  it("summarises a quiz and counts only real questions", async () => {
    const cache = new QuizCache(vi.fn<typeof fetch>(async () => ok()))
    expect(await cache.check(LINK)).toEqual({ ok: true, title: "Geo", questions: 2 })
  })

  it("loads each quiz once", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => ok())
    const cache = new QuizCache(fetchFn)
    await cache.check(LINK)
    const quiz = await cache.get(` ${ID} `)
    expect(quiz.title).toBe("Geo")
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it("tries again after a failure", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(ok())
    const cache = new QuizCache(fetchFn)
    expect(await cache.check(LINK)).toEqual({ ok: false, error: "offline" })
    expect(await cache.check(LINK)).toMatchObject({ ok: true })
  })

  it("rejects a link without a quiz id", async () => {
    const fetchFn = vi.fn<typeof fetch>()
    expect(await new QuizCache(fetchFn).check("kahoot.it")).toEqual({ ok: false, error: "link" })
    expect(fetchFn).not.toHaveBeenCalled()
  })
})
