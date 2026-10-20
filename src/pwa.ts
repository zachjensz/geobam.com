import { registerSW } from 'virtual:pwa-register'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000
const LAST_UPDATE_CHECK_KEY = 'geobam-last-update-check'
let safeToActivate = window.location.pathname === '/'
let activateWaitingWorker: (() => Promise<void>) | null = null

async function activateWhenSafe() {
  if (!safeToActivate || !activateWaitingWorker) return
  const activate = activateWaitingWorker
  activateWaitingWorker = null
  await activate()
}

const updateServiceWorker = registerSW({
  immediate: false,
  onNeedRefresh() {
    // The new worker and all of its assets are already downloaded at this
    // point. Keep it waiting until gameplay reaches a safe boundary.
    activateWaitingWorker = () => updateServiceWorker(true)
    void activateWhenSafe()
  },
  onRegisteredSW(_serviceWorkerUrl, registration) {
    if (!registration) return

    const checkForUpdate = () => {
      const lastChecked = Number.parseInt(
        window.localStorage.getItem(LAST_UPDATE_CHECK_KEY) ?? '0',
        10,
      )
      if (
        navigator.onLine
        && Date.now() - (Number.isFinite(lastChecked) ? lastChecked : 0) >= UPDATE_CHECK_INTERVAL_MS
      ) {
        window.localStorage.setItem(LAST_UPDATE_CHECK_KEY, String(Date.now()))
        void registration.update()
      }
    }
    checkForUpdate()
    const interval = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate()
    })

    window.addEventListener('pagehide', () => window.clearInterval(interval), { once: true })
  },
})

export function setServiceWorkerUpdateSafe(safe: boolean) {
  safeToActivate = safe
  if (safe) void activateWhenSafe()
}
