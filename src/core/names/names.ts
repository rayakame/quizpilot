export const MAX_NAME_LENGTH = 15

// prettier-ignore
export const ADJECTIVES = [
  "Bold", "Brave", "Calm", "Clever", "Cosmic", "Fuzzy", "Gentle", "Golden", "Happy", "Jolly",
  "Lucky", "Merry", "Mighty", "Quick", "Rapid", "Silent", "Snowy", "Sunny", "Swift", "Witty",
]
// prettier-ignore
export const ANIMALS = [
  "Alpaca", "Badger", "Beaver", "Bison", "Dingo", "Falcon", "Ferret", "Gecko", "Heron", "Koala",
  "Lynx", "Marten", "Moose", "Otter", "Panda", "Puffin", "Raven", "Tapir", "Turtle", "Walrus",
]

export function generateName(taken: string[], random: () => number = Math.random): string {
  const used = new Set(taken.map((n) => n.toLowerCase()))
  for (let attempt = 0; attempt < 20; attempt++) {
    const name = pick(ADJECTIVES, random) + pick(ANIMALS, random)
    if (!used.has(name.toLowerCase())) return name
  }
  return suggestName(pick(ADJECTIVES, random) + pick(ANIMALS, random), taken)
}

export function suggestName(name: string, taken: string[]): string {
  const used = new Set(taken.map((n) => n.toLowerCase()))
  const base = name.trim().replace(/\d+$/, "")
  for (let n = 2; ; n++) {
    const suffix = String(n)
    const candidate = base.slice(0, MAX_NAME_LENGTH - suffix.length) + suffix
    if (!used.has(candidate.toLowerCase())) return candidate
  }
}

function pick(items: string[], random: () => number): string {
  return items[Math.floor(random() * items.length) % items.length]!
}
