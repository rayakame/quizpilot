import { contextBridge } from "electron"

contextBridge.exposeInMainWorld("quizpilot", {})
