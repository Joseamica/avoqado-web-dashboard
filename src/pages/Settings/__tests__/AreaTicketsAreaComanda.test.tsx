/**
 * D2 de vales (La Galeterie, 3-nov-2026): cada área trae «Comanda». Apagada, la PC que emite vales de esa área saca sólo
 * el vale. Un área de un SERVIDOR viejo (sin el campo) se ve prendida: así funciona hoy.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FulfillmentArea } from '@/services/areaTickets.service'

const svc = vi.hoisted(() => ({ updateFulfillmentArea: vi.fn(() => new Promise(() => {})) }))
vi.mock('@/services/areaTickets.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/areaTickets.service')>()),
  ...svc,
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, string>) => (o?.area ? `${k}:${o.area}` : k) }),
}))
vi.mock('@/pages/Settings/components/ExternalRouteAreaCard', () => ({ ExternalRouteAreaCard: () => null }))

import { AreasSettings } from '../AreaTickets'

const AREA = (sendsComanda?: boolean): FulfillmentArea =>
  ({
    id: 'area-cremeria',
    name: 'Cremería',
    fulfillmentMode: 'HOLD_UNTIL_PAID',
    printStationId: null,
    active: true,
    displayOrder: 0,
    settlementRoute: 'AVOQADO',
    externalConfirmationMode: 'MANUAL',
    externalOfflinePolicy: 'BLOCK',
    externalDeliveryTracking: 'TRACKED',
    ...(sendsComanda === undefined ? {} : { sendsComanda }),
  }) as FulfillmentArea

function pintar(area: FulfillmentArea) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AreasSettings venueId="venue-1" fullBasePath="/venues/v" areas={[area]} onSaved={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AreasSettings · Comanda (D2)', () => {
  beforeEach(() => {
    // Con llaves: vitest toma una función devuelta como limpieza, y el mock devuelto se quedaba esperando.
    svc.updateFulfillmentArea.mockClear()
  })

  it('con un SERVIDOR que no trae el campo, la columna no sale (no se podría guardar)', () => {
    pintar(AREA())
    expect(screen.queryByRole('switch', { name: 'areaTickets.areas.comandaFor:Cremería' })).not.toBeInTheDocument()
    expect(screen.queryByText('areaTickets.areas.comandaHeader')).not.toBeInTheDocument()
  })

  it('prendida dice que manda comanda', () => {
    pintar(AREA(true))
    expect(screen.getByRole('switch', { name: 'areaTickets.areas.comandaFor:Cremería' })).toBeChecked()
    expect(screen.getByText('areaTickets.areas.comandaOn')).toBeInTheDocument()
  })

  it('apagada dice que sólo sale el vale', () => {
    pintar(AREA(false))
    expect(screen.getByRole('switch', { name: 'areaTickets.areas.comandaFor:Cremería' })).not.toBeChecked()
    expect(screen.getByText('areaTickets.areas.comandaOff')).toBeInTheDocument()
  })

  it('apagarla manda sólo ese campo, una vez aunque le den doble clic, y bloquea mientras guarda', async () => {
    pintar(AREA(true))
    const interruptor = screen.getByRole('switch', { name: 'areaTickets.areas.comandaFor:Cremería' })
    act(() => {
      interruptor.click()
      interruptor.click()
    })
    await act(async () => {})
    expect(svc.updateFulfillmentArea).toHaveBeenCalledTimes(1)
    expect(svc.updateFulfillmentArea).toHaveBeenCalledWith('venue-1', 'area-cremeria', { sendsComanda: false })
    await waitFor(() => expect(interruptor).toBeDisabled())
  })
})
