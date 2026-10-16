import { readFile } from "node:fs/promises"
import sharp from "sharp"

const svg = await readFile("resources/icon.svg")
await sharp(svg, { density: 300 }).resize(1024, 1024).png().toFile("resources/icon.png")
console.log("wrote resources/icon.png")
