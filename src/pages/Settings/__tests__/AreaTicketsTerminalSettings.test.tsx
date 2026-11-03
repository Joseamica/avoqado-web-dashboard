import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AreaTicketTerminal } from '@/services/areaTickets.service'

const svc = vi.hoisted(() => ({ updateAreaTicketTerminal: vi.fn(() => new Promise(() => {})) }))
vi.mock('@/services/areaTickets.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/areaTickets.service')>()),
  ...svc,
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

import { TerminalSettings } from '../AreaTickets'

const CAJA: AreaTicketTerminal = {
  id: 'terminal-caja',
  name: 'Caja 1',
  type: 'TABLET',
  status: 'ACTIVE',
  brand: null,
  model: null,
  deviceUid: null,
  fulfillmentAreaId: null,
  canIssueAreaTickets: false,
  canCheckoutAreaTickets: true,
  canDeliverAreaTickets: false,
  defaultWorkspace: 'AREA_OPERATIONS',
  scaleProfileId: null,
}

describe('TerminalSettings', () => {
  it('un doble clic antes de que la pantalla se redibuje manda un solo guardado', async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <TerminalSettings venueId="venue-1" terminals={[CAJA]} areas={[]} profiles={[]} onSaved={() => {}} />
      </QueryClientProvider>,
    )
    const emitir = screen.getByRole('switch', { name: 'Emitir vales' })
    // Los dos toques caen en el mismo turno: el segundo todavía ve el interruptor sin deshabilitar.
    act(() => {
      emitir.click()
      emitir.click()
    })
    await act(async () => {})
    expect(svc.updateAreaTicketTerminal).toHaveBeenCalledTimes(1)
    // Codex r5: mientras guarda, el área y la báscula tampoco se pueden cambiar (si no, el candado se tragaría el cambio).
    await waitFor(() => {
      for (const selector of screen.getAllByRole('combobox')) expect(selector).toBeDisabled()
    })
  })
})
