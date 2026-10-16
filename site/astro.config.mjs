import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"

export default defineConfig({
  site: "https://quizpilot.rayakame.dev",
  trailingSlash: "ignore",
  vite: { plugins: [tailwindcss()] },
})
