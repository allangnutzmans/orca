import { PLUGIN_DECLARATIVE_MESSAGES } from '../declarative/plugin-declarative-message-names'
import {
  PLUGIN_DECLARATIVE_POST_GLOBAL,
  PLUGIN_DECLARATIVE_RUNTIME_FILE,
  PLUGIN_FRAME_RESERVED_SEGMENT
} from './plugin-frame-guest'

const RUNTIME_PATH = `/${PLUGIN_FRAME_RESERVED_SEGMENT}/${PLUGIN_DECLARATIVE_RUNTIME_FILE}`

const scriptJson = (value: unknown): string => JSON.stringify(value).replaceAll('<', '\\u003c')

/**
 * Body of the hidden page a declarative panel runs in (served after the guest shell). `entry` is a
 * declared manifest path, so it always resolves inside the plugin's own origin.
 */
export function buildPluginDeclarativeHostBody(entry: string): string {
  const imports = {
    orca: RUNTIME_PATH,
    'orca/jsx-runtime': RUNTIME_PATH,
    'orca/jsx-dev-runtime': RUNTIME_PATH
  }
  const entryPath = `/${entry.split('/').map(encodeURIComponent).join('/')}`
  return (
    `<script type="importmap">${scriptJson({ imports })}</script>\n` +
    '<script type="module">\n' +
    `const name = ${scriptJson(PLUGIN_DECLARATIVE_POST_GLOBAL)}\n` +
    'const post = window[name]\n' +
    'delete window[name]\n' +
    `const report = (error) => post(${scriptJson(PLUGIN_DECLARATIVE_MESSAGES.error)}, ` +
    '{ revision: 0, message: String((error && error.message) || error).slice(0, 4096) })\n' +
    'try {\n' +
    "  const runtime = (await import('orca')).installOrcaDeclarativeRuntime({ post })\n" +
    `  const module = await import(${scriptJson(entryPath)})\n` +
    "  if (typeof module.default === 'function') runtime.mount(module.default)\n" +
    '  else if (!runtime.mounted()) throw new Error(' +
    "'The panel module must export a component function as its default export (got ' + " +
    "(module.default === null ? 'null' : typeof module.default) + ')')\n" +
    '} catch (error) {\n' +
    '  report(error)\n' +
    '}\n' +
    '</script>\n'
  )
}
