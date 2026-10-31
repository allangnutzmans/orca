import { describe, expect, it, vi } from 'vitest'
import { buildSync } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import {
  PLUGIN_FRAME_IPC_CHANNEL,
  PLUGIN_FRAME_TRANSPORT_GLOBAL
} from '../shared/plugins/frames/plugin-frame-guest'
import {
  PRELOAD_PLUGIN_FRAME_IPC_CHANNEL,
  PRELOAD_PLUGIN_FRAME_TRANSPORT_GLOBAL
} from './plugin-frame-guest-transport'

type Transport = { send: (message: unknown) => void; subscribe: (fn: (m: unknown) => void) => void }

function runPreload(isMainFrame: boolean, isActive: boolean, contentType = 'text/html') {
  const sendToHost = vi.fn()
  const listeners: ((event: unknown, message: unknown) => void)[] = []
  const pageWindow: Record<string, unknown> = {}
  const document = { contentType }
  const preload = buildSync({
    entryPoints: [fileURLToPath(new URL('./plugin-frame-guest.ts', import.meta.url))],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['electron'],
    write: false
  }).outputFiles[0].text
  runInNewContext(preload, {
    window: pageWindow,
    document,
    Object,
    ArrayBuffer,
    Array,
    Date,
    Number,
    navigator: { userActivation: { isActive } },
    process: { isMainFrame },
    require: (name: string) => {
      expect(name).toBe('electron')
      return {
        ipcRenderer: {
          sendToHost,
          on: (channel: string, listener: (event: unknown, message: unknown) => void) => {
            expect(channel).toBe(PLUGIN_FRAME_IPC_CHANNEL)
            listeners.push(listener)
          }
        },
        contextBridge: {
          executeInMainWorld: (script: { func: (...args: unknown[]) => void; args: unknown[] }) =>
            script.func(...script.args)
        }
      }
    }
  })
  return { sendToHost, listeners, pageWindow }
}

describe('plugin frame guest preload', () => {
  it('pins its written-out constants to the shared ones', () => {
    expect(PRELOAD_PLUGIN_FRAME_IPC_CHANNEL).toBe(PLUGIN_FRAME_IPC_CHANNEL)
    expect(PRELOAD_PLUGIN_FRAME_TRANSPORT_GLOBAL).toBe(PLUGIN_FRAME_TRANSPORT_GLOBAL)
  })

  it('hands the shell a deletable transport that stamps activation in the isolated world', () => {
    const { sendToHost, listeners, pageWindow } = runPreload(true, true)
    const descriptor = Object.getOwnPropertyDescriptor(pageWindow, PLUGIN_FRAME_TRANSPORT_GLOBAL)
    expect(descriptor).toMatchObject({ configurable: true, enumerable: false, writable: false })
    const transport: Transport = descriptor?.value
    transport.send({ orca: 1, kind: 'evt', event: 'ready' })
    expect(sendToHost).toHaveBeenCalledWith(
      PLUGIN_FRAME_IPC_CHANNEL,
      { orca: 1, kind: 'evt', event: 'ready' },
      true
    )
    const first = vi.fn()
    const second = vi.fn()
    transport.subscribe(first)
    transport.subscribe(second)
    expect(listeners).toHaveLength(1)
    listeners[0]?.({}, { orca: 1, kind: 'res', id: 0 })
    expect(first).toHaveBeenCalledWith({ orca: 1, kind: 'res', id: 0 })
    expect(second).not.toHaveBeenCalled()
    expect(Reflect.deleteProperty(pageWindow, PLUGIN_FRAME_TRANSPORT_GLOBAL)).toBe(true)
  })

  it('reports no activation when the frame has none', () => {
    const { sendToHost, pageWindow } = runPreload(true, false)
    const transport: Transport = Object.getOwnPropertyDescriptor(
      pageWindow,
      PLUGIN_FRAME_TRANSPORT_GLOBAL
    )?.value
    transport.send({})
    expect(sendToHost).toHaveBeenCalledWith(PLUGIN_FRAME_IPC_CHANNEL, {}, false)
  })

  it('leaves subframes without a channel', () => {
    const { pageWindow } = runPreload(false, true)
    expect(PLUGIN_FRAME_TRANSPORT_GLOBAL in pageWindow).toBe(false)
  })

  it("hands no transport to non-HTML documents, which never get Orca's shell", () => {
    const { pageWindow } = runPreload(true, true, 'image/svg+xml')
    expect(PLUGIN_FRAME_TRANSPORT_GLOBAL in pageWindow).toBe(false)
  })
})

describe('isolated-world send budget', () => {
  it('drops oversized messages and floods before they reach the host', async () => {
    const { createPluginFrameSendBudget, estimatePluginFrameMessageBytes } =
      await import('./plugin-frame-guest-send-budget')
    let clock = 0
    const admit = createPluginFrameSendBudget(() => clock, {
      maxMessageBytes: 1000,
      maxMessages: 3,
      maxBytes: 1500,
      perMs: 100
    })
    expect(admit({ text: 'x'.repeat(400) })).toBe(false)
    expect(admit({ a: 1 })).toBe(true)
    expect(admit({ a: 1 })).toBe(true)
    expect(admit({ a: 1 })).toBe(true)
    expect(admit({ a: 1 })).toBe(false)
    clock = 200
    expect(admit({ a: 1 })).toBe(true)
    expect(estimatePluginFrameMessageBytes(new ArrayBuffer(64))).toBe(64)
    let deep: unknown = 0
    for (let i = 0; i < 200; i += 1) {
      deep = [deep]
    }
    expect(estimatePluginFrameMessageBytes(deep)).toBe(Number.POSITIVE_INFINITY)
  })
})
