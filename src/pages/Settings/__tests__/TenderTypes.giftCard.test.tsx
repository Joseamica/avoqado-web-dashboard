import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TenderType } from '@/services/tenderType.service'

const svc = vi.hoisted(() => ({
  listTenderTypes: vi.fn(),
  getTenderCommissions: vi.fn(),
  createTenderType: vi.fn(),
  updateTenderType: vi.fn(),
}))
vi.mock('@/services/tenderType.service', () => svc)
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/demo' }) }))

import TenderTypes from '../TenderTypes'

const base: Omit<TenderType, 'id' | 'name' | 'baseMethod' | 'isSystem' | 'satFormaPago'> = {
  venueId: 'v1',
  normalizedName: '',
  countsAsPhysicalCash: false,
  captureTip: true,
  showOnPos: true,
  posSection: 'MORE',
  displayOrder: 0,
  commissionPercent: null,
  linkedOrderSource: null,
  active: true,
  revision: 1,
  createdAt: '',
  updatedAt: '',
}
const REGALO: TenderType = {
  ...base,
  id: 't-gift',
  name: 'Tarjeta de regalo',
  baseMethod: 'OTHER',
  isSystem: true,
  showOnPos: false,
  satFormaPago: '01',
  systemKind: 'GIFT_CARD',
}
const UBER: TenderType = {
  ...base,
  id: 't-uber',
  name: 'Uber Eats',
  baseMethod: 'OTHER',
  isSystem: false,
  satFormaPago: null,
  systemKind: null,
}

function pintar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <TenderTypes />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  svc.listTenderTypes.mockResolvedValue([UBER, REGALO])
  svc.getTenderCommissions.mockResolvedValue({ rows: [], totalGross: 0, totalCommission: 0, totalNet: 0 })
})

describe('Tipos de pago — tender de sistema «Tarjeta de regalo» (R4, spec §6)', () => {
  it('se ve encendido, con su explicación, y su switch no se puede mover', async () => {
    pintar()
    const fijo = await screen.findByRole('switch', { name: 'giftCardTender.alwaysOn' })
    expect(fijo).toBeChecked()
    expect(fijo).toBeDisabled()
    expect(screen.getByText('badges.giftCard')).toBeInTheDocument()
    expect(screen.getByText('giftCardTender.hint')).toBeInTheDocument()
    fireEvent.click(fijo)
    expect(svc.updateTenderType).not.toHaveBeenCalled()
  })

  it('no tiene lápiz de editar; los tipos del negocio siguen igual', async () => {
    pintar()
    await screen.findByText('Tarjeta de regalo')
    expect(screen.getAllByRole('button', { name: 'form.editTitle' })).toHaveLength(1)
    expect(screen.getByRole('switch', { name: 'Uber Eats' })).toBeEnabled()
  })
})
