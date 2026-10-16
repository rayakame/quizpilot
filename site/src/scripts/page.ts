import { assetUrl, detectPlatform, latestVersion, primaryDownload } from "../lib/download"

function downloads(): void {
  const platform = detectPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)
  const main = primaryDownload(platform)
  if (!main) return
  for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-primary]")) {
    link.href = assetUrl(main.asset)
    const text = link.querySelector("[data-label]")
    if (text) text.textContent = main.label
  }
  for (const note of document.querySelectorAll<HTMLElement>("[data-note]")) {
    if (!main.note) continue
    note.textContent = main.alternative ? `${main.note} ·` : main.note
    note.hidden = false
  }
  for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-alternative]")) {
    if (!main.alternative) continue
    link.href = assetUrl(main.alternative.asset)
    link.textContent = main.alternative.label
    link.hidden = false
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
