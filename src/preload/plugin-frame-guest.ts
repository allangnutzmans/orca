import type { ContextBridge, IpcRenderer } from 'electron'
import {
  installPluginFrameTransport,
  PRELOAD_PLUGIN_FRAME_IPC_CHANNEL,
  PRELOAD_PLUGIN_FRAME_TRANSPORT_GLOBAL
} from './plugin-frame-guest-transport'
import { createPluginFrameSendBudget } from './plugin-frame-guest-send-budget'

// Raw require keeps the sandboxed preload standalone in the CJS build.
const electron: {
  contextBridge: ContextBridge
  ipcRenderer: Pick<IpcRenderer, 'sendToHost' | 'on'>
} = require('electron')
const { contextBridge, ipcRenderer } = electron

const admitSend = createPluginFrameSendBudget()

// Why only HTML in the top frame: Orca's shell, which takes and hides the transport before plugin
// code runs, is injected only into HTML it serves. An SVG or XML document never gets one.
if (process.isMainFrame && document.contentType === 'text/html') {
  contextBridge.executeInMainWorld({
    func: installPluginFrameTransport,
    args: [
      PRELOAD_PLUGIN_FRAME_TRANSPORT_GLOBAL,
      // Activation is read here, in the isolated world, so page script cannot forge it.
      (message: unknown) => {
        if (admitSend(message)) {
          ipcRenderer.sendToHost(
            PRELOAD_PLUGIN_FRAME_IPC_CHANNEL,
            message,
            navigator.userActivation?.isActive === true
          )
        }
      },
      (receive: (message: unknown) => void) => {
        ipcRenderer.on(PRELOAD_PLUGIN_FRAME_IPC_CHANNEL, (_event, message: unknown) =>
          receive(message)
        )
      }
    ]
  })
}
