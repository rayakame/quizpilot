import { contextBridge, ipcRenderer } from "electron"
import {
  CHANNELS,
  GAME_EVENT_CHANNEL,
  OPEN_SETTINGS_CHANNEL,
  type GameEvent,
  type QuizPilotApi,
} from "../shared/api.js"

const api: QuizPilotApi = {
  getSettings: () => ipcRenderer.invoke(CHANNELS.getSettings),
  saveSettings: (patch) => ipcRenderer.invoke(CHANNELS.saveSettings, patch),
  getAppInfo: () => ipcRenderer.invoke(CHANNELS.getAppInfo),
  saveTypesafeKey: (key) => ipcRenderer.invoke(CHANNELS.saveTypesafeKey, key),
  saveFallback: (setup) => ipcRenderer.invoke(CHANNELS.saveFallback, setup),
  removeFallback: () => ipcRenderer.invoke(CHANNELS.removeFallback),
  startGame: (request) => ipcRenderer.invoke(CHANNELS.startGame, request),
  addBot: (name) => ipcRenderer.invoke(CHANNELS.addBot, name),
  submitTwoStep: (sequence) => ipcRenderer.invoke(CHANNELS.submitTwoStep, sequence),
  pause: (bot, paused) => ipcRenderer.invoke(CHANNELS.pause, bot, paused),
  leave: (bot) => ipcRenderer.invoke(CHANNELS.leave, bot),
  endGame: () => ipcRenderer.invoke(CHANNELS.endGame),
  openExternal: (url) => ipcRenderer.invoke(CHANNELS.openExternal, url),
  onGameEvent: (listener) => {
    const handler = (_event: unknown, payload: GameEvent) => listener(payload)
    ipcRenderer.on(GAME_EVENT_CHANNEL, handler)
    return () => ipcRenderer.off(GAME_EVENT_CHANNEL, handler)
  },
  onOpenSettings: (listener) => {
    const handler = () => listener()
    ipcRenderer.on(OPEN_SETTINGS_CHANNEL, handler)
    return () => ipcRenderer.off(OPEN_SETTINGS_CHANNEL, handler)
  },
}

contextBridge.exposeInMainWorld("quizpilot", api)
