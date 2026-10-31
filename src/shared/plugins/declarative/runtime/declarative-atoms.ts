/** Observable state for declarative panels: reads during a render subscribe that render. */

const ATOM = Symbol.for('orca.declarative.atom')

export type OrcaAtom<T> = {
  readonly [ATOM]: { value: T; listeners: Set<() => void> }
}

type Tracker = (atom: OrcaAtom<unknown>) => void
let activeTracker: Tracker | null = null

export function atom<T>(initial: T): OrcaAtom<T> {
  return Object.freeze({ [ATOM]: { value: initial, listeners: new Set<() => void>() } })
}

function state<T>(target: OrcaAtom<T>): OrcaAtom<T>[typeof ATOM] {
  const inner = typeof target === 'object' && target !== null ? target[ATOM] : undefined
  if (!inner) {
    throw new TypeError('expected an atom created by atom()')
  }
  return inner
}

export function read<T>(target: OrcaAtom<T>): T {
  const inner = state(target)
  activeTracker?.(target)
  return inner.value
}

function isUpdater<T>(next: T | ((previous: T) => T)): next is (previous: T) => T {
  return typeof next === 'function'
}

/** Functions are treated as updaters, so an atom cannot store a function directly. */
export function update<T>(target: OrcaAtom<T>, next: T | ((previous: T) => T)): void {
  if (activeTracker) {
    // Why: an update while rendering would schedule another render, forever.
    throw new Error('update() was called while rendering; call it from an event handler instead')
  }
  const inner = state(target)
  const value = isUpdater(next) ? next(inner.value) : next
  if (Object.is(value, inner.value)) {
    return
  }
  inner.value = value
  for (const listener of inner.listeners) {
    listener()
  }
}

export function subscribeAtom(target: OrcaAtom<unknown>, listener: () => void): () => void {
  const inner = state(target)
  inner.listeners.add(listener)
  return () => inner.listeners.delete(listener)
}

/** Runs `render`, adding every atom it reads to `reads` (even when it throws). */
export function trackAtomReads<R>(reads: Set<OrcaAtom<unknown>>, render: () => R): R {
  const previous = activeTracker
  activeTracker = (target) => reads.add(target)
  try {
    return render()
  } finally {
    activeTracker = previous
  }
}
