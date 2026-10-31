import { z } from 'zod'
import { PLUGIN_DECLARATIVE_CALLBACK_ID } from './plugin-declarative-catalog'
import { PLUGIN_DECLARATIVE_LIMITS as LIMITS } from './plugin-declarative-limits'
import {
  parsePluginDeclarativeTree,
  type PluginDeclarativeTreeResult
} from './plugin-declarative-tree'

const revisionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)

export const pluginDeclarativeEventArgSchema = z.union([
  z.string().max(LIMITS.maxTextLength),
  z.number().refine(Number.isFinite),
  z.boolean(),
  z.null()
])
export type PluginDeclarativeEventArg = z.infer<typeof pluginDeclarativeEventArgSchema>

export const pluginDeclarativeEventPayloadSchema = z
  .object({
    revision: revisionSchema,
    callback: z
      .string()
      .min(1)
      .max(LIMITS.maxCallbackIdLength)
      .regex(PLUGIN_DECLARATIVE_CALLBACK_ID),
    args: z.array(pluginDeclarativeEventArgSchema).max(LIMITS.maxEventArgs)
  })
  .strict()
export type PluginDeclarativeEventPayload = z.infer<typeof pluginDeclarativeEventPayloadSchema>

/** The `ui.render` envelope; the tree has its own iterative, capped validator. */
export const pluginDeclarativeRenderPayloadSchema = z
  .object({ revision: revisionSchema, tree: z.unknown() })
  .strict()
export type PluginDeclarativeRenderPayload = z.infer<typeof pluginDeclarativeRenderPayloadSchema>

export const pluginDeclarativeErrorPayloadSchema = z
  .object({ revision: revisionSchema, message: z.string().max(LIMITS.maxLabelLength * 4) })
  .strict()
export type PluginDeclarativeErrorPayload = z.infer<typeof pluginDeclarativeErrorPayloadSchema>

export type PluginDeclarativeRenderResult =
  | (Extract<PluginDeclarativeTreeResult, { ok: true }> & { revision: number })
  | { ok: false; revision: number | null; error: string }

/** Parses a `ui.render` payload, keeping the revision even when the tree is refused. */
export function parsePluginDeclarativeRender(payload: unknown): PluginDeclarativeRenderResult {
  const envelope = pluginDeclarativeRenderPayloadSchema.safeParse(payload)
  if (!envelope.success) {
    return { ok: false, revision: null, error: 'malformed render' }
  }
  const { revision } = envelope.data
  const tree = parsePluginDeclarativeTree(envelope.data.tree)
  return tree.ok ? { ...tree, revision } : { ok: false, revision, error: tree.error }
}

/** Revision of a `ui.render` refused before parsing (e.g. rate-limited), when readable. */
export function pluginDeclarativeRenderRevision(payload: unknown): number | null {
  const revision: unknown =
    typeof payload === 'object' && payload !== null ? Reflect.get(payload, 'revision') : undefined
  return revisionSchema.safeParse(revision).success && typeof revision === 'number'
    ? revision
    : null
}

export const pluginDeclarativeAckPayloadSchema = z
  .object({
    revision: revisionSchema,
    accepted: z.boolean(),
    retryAfterMs: z.number().int().nonnegative().max(60_000).optional()
  })
  .strict()
export type PluginDeclarativeAckPayload = z.infer<typeof pluginDeclarativeAckPayloadSchema>
