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
 * Note: Uses 30s timeout because backend needs time to create and seed demo venue
 *
 * @returns Promise that resolves when auto-login completes
 */
export async function liveDemoAutoLogin(): Promise<void> {
  try {
    // Increase timeout to 30s to allow backend to seed demo venue
    await api.get('/api/v1/live-demo/auto-login', {
      timeout: 30000, // 30 seconds
    })
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
