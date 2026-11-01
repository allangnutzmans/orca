import { enableIfDataPlugin } from './catalog/plugin-one-click-enable'
import type { ValidDiscoveredPlugin } from './plugin-discovery'

/**
 * Turns on shipped plugins that are content only, as a catalog click would; Orca's own release
 * vouches for their bytes. One the user turned off stays off, and code still waits for review.
 */
export async function approveBundledContentPlugins(input: {
  pluginKeys: readonly string[]
  /** Read per plugin, so a switch-off made while another is approved still counts. */
  readConsentState: () => {
    consents: Readonly<Record<string, string>>
    disabledPlugins: readonly string[]
  }
  findValidPlugin: (pluginKey: string) => ValidDiscoveredPlugin | null
  approve: (pluginKey: string, reviewedFingerprint: string) => Promise<void>
}): Promise<void> {
  for (const pluginKey of input.pluginKeys) {
    const plugin = input.findValidPlugin(pluginKey)
    const { consents, disabledPlugins } = input.readConsentState()
    if (
      !plugin ||
      disabledPlugins.includes(pluginKey) ||
      consents[pluginKey] === plugin.consentFingerprint
    ) {
      continue
    }
    try {
      await enableIfDataPlugin({
        pluginKey,
        installedFingerprint: plugin.consentFingerprint,
        findValidPlugin: input.findValidPlugin,
        approve: input.approve
      })
    } catch (error) {
      // Why per plugin: one refused approval must not leave the other shipped plugins off.
      console.warn(`[plugins] failed to turn on bundled ${pluginKey}:`, error)
    }
  }
}
