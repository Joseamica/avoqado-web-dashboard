/**
 * useViewMode - Manage switching between traditional and white-label dashboard views
 *
 * Provides functionality to:
 * - Detect current view mode from URL
 * - Switch between traditional (/venues/:slug) and white-label (/wl/venues/:slug) views
 * - Check if white-label mode is available for the current venue
 *
 * @example
 * const { currentMode, hasWhiteLabel, switchView } = useViewMode()
 *
 * <Button onClick={() => switchView('whitelabel')}>
 *   Switch to White-Label View
 * </Button>
 */

import { useNavigate, useLocation } from 'react-router-dom'
import { useCurrentVenue } from './use-current-venue'

export type ViewMode = 'traditional' | 'whitelabel'

export const useViewMode = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { venue, venueSlug } = useCurrentVenue()

  // Detect current mode from URL
  // White-label: /wl/venues/:slug/* or /wl/organizations/:slug/*
  // Traditional: /venues/:slug/* or /organizations/:slug/*
  const currentMode: ViewMode = location.pathname.startsWith('/wl/') ? 'whitelabel' : 'traditional'

  // Check if white-label is available for current venue
  const hasWhiteLabel = venue?.modules?.some(m => m.module.code === 'WHITE_LABEL_DASHBOARD' && m.enabled) ?? false

  /**
   * Switch between traditional and white-label views
   * Preserves the current page path (e.g., /home, /settings, etc.)
   */
  const switchView = (targetMode: ViewMode) => {
    if (!venueSlug) return

    const currentPath = location.pathname

    if (targetMode === 'whitelabel' && currentMode === 'traditional') {
      // /venues/slug/page → /wl/venues/slug/page
      const newPath = currentPath.replace(/^\/venues\//, '/wl/venues/')
      navigate(newPath, { replace: true })
    } else if (targetMode === 'traditional' && currentMode === 'whitelabel') {
      // /wl/venues/slug/page → /venues/slug/page
      const newPath = currentPath.replace(/^\/wl\/venues\//, '/venues/')
      navigate(newPath, { replace: true })
    }
  }

  return {
    currentMode,
    hasWhiteLabel,
    switchView,
    canSwitchView: hasWhiteLabel,
  }
}
