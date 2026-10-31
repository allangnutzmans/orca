import { app, dialog, shell, type BrowserWindow } from 'electron'
import { writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { normalizeBrowserDownloadFilename } from '../../../shared/browser-download-filename'
import { isPluginExternalUrl } from '../../../shared/plugins/workers/plugin-host-api'
import { createPanelMessageBudget } from '../../../shared/plugins/frames/plugin-panel-message-budget'
import type { PanelMessageBudget } from '../../../shared/plugins/frames/plugin-panel-message-budget'
import type { PluginDesktopFrameServices } from '../workers/plugin-host-method-bindings'
import { translateMain } from '../../i18n/main-i18n'
import { blockedPluginSaveAsExtension } from '../../../shared/plugins/frames/plugin-save-as-extensions'

/** Backstop behind the frame host's per-gesture check: a few dialogs or tabs per plugin at most. */
const DESKTOP_FRAME_RATE_LIMIT = {
  maxMessages: 3,
  perMs: 10_000,
  maxBytes: Number.MAX_SAFE_INTEGER
}

// Every main window that hosts plugin frames; a call belongs to the one the person just used.
const hostWindows = new Set<BrowserWindow>()
const budgets = new Map<string, PanelMessageBudget>()
let services: PluginDesktopFrameServices | null = null

/** Null in headless serve and before a main window exists: the methods then fail. */
export function getPluginDesktopFrameServices(): PluginDesktopFrameServices | null {
  return services
}

/** The window the call came from: the gesture just happened there, so it is the focused one. */
function callingWindow(): BrowserWindow | null {
  const live = [...hostWindows].filter((window) => !window.isDestroyed())
  return live.find((window) => window.isFocused()) ?? live.at(-1) ?? null
}

function admit(window: BrowserWindow | null, pluginId: string): void {
  const key = `${window?.id ?? 'none'}\0${pluginId}`
  let budget = budgets.get(key)
  if (!budget) {
    budget = createPanelMessageBudget(DESKTOP_FRAME_RATE_LIMIT)
    budgets.set(key, budget)
  }
  if (budget.admit(Date.now(), 0)) {
    throw new Error('too many requests; try again shortly')
  }
}

export function installPluginDesktopFrameServices(window: BrowserWindow): void {
  hostWindows.add(window)
  window.once('closed', () => {
    hostWindows.delete(window)
    for (const key of budgets.keys()) {
      if (key.startsWith(`${window.id}\0`)) {
        budgets.delete(key)
      }
    }
  })
  if (services) {
    return
  }
  services = {
    async openExternal(pluginId, url) {
      // Re-checked here: the shared schema already refused other schemes, but this is the sink.
      if (!isPluginExternalUrl(url)) {
        throw new Error('url must be an http:, https: or mailto: URL')
      }
      admit(callingWindow(), pluginId)
      await shell.openExternal(url)
      return true
    },
    async saveFile(pluginId, input) {
      const parent = callingWindow()
      admit(parent, pluginId)
      refuseBlockedExtension(input.suggestedName ?? '')
      const name = normalizeBrowserDownloadFilename(
        input.suggestedName ?? 'download',
        process.platform
      )
      const options: Electron.SaveDialogOptions = {
        title: translateMain('plugins.frameSaveAs.title', 'Save File'),
        defaultPath: join(app.getPath('downloads'), name),
        filters: saveDialogFilters(name)
      }
      const result =
        parent && !parent.isDestroyed()
          ? await dialog.showSaveDialog(parent, options)
          : await dialog.showSaveDialog(options)
      if (result.canceled || !result.filePath) {
        return false
      }
      // Re-checked: the person may type a name, but plugin data still never becomes a program.
      refuseBlockedExtension(result.filePath)
      const { data } = input
      await writeFile(result.filePath, data instanceof ArrayBuffer ? new Uint8Array(data) : data)
      return true
    }
  }
}

function refuseBlockedExtension(name: string): void {
  const blocked = blockedPluginSaveAsExtension(name)
  if (blocked) {
    throw new Error(`plugins cannot save .${blocked} files: they would run when opened`)
  }
}

/** Any MIME type is accepted; the filter only follows the suggested name's extension. */
export function saveDialogFilters(name: string): Electron.FileFilter[] | undefined {
  const extension = extname(name).slice(1)
  if (!/^[\w.+-]{1,32}$/.test(extension)) {
    return undefined
  }
  return [
    { name: extension.toUpperCase(), extensions: [extension] },
    { name: translateMain('plugins.frameSaveAs.allFiles', 'All Files'), extensions: ['*'] }
  ]
}
