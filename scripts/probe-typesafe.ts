import { readFileSync } from "node:fs"
import { choice, image, noul, TypeSafeClient } from "@typesafe-ai/sdk"

const client = new TypeSafeClient()
const imagePath = process.argv[2]

async function timed(label: string, run: () => PromiseLike<unknown>) {
  const start = performance.now()
  try {
    const result = await run()
    console.log(`\n${label}: ${Math.round(performance.now() - start)} ms`)
    console.dir(result, { depth: 6 })
  } catch (err) {
    console.log(`\n${label}: failed after ${Math.round(performance.now() - start)} ms`)
    console.log(err)
  }
}

await timed("text", () =>
  client.systemOne({
    state: { question: "Hauptstadt der Schweiz", options: ["Zürich", "Bern", "Genf", "Basel"] },
    questions: {
      answer: choice("Which option correctly answers the quiz question in `question`?", {
        "0": "Zürich",
        "1": "Bern",
        "2": "Genf",
        "3": "Basel",
      }),
    },
  }),
)

if (imagePath) {
  const request = {
    state: { image: image(readFileSync(imagePath)) },
    questions: {
      text: noul("Does `image` contain readable text?"),
      kind: choice("What is `image`?", { photo: null, diagram: null, text: null, drawing: null }),
    },
  }
  await timed("image without header", () => client.systemOne(request))
  await timed("image with header", () =>
    client.systemOne(request, { headers: { "TypeSafe-Danger-Zone-Images": "true" } }),
  )
}
