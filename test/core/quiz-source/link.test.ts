import { describe, expect, it, vi } from "vitest"
import {
  loadQuiz,
  parseQuizLink,
  QUIZ_API,
  QuizLoadError,
} from "../../../src/core/quiz-source/link.js"

const ID = "fba5cd05-96af-4506-b8ce-388ff9b33fbb"

function answering(status: number, body: unknown) {
  return vi.fn<typeof fetch>(
    async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
  )
}

async function problem(p: Promise<unknown>) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  )
  return err instanceof QuizLoadError ? err.code : err
}

describe("parseQuizLink", () => {
  it.each([
    [`https://create.kahoot.it/details/world-geography/${ID}`],
    [`https://create.kahoot.it/details/${ID}`],
    [`https://play.kahoot.it/v2/?quizId=${ID}`],
    [`  ${ID.toUpperCase()}  `],
  ])("finds the quiz id in %s", (link) => {
    expect(parseQuizLink(link)).toBe(ID)
  })

  it("rejects text without a quiz id", () => {
    expect(parseQuizLink("https://kahoot.it/")).toBeNull()
    expect(parseQuizLink("")).toBeNull()
  })
})

describe("loadQuiz", () => {
  it("loads the title and every question", async () => {
    const questions = [{ type: "quiz", question: "Hauptstadt?" }, { type: "content" }]
    const fetchFn = answering(200, { title: "World <b>Geography</b>", questions })
    expect(await loadQuiz(ID, fetchFn)).toEqual({ id: ID, title: "World Geography", questions })
    expect(fetchFn.mock.calls[0]![0]).toBe(QUIZ_API + ID)
  })

  it("keeps question positions when an entry is not an object", async () => {
    const quiz = await loadQuiz(
      ID,
      answering(200, { title: "t", questions: [null, { type: "quiz" }] }),
    )
    expect(quiz.questions).toEqual([{}, { type: "quiz" }])
  })

  it.each([
    [404, "not_found"],
    [400, "not_found"],
    [403, "private"],
    [401, "private"],
    [500, "unknown"],
  ])("reports HTTP %i as %s", async (status, code) => {
    expect(await problem(loadQuiz(ID, answering(status, { error: "x" })))).toBe(code)
  })

  it("reports a network failure as offline", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed")
    })
    expect(await problem(loadQuiz(ID, fetchFn))).toBe("offline")
  })

  it("rejects answers that are not a quiz", async () => {
    expect(await problem(loadQuiz(ID, answering(200, "<html>")))).toBe("unknown")
    expect(await problem(loadQuiz(ID, answering(200, { title: "t" })))).toBe("unknown")
  })
})
