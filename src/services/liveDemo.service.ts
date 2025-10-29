/**
 * Live Demo Service
 *
 * Handles auto-login for demo.dashboard.avoqado.io
 */

import api from '@/api'

/**
 * Auto-login for live demo
 * Creates or retrieves a live demo session
 *
 * @returns Promise that resolves when auto-login completes
 */
export async function liveDemoAutoLogin(): Promise<void> {
  try {
    await api.get('/live-demo/auto-login')
  } catch (error) {
    console.error('Live demo auto-login failed:', error)
    throw error
  }
}

/**
 * Check if current environment is live demo
 *
 * @returns True if on demo.dashboard.avoqado.io
 */
export function isLiveDemoEnvironment(): boolean {
  return window.location.hostname === 'demo.dashboard.avoqado.io'
}
