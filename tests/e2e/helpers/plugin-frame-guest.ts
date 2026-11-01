import type { Locator, Page } from '@stablyai/playwright-test'
import { expect } from './orca-app'

/** A desktop plugin frame: an isolated `<webview>` guest titled with the panel or editor title. */
export function pluginGuest(page: Page, title: string): Locator {
  return page.locator(`webview[title="${title}"]`)
}

/** Runs `source` in the guest's main world and returns its JSON-serializable result. */
export async function evalInGuest<T>(guest: Locator, source: string): Promise<T> {
  // Why unchecked: callers pass expressions whose result shape they assert on.
  const result: T = await guest.evaluate(
    (webview: Electron.WebviewTag, script: string) => webview.executeJavaScript(script),
    source
  )
  return result
}

/** Resolves once the guest's document has finished its first load. */
export async function waitForGuestReady(guest: Locator): Promise<void> {
  await guest.evaluate(
    (webview: Electron.WebviewTag) =>
      new Promise<void>((resolve) => {
        try {
          if (!webview.isLoading() && webview.getURL()) {
            resolve()
            return
          }
        } catch {
          // Not attached yet: wait for its first dom-ready.
        }
        webview.addEventListener('dom-ready', () => resolve())
      })
  )
}

/** Focuses `selector` inside the guest so real keyboard input from the page reaches it. */
export async function focusInGuest(guest: Locator, selector: string): Promise<void> {
  await guest.evaluate((webview: Electron.WebviewTag) => webview.focus())
  const target = `document.querySelector(${JSON.stringify(selector)})`
  await evalInGuest(guest, `${target}.focus()`)
  // Page keyboard input reaches the guest once the host has moved focus onto the webview.
  await expect
    .poll(async () =>
      (await guest.evaluate((webview) => webview.ownerDocument.activeElement === webview))
        ? evalInGuest<boolean>(guest, `document.activeElement === ${target}`)
        : false
    )
    .toBe(true)
}

/** Clicks `selector` inside the guest with real (trusted, activating) mouse input. */
export async function clickInGuest(page: Page, guest: Locator, selector: string): Promise<void> {
  const box = await guest.boundingBox()
  if (!box) {
    throw new Error('plugin guest has no bounds')
  }
  const point = await evalInGuest<{ x: number; y: number } | null>(
    guest,
    `(() => { const r = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect();
      return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null })()`
  )
  if (!point) {
    throw new Error(`no ${selector} in the plugin guest`)
  }
  const x = box.x + point.x
  const y = box.y + point.y
  // Why: host overlays (the panel button's tooltip, toasts) can sit over the guest and eat the click.
  await page.mouse.move(x, y)
  await expect
    .poll(() =>
      page.evaluate(({ px, py }) => document.elementFromPoint(px, py)?.tagName ?? null, {
        px: x,
        py: y
      })
    )
    .toBe('WEBVIEW')
  await page.mouse.click(x, y)
}

/** Like evalInGuest, but null while the guest is still attaching, for `expect.poll`. */
export async function readInGuest<T>(guest: Locator, source: string): Promise<T | null> {
  try {
    return await evalInGuest<T>(guest, source)
  } catch {
    return null
  }
}

/** The CSP the guest's document was served with (a response header, not a `<meta>`). */
export function readGuestCsp(guest: Locator): Promise<string | null> {
  return evalInGuest<string | null>(
    guest,
    `fetch(location.href).then((response) => response.headers.get('content-security-policy'))`
  )
}

/** The guest's WebContents id, for addressing exactly this guest from the main process. */
export function guestWebContentsId(guest: Locator): Promise<number> {
  return guest.evaluate((webview: Electron.WebviewTag) => webview.getWebContentsId())
}

/** Isolated frames are off by default until the flip; guest-path specs turn them on per launch. */
export const ISOLATED_FRAMES_E2E = { orcaAppExtraEnv: { ORCA_PLUGIN_ISOLATED_FRAMES: '1' } }
