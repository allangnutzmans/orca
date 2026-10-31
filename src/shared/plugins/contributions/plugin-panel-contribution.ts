import { z } from 'zod'
import { safePluginDisplayText } from '../manifest/plugin-display-text'
import { pluginIdSchema, pluginRelativePathSchema } from '../manifest/plugin-manifest-fields'
import {
  pluginPathFieldDoc,
  pluginFieldDoc,
  PLUGIN_MANIFEST_V2_SINCE,
  PLUGIN_SCHEMA_SINCE_V1
} from '../manifest/plugin-schema-field-docs'

export const PLUGIN_PANEL_LIMIT = 64

/** Icons a panel may name; the renderer bundles exactly these. Grow additively. */
export const PLUGIN_PANEL_ICONS = [
  'activity',
  'bar-chart-3',
  'bell',
  'blocks',
  'book',
  'bot',
  'bug',
  'calendar',
  'cloud',
  'code',
  'database',
  'file-text',
  'flag',
  'folder',
  'gauge',
  'globe',
  'hammer',
  'layers',
  'lightbulb',
  'package',
  'plug',
  'puzzle',
  'rocket',
  'star',
  'terminal',
  'wrench',
  'zap'
] as const

export type PluginPanelIconName = (typeof PLUGIN_PANEL_ICONS)[number]

const PANEL_ICON_BY_FOLDED_NAME = new Map<string, PluginPanelIconName>(
  PLUGIN_PANEL_ICONS.map((name) => [name.replaceAll('-', ''), name])
)

/** Accepts both Lucide spellings (`file-text`, `FileText`); null for any other name. */
export function canonicalPluginPanelIcon(name: string): PluginPanelIconName | null {
  return PANEL_ICON_BY_FOLDED_NAME.get(name.replaceAll('-', '').toLowerCase()) ?? null
}

export const PLUGIN_PANEL_RUNTIMES = ['frame', 'declarative'] as const
export type PluginPanelRuntime = (typeof PLUGIN_PANEL_RUNTIMES)[number]
const DECLARATIVE_PANEL_ENTRY = /\.m?js$/i

export const pluginPanelContributionSchema = z
  .object({
    id: pluginIdSchema.meta(
      pluginFieldDoc(
        "Panel id, unique among this plugin's panels. The reserved names `constructor` and `prototype` are refused.",
        PLUGIN_SCHEMA_SINCE_V1,
        ['dashboard']
      )
    ),
    title: safePluginDisplayText(z.string().min(1).max(256)).meta(
      pluginFieldDoc('Title shown on the panel tab and its tooltip.', PLUGIN_SCHEMA_SINCE_V1, [
        'Dashboard'
      ])
    ),
    icon: z
      .enum(PLUGIN_PANEL_ICONS)
      .optional()
      .meta(
        pluginFieldDoc(
          'Icon shown in the right-sidebar activity bar. Defaults to `plug`.',
          PLUGIN_SCHEMA_SINCE_V1,
          ['database']
        )
      ),
    entry: pluginRelativePathSchema.meta(
      pluginPathFieldDoc(
        'File rendered by the panel: an HTML document for `frame`, a `.js`/`.mjs` module for `declarative`. It is trusted code: install panels you trust.',
        PLUGIN_SCHEMA_SINCE_V1,
        ['dist/panel.html']
      )
    ),
    runtime: z
      .enum(PLUGIN_PANEL_RUNTIMES)
      .optional()
      .meta(
        pluginFieldDoc(
          'How the panel renders. `frame` (default) shows `entry` as an isolated web page; `declarative` runs `entry` as a hidden module whose TSX tree Orca renders with its own components. `declarative` is experimental: its API may change before 1.0.',
          PLUGIN_MANIFEST_V2_SINCE,
          ['declarative']
        )
      )
  })
  .strict()
  .refine((panel) => panel.runtime !== 'declarative' || DECLARATIVE_PANEL_ENTRY.test(panel.entry), {
    path: ['entry'],
    message: 'a declarative panel entry must be a .js or .mjs module'
  })
  .meta({
    id: 'PanelContribution',
    description: 'A sidebar panel. Requires the `sandboxed-ui` execution profile or higher.'
  })

export type PluginPanelContribution = z.infer<typeof pluginPanelContributionSchema>
