/** Why written out: the sandboxed preload can't import shared chunks. Generous enough for a 64 MiB
 *  save plus a burst of messages; the host still enforces its own per-lane budgets. */
export const PRELOAD_PLUGIN_FRAME_SEND_LIMITS = {
  maxMessageBytes: 80 * 1024 * 1024,
  maxMessages: 600,
  maxBytes: 192 * 1024 * 1024,
  perMs: 10_000
}

const MAX_WALK_NODES = 50_000
const MAX_WALK_DEPTH = 128

/** Upper-bound bytes of a cloneable message; Infinity when it is too large or deep to walk. */
export function estimatePluginFrameMessageBytes(message: unknown): number {
  let total = 0
  let nodes = 0
  const stack: { value: unknown; depth: number }[] = [{ value: message, depth: 0 }]
  for (let item = stack.pop(); item; item = stack.pop()) {
    const { value, depth } = item
    if (++nodes > MAX_WALK_NODES || depth > MAX_WALK_DEPTH) {
      return Number.POSITIVE_INFINITY
    }
    if (typeof value === 'string') {
      total += value.length * 3
    } else if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      total += value.byteLength
    } else if (Array.isArray(value)) {
      total += 8
      for (const entry of value) {
        stack.push({ value: entry, depth: depth + 1 })
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const [key, entry] of Object.entries(value)) {
        total += key.length * 3
        stack.push({ value: entry, depth: depth + 1 })
      }
    } else {
      total += 8
    }
  }
  return total
}

/** A per-guest send budget, held in the isolated world so page script cannot reset it. */
export function createPluginFrameSendBudget(
  now: () => number = () => Date.now(),
  limits = PRELOAD_PLUGIN_FRAME_SEND_LIMITS
): (message: unknown) => boolean {
  const sent: { at: number; bytes: number }[] = []
  let windowBytes = 0
  return (message) => {
    const at = now()
    for (let oldest = sent[0]; oldest && oldest.at <= at - limits.perMs; oldest = sent[0]) {
      sent.shift()
      windowBytes -= oldest.bytes
    }
    const bytes = estimatePluginFrameMessageBytes(message)
    if (
      bytes > limits.maxMessageBytes ||
      sent.length >= limits.maxMessages ||
      windowBytes + bytes > limits.maxBytes
    ) {
      return false
    }
    sent.push({ at, bytes })
    windowBytes += bytes
    return true
  }
}
