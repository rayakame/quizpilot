import sharp from "sharp"
import type { ImageRef } from "../types.js"

const MAX_SIDE = 1568
// TypeSafe's docs allow 256 px per side, but the API rejects anything below 280.
const MIN_SIDE = 280

export async function normalizeImage(bytes: Uint8Array): Promise<Uint8Array> {
  const input = Buffer.from(bytes)
  const { width, height } = await sharp(input).metadata()
  if (!width || !height) throw new Error("not an image")
  const longest = Math.max(width, height)
  const shortest = Math.min(width, height)
  let scale = Math.min(1, MAX_SIDE / longest)
  if (shortest * scale < MIN_SIDE) scale = Math.min(MIN_SIDE / shortest, MAX_SIDE / longest)
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)
  const padX = Math.max(0, MIN_SIDE - w)
  const padY = Math.max(0, MIN_SIDE - h)
  const out = await sharp(input)
    .resize(w, h)
    .extend({
      left: Math.floor(padX / 2),
      right: Math.ceil(padX / 2),
      top: Math.floor(padY / 2),
      bottom: Math.ceil(padY / 2),
      background: "#ffffff",
    })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 85 })
    .toBuffer()
  return new Uint8Array(out)
}

export function createImageLoader(fetchImpl: (url: string) => Promise<Response> = fetch) {
  return async (ref: ImageRef): Promise<Uint8Array | null> => {
    try {
      const res = await fetchImpl(ref.url)
      if (!res.ok) return null
      return await normalizeImage(new Uint8Array(await res.arrayBuffer()))
    } catch {
      return null
    }
  }
}
