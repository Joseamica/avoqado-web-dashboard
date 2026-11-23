// Máquina de efectivo · fase 1a (Codex r1 #7, r2 #8): el gerente lee una incidencia que no es duda y la marca como revisada con una
// nota y la `version` de la evidencia que vio. Si llegó evidencia nueva (409 CASH_MACHINE_INCIDENT_CHANGED), lo dice, refresca la
// lista y no deja mandar la versión vieja otra vez.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Currency } from '@/utils/currency'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, o?: Record<string, unknown>) => (o ? `${key}${JSON.stringify(o)}` : key) }),
}))
const h = vi.hoisted(() => ({
  impl: (..._a: unknown[]): Promise<unknown> => Promise.resolve({ status: 200, data: {} }),
  calls: [] as unknown[][],
  toast: vi.fn(),
}))
vi.mock('@/api', () => ({
  default: {
    post: (...a: unknown[]) => {
      h.calls.push(a)
      return h.impl(...a)
    },
  },
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ venueTimezone: 'America/Mexico_City', formatDateTime: (d: string) => `FECHA(${d})` }),
}))

import { ReviewCashMachineIncidentDialog, type CashMachineIncident } from './ReviewCashMachineIncidentDialog'

const FOLIO = 'AQ0000000000B2'
const incidencia = (extra: Partial<CashMachineIncident> = {}): CashMachineIncident => ({
  id: 'cinc000000000000000000001',
  referenceCC: FOLIO,
  kind: 'IMPOSIBLE',
  status: 'ABIERTO',
  deviceId: 'd1',
  createdAt: '2026-11-20T19:00:00.000Z',
  veces: 3,
  repetidas: 1,
  version: 2,
  primerEvento: {
    recibidoEn: '2026-11-20T19:00:00.000Z',
    cierre: { outcome: 'CANCELADO', creditCents: 5000, changeDispensedCents: 7000 },
  },
  ultimoEvento: { recibidoEn: '2026-11-20T19:05:00.000Z', motivo: 'OTRA_PC', evidence: 'pantalla en error' },
  revisiones: [{ nota: 'revisé el corte', en: '2026-11-19T10:00:00.000Z', version: 1 }],
  ...extra,
})

const P = 'cashMachineDoubts.incidents.'
const texto = () => document.body.textContent ?? ''
const nota = (v: string) => fireEvent.change(screen.getByLabelText(`${P}note`), { target: { value: v } })
const marcar = () => screen.getByRole('button', { name: `${P}markReviewed` })

function setup(inc = incidencia()) {
  const onOpenChange = vi.fn()
  const client = new QueryClient()
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const ui = (i: CashMachineIncident) => (
    <QueryClientProvider client={client}>
      <ReviewCashMachineIncidentDialog open onOpenChange={onOpenChange} venueId="v1" incident={i} />
    </QueryClientProvider>
  )
  const r = render(ui(inc))
  return { onOpenChange, invalidate, rerender: (i: CashMachineIncident) => r.rerender(ui(i)) }
}

describe('ReviewCashMachineIncidentDialog', () => {
  beforeEach(() => {
    h.calls.length = 0
    h.toast.mockReset()
    h.impl = () => Promise.resolve({ status: 200, data: { success: true, status: 'RESUELTO', version: 2 } })
  })

  it('enseña el tipo, cuántas veces llegó, la evidencia y las revisiones anteriores (sólo lectura)', () => {
    setup()
    expect(texto()).toContain(`${P}kinds.IMPOSIBLE.label`)
    expect(texto()).toContain(`${P}times${JSON.stringify({ count: 3 })}`)
    expect(texto()).toContain(`${P}repeated${JSON.stringify({ count: 1 })}`)
    expect(texto()).toContain('cashMachineDoubts.resolve.outcomes.CANCELADO.label')
    expect(texto()).toContain(Currency(50))
    expect(texto()).toContain(Currency(70))
    expect(texto()).toContain(`${P}reason${JSON.stringify({ reason: 'OTRA_PC' })}`)
    expect(texto()).toContain('pantalla en error')
    expect(texto()).toContain('revisé el corte')
  })

  it('no deja marcar sin nota; manda la nota y la versión que vio, refresca y cierra', async () => {
    const { onOpenChange, invalidate } = setup()
    expect(marcar()).toBeDisabled()
    nota('   ')
    expect(marcar()).toBeDisabled()
    nota('  revisé la máquina  ')
    fireEvent.click(marcar())
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(h.calls).toHaveLength(1)
    const [url, body] = h.calls[0]
    expect(url).toBe('/api/v1/dashboard/venues/v1/cash-machine/incidents/cinc000000000000000000001/review')
    expect(body).toEqual({ note: 'revisé la máquina', version: 2 })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['cash-machine-doubts', 'v1'] })
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: `${P}reviewed${JSON.stringify({ folio: FOLIO })}` }))
  })

  it('409 CASH_MACHINE_INCIDENT_CHANGED: dice «llegó evidencia nueva», refresca y sólo deja mandar la versión NUEVA', async () => {
    h.impl = () =>
      Promise.reject(
        Object.assign(new Error('409'), {
          response: {
            status: 409,
            data: { message: 'Llegó evidencia nueva…', code: 'CASH_MACHINE_INCIDENT_CHANGED', details: { version: 3 } },
          },
        }),
      )
    const { onOpenChange, invalidate, rerender } = setup()
    nota('revisé')
    fireEvent.click(marcar())
    expect(await screen.findByRole('alert')).toHaveTextContent(`${P}changed`)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['cash-machine-doubts', 'v1'] })
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    await waitFor(() => expect(marcar()).toBeDisabled()) // con la versión vieja no se vuelve a mandar

    // La lista refrescada trae la evidencia nueva (versión 3): se puede marcar, con esa versión y la nota que ya escribió.
    h.impl = () => Promise.resolve({ status: 200, data: { success: true, status: 'RESUELTO', version: 3 } })
    rerender(incidencia({ version: 3, ultimoEvento: { evidence: 'evidencia nueva' } }))
    expect(texto()).toContain('evidencia nueva')
    expect(marcar()).toBeEnabled()
    fireEvent.click(marcar())
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(h.calls).toHaveLength(2)
    expect(h.calls[1][1]).toEqual({ note: 'revisé', version: 3 })
  })

  it('otro error enseña el mensaje del SERVIDOR', async () => {
    h.impl = () =>
      Promise.reject(
        Object.assign(new Error('404'), {
          response: { status: 404, data: { message: 'Esa incidencia de la máquina no existe en este negocio.' } },
        }),
      )
    setup()
    nota('revisé')
    fireEvent.click(marcar())
    expect(await screen.findByRole('alert')).toHaveTextContent('Esa incidencia de la máquina no existe en este negocio.')
    expect(marcar()).toBeEnabled()
  })

  it('dos clics seguidos mandan UNA sola revisión', async () => {
    setup()
    nota('revisé')
    fireEvent.click(marcar())
    fireEvent.click(marcar())
    await waitFor(() => expect(h.toast).toHaveBeenCalled())
    expect(h.calls).toHaveLength(1)
  })
})
