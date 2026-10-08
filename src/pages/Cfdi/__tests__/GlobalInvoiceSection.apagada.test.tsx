/**
 * C1 · ola final, punto 6 — la tarjeta del RFC en «Factura global» con la global APAGADA (principio del founder: «apagado se VE y se
 * EXPLICA»). Es el caso de Testarudo al publicar: un RFC, 0 comercios en la global y el interruptor de ventas fuera de la terminal apagado.
 * Con la tarjeta, el panel y los hooks REALES (sólo el servicio es falso): si la tarjeta ofreciera «Generar factura global ahora», su aviso
 * diría «3,941 ventas no entraron» de un periodo que nadie pidió emitir.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import es from '@/locales/es/cfdi.json'
import type { Emisor, PeriodoDeLaGlobal } from '@/services/cfdi.service'

const traducir = (key: string, opts?: Record<string, unknown>) => {
  const raw = key.split('.').reduce<any>((o, k) => o?.[k], es as any)
  if (typeof raw !== 'string') return key
  return raw.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(opts?.[k] ?? ''))
}
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: traducir, i18n: { language: 'es' } }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
// Los diálogos de la global van de verdad (cerrados); su fecha del negocio no importa aquí.
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (d: string) => d, formatDateTime: (d: string) => d }) }))

const m = vi.hoisted(() => ({ getGlobalPeriodos: vi.fn(), toast: vi.fn() }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/services/cfdi.service', () => ({ default: { getGlobalPeriodos: m.getGlobalPeriodos } }))

import { GlobalInvoiceSection } from '../CfdiConfiguracion'

const g = es.globalInvoice
const emisor = { id: 'e1', legalName: 'Café Testarudo', rfc: 'ABC123456T1A', csdStatus: 'ACTIVE', globalPeriodicity: 'MENSUAL' } as Emisor
const SEPTIEMBRE: PeriodoDeLaGlobal = {
  desde: '2026-09-01T06:00:00.000Z',
  hasta: '2026-10-01T06:00:00.000Z',
  meses: '09',
  anio: 2026,
  estado: 'SIN_GLOBAL',
  cfdiId: null,
  folio: null,
  motivo: null,
  corregidasPendientes: null,
  complementarias: [],
}
const respuesta = (extra: Record<string, unknown> = {}) => ({
  periodos: [SEPTIEMBRE],
  otrasPeriodicidades: { globales: [], completo: true },
  ...extra,
})

function pintar(live = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <GlobalInvoiceSection emisores={[emisor]} live={live} />
    </QueryClientProvider>,
  )
}
const unRato = () => new Promise(r => setTimeout(r, 50))

describe('GlobalInvoiceSection · la global apagada para un RFC (ola final, punto 6)', () => {
  it('🔴 con `globalApagada: true` la tarjeta NO ofrece «Generar factura global ahora» ni «Emitir»: dice que está apagada y cómo prenderla', async () => {
    m.getGlobalPeriodos.mockResolvedValue(respuesta({ globalApagada: true }))
    pintar()
    await waitFor(() => expect(screen.queryByTestId('global-apagada')).toBeInTheDocument())
    expect(screen.getByTestId('global-apagada')).toHaveTextContent(g.off.howToTurnOn)
    expect(screen.queryByRole('button', { name: g.trigger })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: g.periods.issue })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: g.excluded.see })).not.toBeInTheDocument()
    // La tarjeta y el panel leen la MISMA consulta: una sola llamada al servidor.
    await unRato()
    expect(m.getGlobalPeriodos).toHaveBeenCalledTimes(1)
  })

  it('control — sin el campo (servidor anterior) la tarjeta es la de siempre: «Generar…», el periodo con «Emitir», y una sola llamada', async () => {
    m.getGlobalPeriodos.mockResolvedValue(respuesta())
    pintar()
    await screen.findByRole('button', { name: g.periods.issue })
    expect(screen.getByRole('button', { name: g.trigger })).toBeInTheDocument()
    expect(screen.queryByTestId('global-apagada')).not.toBeInTheDocument()
    await unRato()
    expect(m.getGlobalPeriodos).toHaveBeenCalledTimes(1)
  })

  it('control — con `globalApagada: false` la tarjeta es la de siempre', async () => {
    m.getGlobalPeriodos.mockResolvedValue(respuesta({ globalApagada: false }))
    pintar()
    await screen.findByRole('button', { name: g.periods.issue })
    expect(screen.getByRole('button', { name: g.trigger })).toBeInTheDocument()
  })

  it('control — detrás del candado (sin la función CFDI, `live: false`) no se pide nada y el botón se ve como siempre', async () => {
    pintar(false)
    await unRato()
    expect(m.getGlobalPeriodos).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: g.trigger })).toBeInTheDocument()
  })
})
