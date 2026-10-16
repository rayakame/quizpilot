import type { MenuItemConstructorOptions } from "electron"

export function menuTemplate(
  isMac: boolean,
  dev: boolean,
  openSettings: () => void,
): MenuItemConstructorOptions[] {
  const settings: MenuItemConstructorOptions = {
    label: "Settings…",
    accelerator: "CmdOrCtrl+,",
    click: () => openSettings(),
  }
  // A reload mid-game would hide the running bots from the window.
  const devTools: MenuItemConstructorOptions[] = dev
    ? [{ role: "reload" }, { role: "toggleDevTools" }, { type: "separator" }]
    : []
  const common: MenuItemConstructorOptions[] = [
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        ...devTools,
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
  ]
  if (!isMac) {
    return [
      { label: "File", submenu: [settings, { type: "separator" }, { role: "quit" }] },
      ...common,
    ]
  }
  return [
    {
      label: "QuizPilot",
      submenu: [
        { role: "about" },
        { type: "separator" },
        settings,
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    ...common,
  ]
}
