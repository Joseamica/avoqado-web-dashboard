import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { BancosEmptyState } from './BancosEmptyState'

// i18n: echo key — convención del repo (ver BankConnectWizard.test.tsx).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

// El wizard embebido no es el sujeto de este test; lo stubbeamos.
vi.mock('@/pages/Venue/components/BankConnectWizard', () => ({
  BankConnectWizard: () => null,
}))

// useCurrentVenue lee contexto/params de venue que no montamos aquí.
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/test' }),
}))

function renderEmpty(hasProviders: boolean, pendingReconnect = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BancosEmptyState venueId="v1" hasProviders={hasProviders} pendingReconnect={pendingReconnect} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('BancosEmptyState', () => {
  it('con proveedores disponibles: muestra el CTA de conectar', () => {
    renderEmpty(true)
    expect(screen.getByText('hub.empty.description')).toBeInTheDocument()
    expect(screen.getByText('hub.empty.connectCta')).toBeInTheDocument()
  })

  it('sin proveedores sembrados: muestra el mensaje "no disponibles" y NO el CTA', () => {
    renderEmpty(false)
    expect(screen.getByText('hub.empty.noProviders')).toBeInTheDocument()
    expect(screen.queryByText('hub.empty.connectCta')).not.toBeInTheDocument()
  })

  it('conexión pendiente (reauth): muestra CTA de reconectar, NO el de conectar nuevo', () => {
    renderEmpty(true, true)
    expect(screen.getByText('hub.empty.pendingTitle')).toBeInTheDocument()
    expect(screen.getByText('hub.empty.goToResumen')).toBeInTheDocument()
    expect(screen.queryByText('hub.empty.connectCta')).not.toBeInTheDocument()
  })
})
