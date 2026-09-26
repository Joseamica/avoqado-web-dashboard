/**
 * En Home el aviso naranja «activa tus cobros» repetía lo que dice la tarjeta «Activa tus cobros» justo
 * debajo (founder, 26-sep). Home lo oculta; «en revisión» y «rechazado» siguen saliendo: dicen otra cosa.
 */
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let venue: Record<string, unknown> = {}
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ activeVenue: venue }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useLocation: () => ({ pathname: '/venues/x/home' }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

import { KYCStatusBanner } from '../KYCStatusBanner'

beforeEach(() => {
  venue = { slug: 'x', status: 'ACTIVE', kycStatus: 'NOT_SUBMITTED' }
})

describe('KYCStatusBanner', () => {
  it('por defecto (fuera de Home) sigue mostrando «activa tus cobros»', () => {
    render(<KYCStatusBanner />)
    expect(screen.getByText('banner.missing.message')).toBeInTheDocument()
  })

  it('🔴 en Home (sinAvisoDeEnvio) NO repite «activa tus cobros»: ya lo dice la tarjeta', () => {
    render(<KYCStatusBanner sinAvisoDeEnvio />)
    expect(screen.queryByText('banner.missing.message')).not.toBeInTheDocument()
  })

  it('«en revisión» y «rechazado» se siguen mostrando aunque se oculte el aviso de envío', () => {
    venue = { ...venue, kycStatus: 'PENDING_REVIEW' }
    const { unmount } = render(<KYCStatusBanner sinAvisoDeEnvio />)
    expect(screen.getByText('banner.pending.message')).toBeInTheDocument()
    unmount()
    venue = { ...venue, kycStatus: 'REJECTED' }
    render(<KYCStatusBanner sinAvisoDeEnvio />)
    expect(screen.getByText('banner.rejected.message')).toBeInTheDocument()
  })
})
