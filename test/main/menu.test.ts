import type { MenuItemConstructorOptions } from "electron"
import { describe, expect, it, vi } from "vitest"
import { menuTemplate } from "../../src/main/menu.js"

function flatten(items: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  return items.flatMap((item) => [
    item,
    ...(Array.isArray(item.submenu) ? flatten(item.submenu) : []),
  ])
}

describe("menuTemplate", () => {
  it.each([true, false])("opens the settings with Cmd/Ctrl+, (mac: %s)", (isMac) => {
    const openSettings = vi.fn()
    const items = flatten(menuTemplate(isMac, openSettings))
    const settings = items.find((i) => i.accelerator === "CmdOrCtrl+,")
    expect(settings?.label).toBe("Settings…")
    ;(settings?.click as () => void)()
    expect(openSettings).toHaveBeenCalledTimes(1)
  })

  it.each([true, false])("keeps copy and paste working (mac: %s)", (isMac) => {
    expect(menuTemplate(isMac, () => {}).some((i) => i.role === "editMenu")).toBe(true)
  })
})
