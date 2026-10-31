import { enableIfDataPlugin } from './catalog/plugin-one-click-enable'
import type { ValidDiscoveredPlugin } from './plugin-discovery'

/**
 * Turns on shipped plugins that are content only, as a catalog click would; Orca's own release
 * vouches for their bytes. One the user turned off stays off, and code still waits for review.
 */
export async function approveBundledContentPlugins(input: {
  pluginKeys: readonly string[]
  consents: Readonly<Record<string, string>>
  disabledPlugins: readonly string[]
  findValidPlugin: (pluginKey: string) => ValidDiscoveredPlugin | null
  approve: (pluginKey: string, reviewedFingerprint: string) => Promise<void>
}): Promise<void> {
  for (const pluginKey of input.pluginKeys) {
    const plugin = input.findValidPlugin(pluginKey)
    if (
      !plugin ||
      input.disabledPlugins.includes(pluginKey) ||
      input.consents[pluginKey] === plugin.consentFingerprint
    ) {
      continue
    }
    await enableIfDataPlugin({
      pluginKey,
      installedFingerprint: plugin.consentFingerprint,
      findValidPlugin: input.findValidPlugin,
      approve: input.approve
    })
  }
}
