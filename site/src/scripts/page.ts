import { assetUrl, detectPlatform, latestVersion, type Asset } from "../lib/download"

const PRIMARY: Record<"mac" | "windows" | "linux", { asset: Asset; label: string }> = {
  mac: { asset: "macArm", label: "Download for macOS" },
  windows: { asset: "windows", label: "Download for Windows" },
  linux: { asset: "linux", label: "Download for Linux" },
}

function downloads(): void {
  const platform = detectPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)
  if (platform === "other") return
  const { asset, label } = PRIMARY[platform]
  for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-primary]")) {
    link.href = assetUrl(asset)
    const text = link.querySelector("[data-label]")
    if (text) text.textContent = label
  }
  document.querySelector(`[data-card="${platform}"]`)?.setAttribute("data-current", "")
}

async function version(): Promise<void> {
  const latest = await latestVersion(fetch)
  if (!latest) return
  for (const el of document.querySelectorAll("[data-version]")) el.textContent = `v${latest}`
}

function reveal(): void {
  const seen = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add("is-visible")
        seen.unobserve(entry.target)
      }
    },
    { rootMargin: "0px 0px -8% 0px" },
  )
  for (const el of document.querySelectorAll("[data-reveal]")) seen.observe(el)
}

function spotlight(): void {
  for (const card of document.querySelectorAll<HTMLElement>(".spot")) {
    card.addEventListener("pointermove", (event) => {
      const box = card.getBoundingClientRect()
      card.style.setProperty("--x", `${event.clientX - box.left}px`)
      card.style.setProperty("--y", `${event.clientY - box.top}px`)
    })
  }
}

downloads()
reveal()
spotlight()
void version()
