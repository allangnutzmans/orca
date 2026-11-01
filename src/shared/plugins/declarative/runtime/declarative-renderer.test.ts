import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { atom, read, update } from './declarative-atoms'
import { Fragment, h, jsx } from './declarative-elements'
import { createOrcaDeclarativeRuntime, type OrcaBridge } from './declarative-renderer'
import { parsePluginDeclarativeTree } from '../plugin-declarative-tree'

type Posted = { event: string; payload: unknown }
type WireNode = {
  type: string
  key: string
  props: Record<string, unknown>
  children: (WireNode | string)[]
}
const wireNodeSchema: z.ZodType<WireNode> = z.lazy(() =>
  z.object({
    type: z.string(),
    key: z.string(),
    props: z.record(z.string(), z.unknown()),
    children: z.array(z.union([z.string(), wireNodeSchema]))
  })
)
const renderSchema = z.object({ revision: z.number(), tree: wireNodeSchema })
const callbackRefSchema = z.object({ $callback: z.string() })

function setup(bridge?: OrcaBridge) {
  const posted: Posted[] = []
  const queue: { flush: () => void; delayMs: number }[] = []
  const runtime = createOrcaDeclarativeRuntime({
    post: (event, payload) => posted.push({ event, payload }),
    schedule: (flush, delayMs) => queue.push({ flush, delayMs }),
    bridge
  })
  const drain = () => queue.splice(0).forEach(({ flush }) => flush())
  const last = () => posted.at(-1)?.payload
  const tree = (): WireNode => renderSchema.parse(last()).tree
  return { runtime, posted, queue, drain, last, tree }
}

function callbackAt(node: WireNode, prop: string, ...path: number[]): string {
  let current = node
  for (const index of path) {
    current = wireNodeSchema.parse(current.children[index])
  }
  return callbackRefSchema.parse(current.props[prop]).$callback
}

