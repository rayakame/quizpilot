import type { MenuItemConstructorOptions } from "electron"
import type { Messages } from "../shared/i18n/index.js"

export function menuTemplate(
  isMac: boolean,
  dev: boolean,
  openSettings: () => void,
  text: Messages["menu"],
): MenuItemConstructorOptions[] {
  const settings: MenuItemConstructorOptions = {
    label: text.settings,
    accelerator: "CmdOrCtrl+,",
    click: () => openSettings(),
  }
  // A reload mid-game would hide the running bots from the window.
  const devTools: MenuItemConstructorOptions[] = dev
    ? [
        { role: "reload", label: text.reload },
        { role: "toggleDevTools", label: text.devTools },
        { type: "separator" },
      ]
    : []
  // Electron fills role menus with English items, so they are spelled out.
  const edit: MenuItemConstructorOptions = {
    role: "editMenu",
    label: text.edit,
    submenu: [
      { role: "undo", label: text.undo },
      { role: "redo", label: text.redo },
      { type: "separator" },
      { role: "cut", label: text.cut },
      { role: "copy", label: text.copy },
      { role: "paste", label: text.paste },
      ...(isMac ? [{ role: "pasteAndMatchStyle", label: text.pasteAndMatchStyle } as const] : []),
      { role: "delete", label: text.delete },
      { type: "separator" },
      { role: "selectAll", label: text.selectAll },
    ],
  }
  const window: MenuItemConstructorOptions = {
    role: "windowMenu",
    label: text.window,
    submenu: isMac
      ? [
          { role: "minimize", label: text.minimize },
          { role: "zoom", label: text.zoom },
          { type: "separator" },
          { role: "front", label: text.front },
        ]
      : [
          { role: "minimize", label: text.minimize },
          { role: "close", label: text.close },
        ],
  }
  const common: MenuItemConstructorOptions[] = [
    edit,
    {
      label: text.view,
      submenu: [
        ...devTools,
        { role: "resetZoom", label: text.resetZoom },
        { role: "zoomIn", label: text.zoomIn },
        { role: "zoomOut", label: text.zoomOut },
        { type: "separator" },
        { role: "togglefullscreen", label: text.fullScreen },
      ],
    },
    window,
  ]
  if (!isMac) {
    return [
      {
        label: text.file,
        submenu: [settings, { type: "separator" }, { role: "quit", label: text.quit }],
      },
      ...common,
    ]
  }
  return [
    {
      label: "QuizPilot",
      submenu: [
        { role: "about", label: text.about },
        { type: "separator" },
        settings,
        { type: "separator" },
        { role: "services", label: text.services },
        { type: "separator" },
        { role: "hide", label: text.hide },
        { role: "hideOthers", label: text.hideOthers },
        { role: "unhide", label: text.showAll },
        { type: "separator" },
        { role: "quit", label: text.quit },
      ],
    },
    ...common,
  ]
}
