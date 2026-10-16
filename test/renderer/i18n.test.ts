import { afterEach, describe, expect, it } from "vitest"
import { currentLanguage, setLanguage, t } from "../../src/renderer/src/lib/i18n.js"

afterEach(() => setLanguage("en"))

describe("t", () => {
  it("follows the chosen language", () => {
    expect(t.menu.settings).toBe("Settings…")
    setLanguage("de")
    expect(t.menu.settings).toBe("Einstellungen…")
    expect(currentLanguage()).toBe("de")
  })
})
