declare module "kahoot.js-latest" {
  export default class Client {
    handlers: Record<string, (message: unknown) => void>
    clientId: string
    _send(message: unknown): Promise<unknown>
    on(event: string, listener: (...args: never[]) => void): this
    emit(event: string, ...args: unknown[]): boolean
    join(pin: string | number, name?: string, team?: string[] | false): Promise<unknown>
    answerTwoFactorAuth(steps: number[]): Promise<unknown>
    leave(): Promise<unknown>
  }
}
