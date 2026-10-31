/** Caps on one `ui.render` tree. Generous for a sidebar panel, small enough to validate per frame. */
export const PLUGIN_DECLARATIVE_LIMITS = {
  maxNodes: 5000,
  maxDepth: 64,
  /** Approximate serialized size: string lengths plus a fixed cost per node and prop. */
  maxTreeBytes: 512 * 1024,
  maxTextLength: 16 * 1024,
  maxLabelLength: 1024,
  maxPropsPerNode: 32,
  maxSelectOptions: 500,
  maxEventArgs: 8,
  maxCallbackIdLength: 64
} as const
