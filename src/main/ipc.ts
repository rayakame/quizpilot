import { CHANNELS, type Invokable, type QuizPilotApi } from "../shared/api.js"

export type Handlers = Pick<QuizPilotApi, Invokable>

export interface IpcLike {
  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void
}

export function registerIpc(ipc: IpcLike, handlers: Handlers): void {
  for (const name of Object.keys(CHANNELS) as Invokable[]) {
    const handler = handlers[name] as (...args: unknown[]) => unknown
    ipc.handle(CHANNELS[name], (_event, ...args) => handler(...args))
  }
}
