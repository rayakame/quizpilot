/** A path inside the site, with the GitHub Pages base in front. */
export function url(path = ""): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "")
  return `${base}/${path.replace(/^\//, "")}`
}
