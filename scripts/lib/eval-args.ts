export interface EvalArgs {
  gameId: number | null
  previous: boolean
  data: string | null
}

const USAGE = "usage: pnpm eval:history [game-id] [--no-previous] [--data <folder>]"

export function parseEvalArgs(argv: string[]): EvalArgs | { error: string } {
  const args: EvalArgs = { gameId: null, previous: true, data: null }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === "--no-previous") args.previous = false
    else if (arg === "--data") {
      const value = argv[++i]
      if (!value) return { error: USAGE }
      args.data = value
    } else if (/^\d+$/.test(arg) && args.gameId === null) args.gameId = Number(arg)
    else return { error: USAGE }
  }
  return args
}

export function dataDir(platform: NodeJS.Platform, env: NodeJS.ProcessEnv, home: string): string {
  if (platform === "darwin") return `${home}/Library/Application Support/QuizPilot`
  if (platform === "win32") return `${env.APPDATA ?? `${home}\\AppData\\Roaming`}/QuizPilot`
  return `${env.XDG_CONFIG_HOME ?? `${home}/.config`}/QuizPilot`
}
