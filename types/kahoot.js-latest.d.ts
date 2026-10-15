declare module "kahoot.js-latest" {
  export default class Client {
    handlers: Record<string, (message: unknown) => void>
    clientId: string
    quiz?: { currentQuestion?: Record<string, unknown> }
    _send(message: unknown): Promise<unknown>
    _message(frame: string): void
    on(event: string, listener: (...args: never[]) => void): this
    emit(event: string, ...args: unknown[]): boolean
    join(pin: string | number, name?: string, team?: string[] | false): Promise<unknown>
    answer(choice: number | number[] | string): Promise<unknown>
    answerTwoFactorAuth(steps: number[]): Promise<unknown>
    reconnect(cid?: string): Promise<unknown>
    leave(): Promise<unknown>
  }
}
