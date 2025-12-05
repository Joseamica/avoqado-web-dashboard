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
 * 2. If it fails, forces a page reload (only once to prevent infinite loops)
 * 3. The reload fetches the new HTML with updated chunk references
 *
 * Used by: Stripe, Vercel, and most production SPAs
 */

const RELOAD_KEY = 'chunk-reload-attempted'

function isChunkLoadError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('failed to fetch dynamically imported module') ||
      message.includes('loading chunk') ||
      message.includes('loading css chunk') ||
      message.includes('dynamically imported module')
    )
  }
  return false
}

export function lazyWithRetry<T extends ComponentType<unknown>>(
  componentImport: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    const hasReloaded = sessionStorage.getItem(RELOAD_KEY)

    try {
      const component = await componentImport()
      // Success - clear the reload flag for future navigations
      sessionStorage.removeItem(RELOAD_KEY)
      return component
    } catch (error) {
      if (isChunkLoadError(error) && !hasReloaded) {
        // Mark that we're attempting a reload to prevent infinite loops
        sessionStorage.setItem(RELOAD_KEY, 'true')
        // Force a full page reload to get the new chunks
        window.location.reload()
        // Return a promise that never resolves (page will reload)
        return new Promise(() => {})
      }
      // Re-throw if it's not a chunk error or we already tried reloading
      throw error
    }
  })
}
