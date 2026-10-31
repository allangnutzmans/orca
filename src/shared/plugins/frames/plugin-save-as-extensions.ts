/**
 * Extensions a plugin may never save to: files Windows or macOS would run, install or follow on a
 * double-click. A plugin's data is a document, not a program, so `files.saveAs` refuses these.
 */
export const PLUGIN_SAVE_AS_BLOCKED_EXTENSIONS: ReadonlySet<string> = new Set([
  // Windows
  'exe',
  'bat',
  'cmd',
  'com',
  'scr',
  'pif',
  'hta',
  'js',
  'jse',
  'vbs',
  'vbe',
  'wsf',
  'wsh',
  'ps1',
  'msi',
  'msp',
  'lnk',
  'url',
  'reg',
  'cpl',
  'jar',
  // macOS
  'app',
  'command',
  'terminal',
  'fileloc',
  'webloc',
  'pkg',
  'dmg',
  // Linux and shells
  'sh',
  'desktop'
])

/** The blocked extension of `name`, or null. Trailing dots and spaces (Windows strips them) count. */
export function blockedPluginSaveAsExtension(name: string): string | null {
  const base =
    name
      .replace(/[. ]+$/, '')
      .split(/[\\/]/)
      .at(-1) ?? ''
  const dot = base.lastIndexOf('.')
  const extension = dot > 0 ? base.slice(dot + 1).toLowerCase() : ''
  return PLUGIN_SAVE_AS_BLOCKED_EXTENSIONS.has(extension) ? extension : null
}
