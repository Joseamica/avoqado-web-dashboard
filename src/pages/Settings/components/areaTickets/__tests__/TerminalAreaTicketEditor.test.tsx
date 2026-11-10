import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AreaTicketTerminal, FulfillmentArea } from '@/services/areaTickets.service'

const svc = vi.hoisted(() => ({ updateAreaTicketTerminal: vi.fn() }))
const toast = vi.hoisted(() => vi.fn())
vi.mock('@/services/areaTickets.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/areaTickets.service')>()),
  ...svc,
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

import { TerminalAreaTicketEditor } from '../TerminalAreaTicketEditor'

const TERMINAL: AreaTicketTerminal = {
  id: 'terminal-1',
  name: 'Caja 1',
  type: 'TABLET',
  status: 'ACTIVE',
  brand: null,
  model: null,
  deviceUid: null,
  fulfillmentAreaId: null,
  canIssueAreaTickets: true,
  canCheckoutAreaTickets: false,
  canDeliverAreaTickets: false,
  defaultWorkspace: 'AREA_OPERATIONS',
  scaleProfileId: null,
}
const AREAS = [{ id: 'area-1', name: 'Cremería', active: true }] as unknown as FulfillmentArea[]

function setup(showScale = true) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const spy = vi.spyOn(client, 'invalidateQueries')
  render(
    <QueryClientProvider client={client}>
      <TerminalAreaTicketEditor venueId="venue-1" terminal={TERMINAL} areas={AREAS} profiles={[]} showScale={showScale} />
    </QueryClientProvider>,
  )
  return spy
}

describe('TerminalAreaTicketEditor', () => {
  beforeEach(() => {
    toast.mockClear()
    svc.updateAreaTicketTerminal.mockReset().mockResolvedValue(TERMINAL)
  })

  it('cambiar el área llama updateAreaTicketTerminal con fulfillmentAreaId', async () => {
    setup()
    fireEvent.click(screen.getAllByRole('combobox')[0])
    fireEvent.click(await screen.findByRole('option', { name: 'Cremería' }))
    await waitFor(() =>
      expect(svc.updateAreaTicketTerminal).toHaveBeenCalledWith('venue-1', 'terminal-1', { fulfillmentAreaId: 'area-1' }),
    )
  })

  it('prender Cobrar con Emitir prendido avisa que se apagó Emitir', async () => {
    setup()
    await act(async () => screen.getByRole('switch', { name: 'Cobrar vales' }).click())
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'areaTickets.terminals.turnedOffIssue' })),
    )
  })

  it('al guardar invalida tpvs, tpv, area-ticket-overview y printRouting', async () => {
    const spy = setup()
    await act(async () => screen.getByRole('switch', { name: 'Entregar' }).click())
    await waitFor(() => expect(svc.updateAreaTicketTerminal).toHaveBeenCalled())
    await waitFor(() => {
      const keys = spy.mock.calls.map(c => (c[0] as { queryKey: unknown[] }).queryKey)
      expect(keys).toEqual(
        expect.arrayContaining([
          ['area-ticket-overview', 'venue-1'],
          ['tpvs', 'venue-1'],
          ['tpv', 'venue-1', 'terminal-1'],
          ['printRouting', 'venue-1'],
        ]),
      )
    })
  })

  it('showScale=false no muestra la báscula', () => {
    setup(false)
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
  })
})
