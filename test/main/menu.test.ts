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
    const items = flatten(menuTemplate(isMac, false, openSettings))
    const settings = items.find((i) => i.accelerator === "CmdOrCtrl+,")
    expect(settings?.label).toBe("Settings…")
    ;(settings?.click as () => void)()
    expect(openSettings).toHaveBeenCalledTimes(1)
  })

  it.each([true, false])("keeps copy and paste working (mac: %s)", (isMac) => {
    expect(menuTemplate(isMac, false, () => {}).some((i) => i.role === "editMenu")).toBe(true)
  })

  it.each([true, false])("only offers reload and dev tools while developing (mac: %s)", (isMac) => {
    const roles = (dev: boolean) => flatten(menuTemplate(isMac, dev, () => {})).map((i) => i.role)
    expect(roles(false)).not.toContain("reload")
    expect(roles(false)).not.toContain("forceReload")
    expect(roles(false)).not.toContain("toggleDevTools")
    expect(roles(false)).not.toContain("viewMenu")
    expect(roles(false)).toContain("togglefullscreen")
    expect(roles(true)).toContain("reload")
    expect(roles(true)).toContain("toggleDevTools")
  })
})
