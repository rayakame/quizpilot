import { vi } from "vitest"
import {
  JoinError,
  type AdapterEvents,
  type KahootAdapterLike,
} from "../../src/core/kahoot/adapter.js"
import { Emitter } from "../../src/core/util/emitter.js"

export class FakeAdapter extends Emitter<AdapterEvents> implements KahootAdapterLike {
  join = vi.fn<KahootAdapterLike["join"]>(async (_pin, name) => {
    if (name.startsWith("slow")) await new Promise((resolve) => setTimeout(resolve, 1000))
    if (name.startsWith("bad")) throw new JoinError("duplicate_name", "Name is already taken")
  })
  answer = vi.fn<KahootAdapterLike["answer"]>(async () => {})
  submitTwoStep = vi.fn<KahootAdapterLike["submitTwoStep"]>(async () => {})
  leave = vi.fn<KahootAdapterLike["leave"]>(async () => {})
  reconnect = vi.fn<KahootAdapterLike["reconnect"]>(async () => {})
}
