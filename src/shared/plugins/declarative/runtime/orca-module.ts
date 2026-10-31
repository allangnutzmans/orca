/**
 * Entry of the guest `orca` module (also `orca/jsx-runtime` and `orca/jsx-dev-runtime`). Bundled
 * to resources/plugins/declarative/orca-runtime.mjs by config/scripts/build-plugin-declarative-runtime.mjs.
 * The frame bootstrap calls installOrcaDeclarativeRuntime before importing the plugin entry.
 */
import {
  createOrcaDeclarativeRuntime,
  type OrcaBridge,
  type OrcaColorScheme,
  type OrcaDeclarativeRuntime,
  type OrcaDisposable,
  type OrcaRuntimeOptions,
  type OrcaTheme
} from './declarative-renderer'
import type { OrcaComponent } from './declarative-elements'
import { PLUGIN_DECLARATIVE_CATALOG_VERSION } from '../plugin-declarative-message-names'

export { atom, read, update } from './declarative-atoms'
export { Fragment, h, jsx, jsx as jsxs, jsx as jsxDEV } from './declarative-elements'

/** `ui.version` grows with the component catalog, for feature detection. */
export const ui = Object.freeze({ version: PLUGIN_DECLARATIVE_CATALOG_VERSION })

let runtime: OrcaDeclarativeRuntime | null = null
let pendingMount: OrcaComponent | null = null

function isOrcaBridge(value: unknown): value is OrcaBridge {
  return (
    typeof value === 'object' && value !== null && typeof Reflect.get(value, 'on') === 'function'
  )
}

function globalBridge(): OrcaBridge | null {
  const candidate: unknown = Reflect.get(globalThis, 'orca')
  return isOrcaBridge(candidate) ? candidate : null
}

function documentColorScheme(): OrcaColorScheme | undefined {
  const root = typeof document === 'undefined' ? null : document.documentElement
  if (!root) {
    return undefined
  }
  return root.classList.contains('light') ? 'light' : 'dark'
}

/** Starts the runtime; `bridge` defaults to the preload's `window.orca`. Replaces any earlier one. */
export function installOrcaDeclarativeRuntime(
  options: Pick<OrcaRuntimeOptions, 'post'> & Partial<OrcaRuntimeOptions>
): OrcaDeclarativeRuntime {
  runtime?.dispose()
  runtime = createOrcaDeclarativeRuntime({
    bridge: globalBridge(),
    colorScheme: documentColorScheme(),
    ...options
  })
  const queued = pendingMount
  pendingMount = null
  if (queued) {
    runtime.mount(queued)
  }
  return runtime
}

/** Renders `component` as the panel. A module's default export is mounted the same way. */
export function mount(component: OrcaComponent): void {
  if (runtime) {
    runtime.mount(component)
  } else {
    pendingMount = component
  }
}

export const host = Object.freeze({
  call(method: string, params?: unknown, options?: unknown): Promise<unknown> {
    if (runtime) {
      return runtime.host.call(method, params, options)
    }
    const bridgeHost = globalBridge()?.host
    return bridgeHost
      ? bridgeHost.call(method, params, options)
      : Promise.reject(new Error('the Orca host bridge is unavailable'))
  }
})

export function on(event: string, handler: (payload: unknown) => void): OrcaDisposable {
  if (runtime) {
    return runtime.on(event, handler)
  }
  return globalBridge()?.on?.(event, handler) ?? { dispose() {} }
}

/** Reading the theme during render re-renders on light/dark switches. */
export function theme(): OrcaTheme {
  return runtime ? runtime.theme() : { colorScheme: documentColorScheme() ?? 'dark' }
}

// Catalog tags: JSX `<Stack>` compiles to a reference, so authors import these by name.
export const Stack = 'Stack'
export const Row = 'Row'
export const Text = 'Text'
export const Heading = 'Heading'
export const Button = 'Button'
export const IconButton = 'IconButton'
export const Badge = 'Badge'
export const Card = 'Card'
export const List = 'List'
export const ListItem = 'ListItem'
export const Input = 'Input'
export const Switch = 'Switch'
export const Select = 'Select'
export const Separator = 'Separator'
export const Progress = 'Progress'
export const Spinner = 'Spinner'
export const EmptyState = 'EmptyState'
export const Link = 'Link'
export const Code = 'Code'
