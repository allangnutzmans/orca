import { PLUGIN_DECLARATIVE_LIMITS } from '../../../../shared/plugins/declarative/plugin-declarative-limits'
import { PLUGIN_DECLARATIVE_MESSAGES } from '../../../../shared/plugins/declarative/plugin-declarative-message-names'
import type { PluginFrameHello } from '../../../../shared/plugins/frames/plugin-frame-bridge'
import { PLUGIN_FRAME_IPC_CHANNEL } from '../../../../shared/plugins/frames/plugin-frame-guest'
import {
  createPanelMessageBudget,
  type PanelMessageBudget
} from '../../../../shared/plugins/frames/plugin-panel-message-budget'
import { PLUGIN_PROTOCOL_VERSION } from '../../../../shared/plugins/frames/plugin-protocol'
import { isPluginJsonObject } from '../../../../shared/plugins/manifest/plugin-json-object'
import {
  getPluginHostMethodSpec,
  PLUGIN_FRAME_USER_METHODS,
  PLUGIN_SAVE_AS_MAX_BYTES,
  pluginFrameMethodsFor,
  pluginHostApiMinorFor
} from '../../../../shared/plugins/workers/plugin-host-api'
import { PLUGIN_HOST_API_MAJOR } from '../../../../shared/plugins/workers/plugin-host-api-major'
import { getIntlLocale } from '@/i18n/i18n'
import { currentPluginFrameTheme } from './plugin-panel-design-token-css'

/** Which channel a message came over; only a guest's activation stamp is trustworthy. */
export type PluginFrameTransport = 'iframe' | 'guest'

/** What the host knows about one frame message beyond its data. */
export type PluginFrameMessageContext = {
  /** The frame had transient user activation when it sent the message. */
  userActivation: boolean
  /** Defaults to `iframe`: user-gesture host methods run only for guests. */
  transport?: PluginFrameTransport
}

/** Where host replies go: an iframe's window, or a guest webview through its IPC channel. */
export type PluginFrameWindow = {
  postMessage: (message: unknown, targetOrigin: string, transfer?: Transferable[]) => void
}

/** The guest side of `webview.send`; IPC copies, so transfer lists are ignored. */
type PluginFrameWebview = { send: (channel: string, ...args: unknown[]) => void }

const webviewFrameWindows = new WeakMap<PluginFrameWebview, PluginFrameWindow>()

/** One stable adapter per guest, so sender identity checks keep working across calls. */
export function pluginWebviewFrameWindow(webview: PluginFrameWebview): PluginFrameWindow {
  let frameWindow = webviewFrameWindows.get(webview)
  if (!frameWindow) {
    frameWindow = {
      postMessage: (message) => {
        try {
          webview.send(PLUGIN_FRAME_IPC_CHANNEL, message)
        } catch {
          // Before dom-ready or after the guest died there is no one to answer.
        }
      }
    }
    webviewFrameWindows.set(webview, frameWindow)
  }
  return frameWindow
}

export function pluginFrameHello(
  surface: 'panel' | 'editor',
  transport: PluginFrameTransport = 'iframe'
): PluginFrameHello {
  const methods = pluginFrameMethodsFor(surface, transport === 'guest')
  return {
    protocol: PLUGIN_PROTOCOL_VERSION,
    surface,
    // Why derived: an iframe must not claim a minor whose methods it is never offered.
    api: { major: PLUGIN_HOST_API_MAJOR, minor: pluginHostApiMinorFor(methods) },
    methods,
    theme: currentPluginFrameTheme(),
    locale: getIntlLocale()
  }
}

/**
 * Whether a user-gesture method may run. A srcdoc iframe shares the host window, whose activation
 * any keystroke in Orca sets, so only a guest's isolated-world stamp counts; `hostActivation` is a
 * one-shot grant from a press on Orca's own controls (declarative panels).
 */
export function admitsUserMethod(
  method: string,
  context: PluginFrameMessageContext,
  consumeHostActivation?: () => boolean
): boolean {
  if (getPluginHostMethodSpec(method)?.userActivation !== true) {
    return true
  }
  if (context.transport === 'guest' && context.userActivation) {
    return true
  }
  return consumeHostActivation?.() === true
}

const SAVE_AS_LIMITS = { maxBytes: PLUGIN_SAVE_AS_MAX_BYTES + 4096, maxMessages: 5, perMs: 10_000 }
const RENDER_LIMITS = { maxBytes: 640 * 1024, maxMessages: 200, perMs: 10_000 }
/**
 * Size-walk caps for `ui.render`, derived from the tree limits so every tree the parser would
 * accept is metered rather than refused: a node nests two levels (node, children array) plus props.
 * The byte cap still bounds the walk's work.
 */
export const PLUGIN_FRAME_RENDER_WALK_LIMITS = {
  maxDepth: PLUGIN_DECLARATIVE_LIMITS.maxDepth * 2 + 24,
  maxObjects: PLUGIN_DECLARATIVE_LIMITS.maxNodes * 8 + 1024
}

export type PluginFrameLanes = { save: PanelMessageBudget; render: PanelMessageBudget }

export function createPluginFrameLanes(
  overrides: Partial<PluginFrameLanes> = {}
): PluginFrameLanes {
  return {
    save: overrides.save ?? createPanelMessageBudget(SAVE_AS_LIMITS),
    render: overrides.render ?? createPanelMessageBudget(RENDER_LIMITS)
  }
}

/** Saves carry whole files and trees can be large, so each rides its own lane, not the 64 KiB one. */
export function pluginFrameLaneFor(
  data: unknown,
  lanes: PluginFrameLanes,
  shared: PanelMessageBudget
): PanelMessageBudget {
  if (!isPluginJsonObject(data)) {
    return shared
  }
  if (data.kind === 'req' && data.method === PLUGIN_FRAME_USER_METHODS.saveAs) {
    return lanes.save
  }
  if (data.kind === 'evt' && data.event === PLUGIN_DECLARATIVE_MESSAGES.render) {
    return lanes.render
  }
  return shared
}