describe('declarative runtime', () => {
  it('renders function components into keyed catalog nodes with callback refs', () => {
    const { runtime, last, tree } = setup()
    const onPress = vi.fn()
    const Greeting = (props: { name?: unknown }) => h('Text', { tone: 'accent' }, 'Hi ', props.name)
    runtime.mount(() =>
      jsx('Stack', {
        gap: 'sm',
        children: [h(Greeting, { name: 'Ada' }), h('Button', { onPress, key: 'go' }, 'Go')]
      })
    )
    expect(last()).toMatchObject({
      revision: 1,
      tree: {
        type: 'Stack',
        key: '#0',
        children: [
          { type: 'Text', key: '#0', props: { tone: 'accent' }, children: ['Hi ', 'Ada'] },
          { type: 'Button', key: 'go', props: { onPress: { $callback: expect.any(String) } } }
        ]
      }
    })
    expect(parsePluginDeclarativeTree(tree()).ok).toBe(true)
    const id = callbackAt(tree(), 'onPress', 1)
    expect(runtime.dispatchEvent({ revision: 1, callback: id, args: [] })).toBe(true)
    expect(onPress).toHaveBeenCalledOnce()
  })

  it('keeps a slot for every null/false gap, so siblings keep their keys', () => {
    const { runtime, drain, tree } = setup()
    const shown = atom(false)
    runtime.mount(() =>
      h('Stack', null, read(shown) && h('Spinner', { label: 'x' }), h('Input', { label: 'Name' }))
    )
    expect(tree().children).toEqual([expect.objectContaining({ type: 'Input', key: '#1' })])
    update(shown, true)
    drain()
    expect(tree().children).toEqual([
      expect.objectContaining({ type: 'Spinner', key: '#0' }),
      expect.objectContaining({ type: 'Input', key: '#1' })
    ])
  })

  it("carries a component's key to what it renders, and scopes nested arrays", () => {
    const { runtime, tree } = setup()
    const Row = (props: { label?: unknown }) => h('Text', null, props.label)
    runtime.mount(() =>
      h(
        'Stack',
        null,
        [h(Row, { key: 'a', label: 'A' }), h(Row, { key: 'b', label: 'B' })],
        h(Fragment, null, 'x')
      )
    )
    expect(
      tree().children.map((child) => (typeof child === 'string' ? undefined : child.key))
    ).toEqual(['#0.a', '#0.b', undefined])
  })

  it('rejects duplicate sibling keys without committing', () => {
    const { runtime, posted } = setup()
    runtime.mount(() => h('Stack', null, [h('Text', { key: 'x' }), h('Text', { key: 'x' })]))
    expect(posted).toEqual([
      {
        event: 'ui.error',
        payload: { revision: 0, message: expect.stringContaining('duplicate key "x"') }
      }
    ])
  })

  it('gives a control the same callback id across renders and accepts it after re-renders', () => {
    const { runtime, drain, tree } = setup()
    const count = atom(0)
    const onPress = vi.fn(() => update(count, (n) => n + 1))
    runtime.mount(() => h('Button', { onPress }, `Clicked ${read(count)}`))
    const id = callbackAt(tree(), 'onPress')
    expect(runtime.dispatchEvent({ revision: 1, callback: id, args: [] })).toBe(true)
    drain()
    expect(callbackAt(tree(), 'onPress')).toBe(id)
    // The host may still show revision 1: the id resolves in the current tree, so it counts.
    expect(runtime.dispatchEvent({ revision: 1, callback: id, args: [] })).toBe(true)
    expect(onPress).toHaveBeenCalledTimes(2)
    expect(runtime.dispatchEvent({ revision: 2, callback: 'nope', args: [] })).toBe(false)
    expect(runtime.dispatchEvent('nonsense')).toBe(false)
  })

  it('keeps the accepted render resolvable when the host refuses a newer one', () => {
    const { runtime, drain, tree, queue } = setup()
    const page = atom('a')
    const onA = vi.fn()
    runtime.mount(() =>
      read(page) === 'a' ? h('Button', { onPress: onA }, 'A') : h('Text', null, 'b')
    )
    const id = callbackAt(tree(), 'onPress')
    runtime.acknowledge({ revision: 1, accepted: true })
    update(page, 'b')
    drain()
    // Revision 2 is refused (rate-limited): the person still sees revision 1's button.
    runtime.acknowledge({ revision: 2, accepted: false, retryAfterMs: 250 })
    expect(runtime.dispatchEvent({ revision: 1, callback: id, args: [] })).toBe(true)
    expect(onA).toHaveBeenCalledOnce()
    expect(queue.at(-1)?.delayMs).toBeGreaterThanOrEqual(250)
    drain()
    expect(tree().children).toEqual(['b'])
    runtime.acknowledge({ revision: 3, accepted: true })
    expect(runtime.dispatchEvent({ revision: 1, callback: id, args: [] })).toBe(false)
  })

  it('throttles renders and coalesces a burst of updates into one', () => {
    let clock = 0
    const posted: unknown[] = []
    const queue: { flush: () => void; delayMs: number }[] = []
    const runtime = createOrcaDeclarativeRuntime({
      post: (_event, payload) => posted.push(payload),
      schedule: (flush, delayMs) => queue.push({ flush, delayMs }),
      now: () => clock
    })
    const count = atom(0)
    runtime.mount(() => h('Text', null, String(read(count))))
    update(count, 1)
    update(count, 2)
    expect(queue).toHaveLength(1)
    expect(queue[0].delayMs).toBeGreaterThan(0)
    clock = 100
    queue.splice(0).forEach(({ flush }) => flush())
    expect(posted).toHaveLength(2)
  })

  it('refuses update() during render with a clear error', () => {
    const { runtime, posted } = setup()
    const count = atom(0)
    runtime.mount(() => {
      update(count, 1)
      return h('Text', null, 'x')
    })
    expect(posted).toEqual([
      {
        event: 'ui.error',
        payload: { revision: 0, message: expect.stringContaining('while rendering') }
      }
    ])
  })

  it('reports props that are not plain JSON instead of posting them', () => {
    const { runtime, posted } = setup()
    runtime.mount(() => h('Text', { tone: new Date(0) }, 'x'))
    runtime.mount(() => h('Select', { label: 'x', options: [{ value: 'a', label: new Map() }] }))
    expect(posted.map((entry) => entry.event)).toEqual(['ui.error', 'ui.error'])
    expect(posted[0].payload).toMatchObject({
      message: expect.stringContaining('plain JSON data, not Date')
    })
  })

  it('passes unknown components through for the host to draw as placeholders, but not DOM tags', () => {
    const { runtime, posted } = setup()
    runtime.mount(() => h('Carousel', null))
    expect(posted[0]).toMatchObject({ event: 'ui.render', payload: { tree: { type: 'Carousel' } } })
    runtime.mount(() => h('div', null))
    expect(posted[1]).toMatchObject({
      event: 'ui.error',
      payload: { message: expect.stringContaining('<div>') }
    })
  })

  it('reports render and handler errors without dropping the last good revision', async () => {
    const { runtime, posted, drain, last, tree } = setup()
    const broken = atom(false)
    runtime.mount(() => {
      if (read(broken)) {
        throw new Error('boom')
      }
      return h('Button', { onPress: () => Promise.reject(new Error('async boom')) }, 'ok')
    })
    const id = callbackAt(tree(), 'onPress')
    update(broken, true)
    drain()
    expect(posted.at(-1)).toEqual({ event: 'ui.error', payload: { revision: 1, message: 'boom' } })
    expect(runtime.dispatchEvent({ revision: 1, callback: id, args: [] })).toBe(true)
    await Promise.resolve()
    expect(last()).toEqual({ revision: 1, message: 'async boom' })
    update(broken, false)
    drain()
    expect(last()).toMatchObject({ revision: 2 })
  })

  it('stops a self-rendering component with an error instead of overflowing the stack', () => {
    const { runtime, last } = setup()
    const Loop = (): unknown => h(Loop, null)
    runtime.mount(Loop)
    expect(last()).toMatchObject({ message: expect.stringMatching(/deeper than/) })
  })

  it('posts an empty tree and drops callbacks on unmount', () => {
    const { runtime, last, tree } = setup()
    runtime.mount(() => h('Button', { onPress: () => undefined }, 'x'))
    const id = callbackAt(tree(), 'onPress')
    expect(runtime.mounted()).toBe(true)
    runtime.unmount()
    expect(runtime.mounted()).toBe(false)
    expect(last()).toEqual({ revision: 2, tree: null })
    expect(runtime.dispatchEvent({ revision: 1, callback: id, args: [] })).toBe(false)
  })

  it('delegates host calls and events to the bridge and follows theme changes', () => {
    const handlers = new Map<string, (payload: unknown) => void>()
    const call = vi.fn(async () => 'pong')
    const bridge: OrcaBridge = {
      host: { call },
      on: (event, handler) => {
        handlers.set(event, handler)
        return { dispose: () => handlers.delete(event) }
      }
    }
    const { runtime, drain, last } = setup(bridge)
    void runtime.host.call('workspace.list', { limit: 1 })
    expect(call).toHaveBeenCalledWith('workspace.list', { limit: 1 }, undefined)
    runtime.mount(() => h('Text', null, runtime.theme().colorScheme))
    expect(last()).toMatchObject({ tree: { children: ['dark'] } })
    handlers.get('theme')?.({ colorScheme: 'light' })
    drain()
    expect(last()).toMatchObject({ tree: { children: ['light'] } })
    expect([...handlers.keys()].sort()).toEqual(['theme', 'ui.ack', 'ui.event'])
    runtime.dispose()
    expect(handlers.size).toBe(0)
  })

  it('rejects host calls when no bridge is installed', async () => {
    const { runtime } = setup()
    await expect(runtime.host.call('x')).rejects.toThrow(/unavailable/)
  })
})
