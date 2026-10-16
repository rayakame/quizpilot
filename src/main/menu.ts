import type { MenuItemConstructorOptions } from "electron"

export function menuTemplate(
  isMac: boolean,
  openSettings: () => void,
): MenuItemConstructorOptions[] {
  const settings: MenuItemConstructorOptions = {
    label: "Settings…",
    accelerator: "CmdOrCtrl+,",
    click: () => openSettings(),
  }
  const common: MenuItemConstructorOptions[] = [
    { role: "editMenu" },
    { role: "viewMenu" },
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
