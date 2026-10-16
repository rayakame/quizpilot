import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"

export default defineConfig({
  site: "https://quizpilot.rayakame.dev",
  trailingSlash: "ignore",
  // One page, so a separate stylesheet only costs a round trip before the first paint.
  build: { inlineStylesheets: "always" },
  vite: { plugins: [tailwindcss()] },
})
