export interface RawMessage {
  channel?: string
  data?: { id?: number; type?: string; content?: unknown; [key: string]: unknown }
  [key: string]: unknown
}
