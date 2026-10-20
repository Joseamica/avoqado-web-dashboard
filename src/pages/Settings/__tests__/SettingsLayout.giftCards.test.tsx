import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Dos señales de marca blanca que NO salen del mismo lado: `useAccess` lee `/access` (whiteLabelEnabled) y el menú lateral
// lee el módulo WHITE_LABEL_DASHBOARD de la sede (`useWhiteLabelConfig`). La entrada de tarjetas debe seguir al menú.
const h = vi.hoisted(() => ({ accessWL: false, moduleWL: false }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ fullBasePath: '/venues/demo' }) }))
vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({ can: () => true, role: 'OWNER', isWhiteLabelEnabled: h.accessWL, canFeature: () => true }),
}))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useVenueTier: () => ({ hasFeatureAccess: () => true }) }))
vi.mock('@/hooks/useWhiteLabelConfig', () => ({ useWhiteLabelConfig: () => ({ isWhiteLabelEnabled: h.moduleWL }) }))

import SettingsLayout from '../SettingsLayout'

const entrada = () => document.querySelector('[data-tour="settings-nav-gift-cards"]')
const pintar = () =>
  render(
    <MemoryRouter>
      <SettingsLayout />
    </MemoryRouter>,
  )

beforeEach(() => {
  h.accessWL = false
  h.moduleWL = false
})

describe('hub de Ajustes · entrada de tarjetas y marca blanca (lote ⭐)', () => {
  it('fuera de marca blanca, la entrada se ve', () => {
    pintar()
    expect(entrada()).not.toBeNull()
  })

  it('🔴 con el módulo de marca blanca (la señal del menú), la entrada se esconde aunque `/access` diga que no', () => {
    h.moduleWL = true
    pintar()
    expect(entrada()).toBeNull()
    expect(screen.queryByText('hub.items.giftCards')).not.toBeInTheDocument()
  })

  it('🔴 si sólo `/access` dice marca blanca y el menú no, la entrada se ve igual que en el menú', () => {
    h.accessWL = true
    pintar()
    expect(entrada()).not.toBeNull()
  })
})
