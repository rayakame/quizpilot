import { mkdtemp, readFile, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { Logger, MAX_LINE, redact, type LoggerOptions } from "../../src/main/log.js"

async function logger(over: Partial<LoggerOptions> = {}) {
  const dir = await mkdtemp(join(tmpdir(), "qp-log-"))
  const file = join(dir, "logs", "main.log")
  const log = new Logger({ file, secrets: () => [], now: () => new Date(0), ...over })
  return { log, file, old: join(dir, "logs", "main.old.log") }
}

describe("redact", () => {
  it("hides saved keys and anything shaped like a key", () => {
    const text =
      "bad key ts-live-1234567890 and sk-ant-api03-abcdefgh and AIzaSyA1234567890abcdefghijk"
    expect(redact(text, ["ts-live-1234567890"])).toBe("bad key [key] and [key] and [key]")
  })

  it("leaves short or empty secrets alone", () => {
    expect(redact("a b c", ["", "a"])).toBe("a b c")
  })
})

describe("Logger", () => {
  it("writes lines with time and level", async () => {
    const { log, file } = await logger()
    log.info("Started")
    log.error("Backup AI failed", new Error("boom"))
    await log.flush()
    const text = await readFile(file, "utf8")
    expect(text).toContain("1970-01-01T00:00:00.000Z INFO Started\n")
    expect(text).toContain("ERROR Backup AI failed: Error: boom")
  })

  it("never writes a key, even inside an error", async () => {
    const { log, file } = await logger({ secrets: () => ["ts-live-1234567890"] })
    log.warn("Jev failed", new Error("Incorrect API key provided: ts-live-1234567890"))
    await log.flush()
    expect(await readFile(file, "utf8")).not.toContain("ts-live-1234567890")
  })

  it("cuts huge details", async () => {
    const { log, file } = await logger()
    log.warn("Unknown question", { raw: "x".repeat(100_000) })
    await log.flush()
    expect((await readFile(file, "utf8")).length).toBeLessThan(MAX_LINE + 200)
  })

  it("starts a new file when the log gets big and keeps one old file", async () => {
    const { log, file, old } = await logger({ maxBytes: 300 })
    for (let i = 0; i < 20; i++) log.info(`line ${i} ${"y".repeat(40)}`)
    await log.flush()
    expect((await stat(file)).size).toBeLessThanOrEqual(300)
    expect((await stat(old)).size).toBeLessThanOrEqual(300)
    const all = await log.read()
    expect(all).toContain("line 19")
    expect(all).not.toContain("line 0 ")
  })

  it("keeps working when the folder can't be written", async () => {
    const log = new Logger({ file: "/dev/null/nope/main.log", secrets: () => [] })
    log.info("lost")
    await expect(log.flush()).resolves.toBeUndefined()
  })
})
