import js from "@eslint/js"
import svelte from "eslint-plugin-svelte"
import { defineConfig } from "eslint/config"
import globals from "globals"
import tseslint from "typescript-eslint"
import svelteConfig from "./svelte.config.js"

export default defineConfig(
  {
    ignores: [
      "node_modules",
      "out",
      "dist",
      "test/fixtures",
      "src/renderer/src/lib/components/ui",
      "site/dist",
      "site/.astro",
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  svelte.configs.recommended,
  {
    files: ["src/renderer/**/*.{ts,svelte}"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["site/scripts/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts"],
    languageOptions: { parserOptions: { parser: tseslint.parser, svelteConfig } },
  },
  {
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["electron", "electron/*"], message: "src/core must not depend on Electron" },
          ],
        },
      ],
    },
  },
)
