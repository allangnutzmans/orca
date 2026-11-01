import { PLUGIN_DECLARATIVE_MESSAGES } from '../plugin-declarative-message-names'
import {
  atom,
  read,
  subscribeAtom,
  trackAtomReads,
  update,
  type OrcaAtom
} from './declarative-atoms'
import type { OrcaComponent } from './declarative-elements'
import { evaluateOrcaTree, type OrcaCallback } from './declarative-evaluate'

export type { OrcaWireNode } from './declarative-evaluate'
export type OrcaDisposable = { dispose(): void }
/** The guest's `window.orca` (frame preload), or a fake in tests. */
export type OrcaBridge = {
  host?: { call(method: string, params?: unknown, options?: unknown): Promise<unknown> }
  on?(event: string, handler: (payload: unknown) => void): OrcaDisposable
}
export type OrcaColorScheme = 'light' | 'dark'
export type OrcaTheme = { colorScheme: OrcaColorScheme }
type PostedEvent = (typeof PLUGIN_DECLARATIVE_MESSAGES)['render' | 'error']

export type OrcaRuntimeOptions = {
  /** Sends one guest → host `evt`; the frame transport wraps it in the protocol envelope. */
  post(event: PostedEvent, payload: unknown): void
  bridge?: OrcaBridge | null
  /** Overrides render scheduling (tests); by default renders are throttled per frame. */
  schedule?: (flush: () => void, delayMs: number) => void
  now?: () => number
  colorScheme?: OrcaColorScheme
}

export type OrcaDeclarativeRuntime = {
  mount(component: OrcaComponent): void
  unmount(): void
  mounted(): boolean
  /** Handles a host `ui.event`; false when its callback no longer resolves. */
  dispatchEvent(payload: unknown): boolean
  /** Handles a host `ui.ack`. */
  acknowledge(payload: unknown): void
  /** Renders now if an update is pending. */
  flush(): void
  theme(): OrcaTheme
  host: { call(method: string, params?: unknown, options?: unknown): Promise<unknown> }
  on(event: string, handler: (payload: unknown) => void): OrcaDisposable
  dispose(): void
}

// Why: an update loop must not flood the host; ~one render per display frame is plenty.
const MIN_RENDER_INTERVAL_MS = 16
// Renders the host has not acknowledged yet whose callbacks stay resolvable.
const MAX_RETAINED_RENDERS = 32

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 4096)
}

/** The host messages' fields, still unvalidated; each reader checks the ones it uses. */
type HostMessageFields = {
  revision?: unknown
  callback?: unknown
  args?: unknown
  accepted?: unknown
  retryAfterMs?: unknown
  colorScheme?: unknown
}

function readHostMessage(payload: unknown): HostMessageFields {
  if (typeof payload !== 'object' || payload === null) {
    return {}
  }
  return {
    revision: 'revision' in payload ? payload.revision : undefined,
    callback: 'callback' in payload ? payload.callback : undefined,
    args: 'args' in payload ? payload.args : undefined,
    accepted: 'accepted' in payload ? payload.accepted : undefined,
    retryAfterMs: 'retryAfterMs' in payload ? payload.retryAfterMs : undefined,
    colorScheme: 'colorScheme' in payload ? payload.colorScheme : undefined
  }
}

function defaultSchedule(flush: () => void, delayMs: number): void {
  if (delayMs > 0) {
    setTimeout(flush, delayMs)
  } else {
    queueMicrotask(flush)
  }
}

