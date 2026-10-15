import { resolve } from "node:path"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "electron-vite"

export default defineConfig({
  main: {},
  preload: {
    build: { rollupOptions: { output: { format: "cjs", entryFileNames: "[name].cjs" } } },
  },
  renderer: {
    resolve: { alias: { $lib: resolve("src/renderer/src/lib") } },
    plugins: [svelte(), tailwindcss()],
  },
})
