/** `evt` names in the frame envelope. Zod-free so the guest runtime can bundle it. */
export const PLUGIN_DECLARATIVE_MESSAGES = {
  /** guest → host, `{ revision, tree }` */
  render: 'ui.render',
  /** host → guest, `{ revision, callback, args }` */
  event: 'ui.event',
  /** guest → host, `{ revision, message }`: the component threw; the host keeps the last good tree. */
  error: 'ui.error',
  /**
   * host → guest, `{ revision, accepted, retryAfterMs? }`: whether a render is now on screen.
   * The guest keeps the callbacks of the last accepted render until a newer one is accepted.
   */
  ack: 'ui.ack'
} as const

/** Bump when the catalog grows, so plugins can feature-detect via `ui.version`. */
export const PLUGIN_DECLARATIVE_CATALOG_VERSION = 1

/** Catalog component names, mirrored by the zod catalog (parity-tested). */
export const PLUGIN_DECLARATIVE_COMPONENTS = [
  'Stack',
  'Row',
  'Text',
  'Heading',
  'Button',
  'IconButton',
  'Badge',
  'Card',
  'List',
  'ListItem',
  'Input',
  'Switch',
  'Select',
  'Separator',
  'Progress',
  'Spinner',
  'EmptyState',
  'Link',
  'Code'
] as const
