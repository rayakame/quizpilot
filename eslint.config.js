import js from "@eslint/js"
import { defineConfig } from "eslint/config"
import tseslint from "typescript-eslint"

export default defineConfig(
  { ignores: ["node_modules", "out", "dist", "test/fixtures"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["electron", "electron/*"], message: "src/core must not depend on Electron" }] },
      ],
    },
  },
)
