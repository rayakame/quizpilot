import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"

export default defineConfig({
  site: "https://rayakame.github.io",
  base: "/quizpilot",
  trailingSlash: "ignore",
  vite: { plugins: [tailwindcss()] },
})
