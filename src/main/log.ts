import { appendFile, mkdir, readFile, rename, stat } from "node:fs/promises"
import { basename, dirname, join } from "node:path"

export type Level = "info" | "warn" | "error"

export interface LoggerOptions {
  file: string
  maxBytes?: number
  secrets(): readonly string[]
  now?(): Date
  echo?(line: string): void
}

export const MAX_LINE = 20_000
const MIN_SECRET = 8
const KEY_SHAPES = /\b(?:sk-ant-[\w-]{8,}|sk-[\w-]{16,}|AIza[\w-]{20,})/g

export function redact(text: string, secrets: readonly string[]): string {
  let out = text
  for (const secret of secrets) {
    if (secret.length >= MIN_SECRET) out = out.split(secret).join("[key]")
  }
  return out.replace(KEY_SHAPES, "[key]")
}

export class Logger {
  private size: number | null = null
  private queue: Promise<void> = Promise.resolve()
  private readonly old: string

  constructor(private readonly options: LoggerOptions) {
    const { file } = options
    this.old = join(dirname(file), `${basename(file, ".log")}.old.log`)
  }

  info(message: string, detail?: unknown): void {
    this.write("info", message, detail)
  }

  warn(message: string, detail?: unknown): void {
    this.write("warn", message, detail)
  }

  error(message: string, detail?: unknown): void {
    this.write("error", message, detail)
  }

  write(level: Level, message: string, detail?: unknown): void {
    let text = detail === undefined ? message : `${message}: ${describe(detail)}`
    if (text.length > MAX_LINE) text = `${text.slice(0, MAX_LINE)} …`
    const time = (this.options.now?.() ?? new Date()).toISOString()
    const line = `${time} ${level.toUpperCase()} ${redact(text, this.options.secrets())}\n`
    this.options.echo?.(line)
    // A log that can't be written must never take the app down with it.
    this.queue = this.queue.then(() => this.append(line)).catch(() => {})
  }

  flush(): Promise<void> {
    return this.queue
  }

  async read(): Promise<string> {
    await this.flush()
    const [old, current] = await Promise.all(
      [this.old, this.options.file].map((f) => readFile(f, "utf8").catch(() => "")),
    )
    return `${old}${current}`
  }

  private async append(line: string): Promise<void> {
    const { file, maxBytes = 1_000_000 } = this.options
    const bytes = Buffer.byteLength(line)
    if (this.size === null) {
      await mkdir(dirname(file), { recursive: true })
      this.size = await stat(file).then(
        (s) => s.size,
        () => 0,
      )
    }
    if (this.size > 0 && this.size + bytes > maxBytes) {
      await rename(file, this.old)
      this.size = 0
    }
    await appendFile(file, line, { mode: 0o600 })
    this.size += bytes
  }
}

function describe(detail: unknown): string {
  if (detail instanceof Error) return detail.stack ?? `${detail.name}: ${detail.message}`
  if (typeof detail === "string") return detail
  try {
    return JSON.stringify(detail) ?? String(detail)
  } catch {
    return String(detail)
  }
}
