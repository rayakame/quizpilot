import sharp from "sharp"
import { describe, expect, it, vi } from "vitest"
import { createImageLoader, normalizeImage } from "../../../src/core/media/image-loader.js"

async function picture(width: number, height: number, png = false) {
  const img = sharp({
    create: {
      width,
      height,
      channels: png ? 4 : 3,
      background: png ? { r: 0, g: 120, b: 255, alpha: 0.5 } : { r: 200, g: 30, b: 30 },
    },
  })
  return new Uint8Array(await (png ? img.png() : img.jpeg()).toBuffer())
}

async function info(bytes: Uint8Array) {
  const m = await sharp(bytes).metadata()
  return { width: m.width, height: m.height, format: m.format }
}

const respond = (body: Uint8Array | string, status = 200) =>
  vi.fn(async () => new Response(typeof body === "string" ? body : body.slice(), { status }))

describe("normalizeImage", () => {
  it("shrinks large images to 1568 px on the long side", async () => {
    expect(await info(await normalizeImage(await picture(2120, 1414)))).toEqual({
      width: 1568,
      height: 1046,
      format: "jpeg",
    })
  })

  it("keeps fitting sizes", async () => {
    expect(await info(await normalizeImage(await picture(436, 458)))).toEqual({
      width: 436,
      height: 458,
      format: "jpeg",
    })
  })

  it("turns transparent PNGs into JPEGs at least 280 px wide, as TypeSafe requires", async () => {
    expect(await info(await normalizeImage(await picture(256, 341, true)))).toEqual({
      width: 280,
      height: 373,
      format: "jpeg",
    })
  })

  it("enlarges tiny images to 280 px on the short side", async () => {
    expect(await info(await normalizeImage(await picture(100, 80)))).toEqual({
      width: 350,
      height: 280,
      format: "jpeg",
    })
  })

  it("pads very wide images instead of breaking a limit", async () => {
    expect(await info(await normalizeImage(await picture(3000, 400)))).toEqual({
      width: 1568,
      height: 280,
      format: "jpeg",
    })
  })
})

describe("createImageLoader", () => {
  it("fetches the URL and returns a normalized JPEG", async () => {
    const fetchImpl = respond(await picture(400, 300))
    const bytes = await createImageLoader(fetchImpl)({ url: "https://media.kahoot.it/abc" })
    expect(fetchImpl).toHaveBeenCalledWith("https://media.kahoot.it/abc")
    expect(bytes && (await info(bytes)).format).toBe("jpeg")
  })

  it("returns null for errors, non-images and network failures", async () => {
    const ref = { url: "https://media.kahoot.it/x" }
    expect(await createImageLoader(respond("nope", 404))(ref)).toBeNull()
    expect(await createImageLoader(respond("not an image"))(ref)).toBeNull()
    const broken = vi.fn(async (): Promise<Response> => {
      throw new Error("offline")
    })
    expect(await createImageLoader(broken)(ref)).toBeNull()
  })
})
