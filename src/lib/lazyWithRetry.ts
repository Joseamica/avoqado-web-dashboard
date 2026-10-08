import React, { ComponentType } from 'react'

/**
 * Wrapper for React.lazy that handles chunk loading failures after deployments.
 *
 * When a new version is deployed, old chunk files are replaced with new ones
 * that have different hashes. Users with the app open will have references
 * to the old chunks, causing "Failed to fetch dynamically imported module" errors.
 *
 * This wrapper:
 * 1. Attempts to load the chunk
 * 2. If it fails, forces a page reload — at most once per RELOAD_WINDOW_MS
 * 3. The reload fetches the new HTML with updated chunk references
 *
 * Used by: Stripe, Vercel, and most production SPAs
 */

const RELOAD_KEY = 'chunk-reload-attempted'
// 🔴 La recarga se limita por TIEMPO, no por una bandera que se borra al cargar bien
// cualquier pieza: con esa bandera, un error que se repite al recargar (dashboardv2,
// 8-oct-2026) recargaba la página sin fin — el menú cargaba bien, borraba la bandera y
// Pagos volvía a fallar. Un deploy real tarda minutos, así que 30 s no lo estorba.
const RELOAD_WINDOW_MS = 30_000

/** Error de «falta una pieza del build». Acepta un Error o el error de ruta de React Router. */
export function isChunkLoadError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const asRecord = err as { message?: unknown; statusText?: unknown; name?: unknown }
  const raw = [asRecord.message, asRecord.statusText]
    .filter(v => typeof v === 'string')
    .join(' ')
    .toLowerCase()
  const name = typeof asRecord.name === 'string' ? asRecord.name : ''
  return (
    raw.includes('failed to fetch dynamically imported module') ||
    raw.includes('loading chunk') ||
    raw.includes('loading css chunk') ||
    raw.includes('dynamically imported module') ||
    // When the server returns HTML (index.html) instead of JS,
    // the browser tries to parse HTML as JS and throws this error
    (name === 'SyntaxError' && raw.includes("unexpected token '<'"))
  )
}

/**
 * Recarga la página si no se recargó por esta razón en los últimos 30 s.
 * Devuelve true si recargó. Sin sessionStorage no recarga: no habría con qué frenar un bucle.
 */
export function reloadForChunkError(reload: () => void = () => window.location.reload(), now = Date.now()): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0
    if (now - last >= 0 && now - last < RELOAD_WINDOW_MS) return false
    sessionStorage.setItem(RELOAD_KEY, String(now))
  } catch {
    return false
  }
  reload()
  return true
}

/** El botón «Reintentar» lo pide el usuario: abre la ventana para que la recarga sí ocurra. */
export function clearChunkReloadGuard(): void {
  try {
    sessionStorage.removeItem(RELOAD_KEY)
  } catch {
    // sin storage no hay nada que limpiar
  }
}

export function lazyWithRetry<T extends ComponentType<unknown>>(
  componentImport: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    try {
      return await componentImport()
    } catch (error) {
      if (isChunkLoadError(error) && reloadForChunkError()) {
        // Return a promise that never resolves (page will reload)
        return new Promise(() => {})
      }
      // Not a chunk error, or we already reloaded recently: let the error page show it
      throw error
    }
  })
}