export function createOrcaDeclarativeRuntime(options: OrcaRuntimeOptions): OrcaDeclarativeRuntime {
  const { post, bridge } = options
  const schedule = options.schedule ?? defaultSchedule
  const now = options.now ?? (() => Date.now())
  const themeAtom = atom<OrcaTheme>({ colorScheme: options.colorScheme ?? 'dark' })
  let component: OrcaComponent | null = null
  let revision = 0
  let lastRenderAt = Number.NEGATIVE_INFINITY
  /** Callback tables by revision: the last one the host accepted plus every newer one. */
  let renders = new Map<number, Map<string, OrcaCallback>>()
  let accepted: number | null = null
  let subscriptions = new Map<OrcaAtom<unknown>, () => void>()
  let scheduled = false

  function invalidate(delayMs = 0): void {
    if (scheduled || !component) {
      return
    }
    scheduled = true
    const wait = Math.max(delayMs, lastRenderAt + MIN_RENDER_INTERVAL_MS - now())
    schedule(() => {
      if (scheduled) {
        render()
      }
    }, wait)
  }

  function resubscribe(reads: Set<OrcaAtom<unknown>>): void {
    const next = new Map<OrcaAtom<unknown>, () => void>()
    for (const target of reads) {
      next.set(target, subscriptions.get(target) ?? subscribeAtom(target, () => invalidate()))
    }
    for (const [target, unsubscribe] of subscriptions) {
      if (!next.has(target)) {
        unsubscribe()
      }
    }
    subscriptions = next
  }

  function report(error: unknown): void {
    post(PLUGIN_DECLARATIVE_MESSAGES.error, { revision, message: errorMessage(error) })
  }

  function retain(at: number, callbacks: Map<string, OrcaCallback>): void {
    renders.set(at, callbacks)
    for (const kept of renders.keys()) {
      if (renders.size <= MAX_RETAINED_RENDERS) {
        break
      }
      if (kept !== accepted) {
        renders.delete(kept)
      }
    }
  }

  function render(): void {
    scheduled = false
    if (!component) {
      return
    }
    lastRenderAt = now()
    const reads = new Set<OrcaAtom<unknown>>()
    const mounted = component
    let evaluation
    try {
      evaluation = trackAtomReads(reads, () => evaluateOrcaTree(mounted))
    } catch (error) {
      // Nothing is committed. Keep old subscriptions too, so a fix to either state re-renders.
      resubscribe(new Set([...subscriptions.keys(), ...reads]))
      report(error)
      return
    }
    revision += 1
    retain(revision, evaluation.callbacks)
    resubscribe(reads)
    post(PLUGIN_DECLARATIVE_MESSAGES.render, { revision, tree: evaluation.tree })
  }

  function dispatchEvent(payload: unknown): boolean {
    const { revision: eventRevision, callback: callbackId, args } = readHostMessage(payload)
    if (typeof callbackId !== 'string') {
      return false
    }
    // Ids are stable per control, so the newest render's handler is the freshest closure; the
    // render the person actually saw is the fallback when the control has since gone.
    const handler =
      renders.get(revision)?.get(callbackId) ??
      (typeof eventRevision === 'number' ? renders.get(eventRevision)?.get(callbackId) : undefined)
    if (!handler) {
      return false
    }
    try {
      const result = handler(...(Array.isArray(args) ? args : []))
      if (result instanceof Promise) {
        result.catch(report)
      }
    } catch (error) {
      report(error)
    }
    return true
  }

  function acknowledge(payload: unknown): void {
    const message = readHostMessage(payload)
    const acked = message.revision
    if (typeof acked !== 'number' || !renders.has(acked)) {
      return
    }
    if (message.accepted === true) {
      accepted = acked
      for (const kept of renders.keys()) {
        if (kept < acked) {
          renders.delete(kept)
        }
      }
      return
    }
    // A refused render never reached the screen; events keep resolving against the accepted one.
    renders.delete(acked)
    const retryAfterMs = message.retryAfterMs
    if (typeof retryAfterMs === 'number' && acked === revision) {
      invalidate(retryAfterMs)
    }
  }

  const bridgeSubscriptions: OrcaDisposable[] = bridge?.on
    ? [
        bridge.on(PLUGIN_DECLARATIVE_MESSAGES.event, dispatchEvent),
        bridge.on(PLUGIN_DECLARATIVE_MESSAGES.ack, acknowledge),
        bridge.on('theme', (payload) => {
          const { colorScheme } = readHostMessage(payload)
          if (colorScheme === 'light' || colorScheme === 'dark') {
            const next: OrcaTheme = { colorScheme }
            update(themeAtom, (previous) =>
              previous.colorScheme === next.colorScheme ? previous : next
            )
          }
        })
      ]
    : []

  function unsubscribeAll(): void {
    for (const unsubscribe of subscriptions.values()) {
      unsubscribe()
    }
    subscriptions = new Map()
  }

  return {
    mount(next) {
      component = next
      render()
    },
    unmount() {
      component = null
      scheduled = false
      unsubscribeAll()
      renders = new Map()
      accepted = null
      revision += 1
      post(PLUGIN_DECLARATIVE_MESSAGES.render, { revision, tree: null })
    },
    mounted: () => component !== null,
    dispatchEvent,
    acknowledge,
    flush() {
      if (scheduled) {
        render()
      }
    },
    theme: () => read(themeAtom),
    host: {
      call(method, params, callOptions) {
        const bridgeHost = bridge?.host
        return bridgeHost
          ? bridgeHost.call(method, params, callOptions)
          : Promise.reject(new Error('the Orca host bridge is unavailable'))
      }
    },
    on(event, handler) {
      return bridge?.on ? bridge.on(event, handler) : { dispose() {} }
    },
    dispose() {
      component = null
      scheduled = false
      unsubscribeAll()
      for (const subscription of bridgeSubscriptions) {
        subscription.dispose()
      }
    }
  }
}
