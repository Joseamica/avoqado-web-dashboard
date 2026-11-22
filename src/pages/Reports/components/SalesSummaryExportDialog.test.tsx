import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// Funciones normales, no vi.fn: `mockReset: true` vaciaría un vi.fn() del factory antes de cada prueba.
const h = vi.hoisted(() => ({ gets: [] as Array<{ url: string; params: Record<string, string> }>, detallado: true }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o && typeof o === 'object' ? `${k}(${Object.entries(o).filter(([a]) => a !== 'ns').map(([a, b]) => `${a}=${String(b)}`).join(',')})` : k,
  }),
}))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useTierFeatureAccess: () => ({ hasAccess: h.detallado }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))
vi.mock('@/hooks/use-export-run', () => ({ useExportRun: () => ({ status: undefined }), useExporteVivo: () => null }))
vi.mock('@/components/export-run-progress', () => ({ ExportRunProgress: () => null }))
vi.mock('@/services/exportRuns.service', () => ({ exportRunsService: { pedir: () => Promise.resolve({ kind: 'run', runId: 'r1' }) }, descargarBlob: () => {} }))
vi.mock('@/services/team.service', () => ({ teamService: { getTeamMembers: () => Promise.resolve({ data: [] }) } }))
vi.mock('@/api', () => ({
  default: {
    get: (url: string, cfg: { params: Record<string, string> }) => {
      h.gets.push({ url, params: cfg.params })
      return Promise.resolve({ data: new Blob(['x']) })
    },
  },
}))
// El selector de fechas real abre un calendario: aquí sólo dice qué fechas recibió.
vi.mock('@/components/date-range-picker', () => ({
  DateRangePicker: ({ initialDateFrom, initialDateTo }: { initialDateFrom: Date; initialDateTo: Date }) => (
    <span data-testid="rango">{`${initialDateFrom.toISOString()}→${initialDateTo.toISOString()}`}</span>
  ),
}))

import { SalesSummaryExportDialog } from './SalesSummaryExportDialog'

type Props = Parameters<typeof SalesSummaryExportDialog>[0]
const NOV_1 = { from: new Date('2026-11-01T06:00:00.000Z'), to: new Date('2026-11-08T05:59:59.999Z') }
const NOV_20 = { from: new Date('2026-11-20T06:00:00.000Z'), to: new Date('2026-11-21T05:59:59.999Z') }
const MERCHANTS = [
  { id: 'ma-a', displayName: 'Comercio A' },
  { id: 'ma-b', displayName: 'Comercio B' },
] as Props['merchantAccounts']

const base = (over: Partial<Props> = {}): Props => ({
  open: false,
  onClose: () => {},
  venueId: 'v1',
  initialDateFrom: NOV_1.from,
  initialDateTo: NOV_1.to,
  merchantAccounts: MERCHANTS,
  ...over,
})

function pintar(props: Props) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const envolver = (p: Props): ReactNode => (
    <QueryClientProvider client={client}>
      <SalesSummaryExportDialog {...p} />
    </QueryClientProvider>
  )
  const r = render(envolver(props))
  return { rerender: (p: Props) => r.rerender(envolver(p)) }
}

const exportar = () => fireEvent.click(screen.getByRole('button', { name: /salesSummary\.export\.button/ }))
const casilla = (texto: string) => screen.getByText(texto).closest('label')!.querySelector('button[role="checkbox"]') as HTMLElement

beforeEach(() => {
  h.gets = []
  h.detallado = true
})

describe('D13.1 · el diálogo de exportar trae lo que ves en la pantalla en CADA apertura', () => {
  it('🔴 abre con lo de la pantalla; cierras, cambias la pantalla y al volver a abrir trae lo nuevo', () => {
    const { rerender } = pintar(base())
    // Primera apertura: Tarjeta + Débito + Comercio B, del 1 al 7.
    rerender(base({ open: true, initialPaymentMethod: 'CARD', initialCardType: 'DEBIT', initialMerchantAccountId: 'ma-b' }))
    expect(screen.getByTestId('rango').textContent).toBe(`${NOV_1.from.toISOString()}→${NOV_1.to.toISOString()}`)
    expect(screen.getByText('salesSummary.export.filters.paymentMethodOptions.card')).toBeInTheDocument()
    expect(screen.getByText('salesSummary.export.filters.cardTypeOptions.debit')).toBeInTheDocument()
    expect(screen.getByText('Comercio B')).toBeInTheDocument()

    // Cierra; en la pantalla cambian a Efectivo, sin comercio, y al día 20.
    rerender(base({ open: false, initialPaymentMethod: 'CARD', initialCardType: 'DEBIT', initialMerchantAccountId: 'ma-b' }))
    rerender(base({ open: false, initialDateFrom: NOV_20.from, initialDateTo: NOV_20.to, initialPaymentMethod: 'CASH' }))
    rerender(base({ open: true, initialDateFrom: NOV_20.from, initialDateTo: NOV_20.to, initialPaymentMethod: 'CASH' }))

    expect(screen.getByTestId('rango').textContent).toBe(`${NOV_20.from.toISOString()}→${NOV_20.to.toISOString()}`)
    expect(screen.getByText('salesSummary.export.filters.paymentMethodOptions.cash')).toBeInTheDocument()
    expect(screen.queryByText('salesSummary.export.filters.cardTypeOptions.debit')).not.toBeInTheDocument()
    expect(screen.queryByText('Comercio B')).not.toBeInTheDocument()
  })

  it('lo que se pide al servidor es lo de la pantalla (fechas y filtros de la segunda apertura)', async () => {
    const { rerender } = pintar(base())
    rerender(base({ open: true, initialPaymentMethod: 'CARD', initialCardType: 'AMEX' }))
    rerender(base({ open: false }))
    rerender(base({ open: true, initialDateFrom: NOV_20.from, initialDateTo: NOV_20.to, initialMerchantAccountId: 'ma-a' }))
    exportar()
    await waitFor(() => expect(h.gets).toHaveLength(1))
    expect(h.gets[0].params).toMatchObject({
      mode: 'summary',
      startDate: NOV_20.from.toISOString(),
      endDate: NOV_20.to.toISOString(),
      merchantAccountId: 'ma-a',
    })
    expect(h.gets[0].params.paymentMethod).toBeUndefined()
    expect(h.gets[0].params.cardType).toBeUndefined()
  })

  it('la tarjeta de fechas tiene título (D13.7)', () => {
    pintar(base({ open: true }))
    expect(screen.getByText('salesSummary.export.dateRange.label')).toBeInTheDocument()
  })
})

describe('D13.2 · «Por periodo» lleva el tipo de informe de la pantalla', () => {
  it('🔴 manda reportType=hours si la pantalla está por horas, y lo dice', async () => {
    pintar(base({ open: true, reportType: 'hours' }))
    fireEvent.click(casilla('salesSummary.export.sections.byPeriod'))
    expect(
      screen.getByText('salesSummary.export.sections.byPeriodHint(type=salesSummary.controls.reportType.options.hours)'),
    ).toBeInTheDocument()
    exportar()
    await waitFor(() => expect(h.gets).toHaveLength(1))
    expect(h.gets[0].params.sections.split(',')).toContain('byPeriod')
    expect(h.gets[0].params.reportType).toBe('hours')
  })

  it('con la pantalla en «Resumen» va por día; sin «Por periodo» no manda reportType', async () => {
    pintar(base({ open: true, reportType: 'summary' }))
    exportar()
    await waitFor(() => expect(h.gets).toHaveLength(1))
    expect(h.gets[0].params.reportType).toBeUndefined()
    fireEvent.click(casilla('salesSummary.export.sections.byPeriod'))
    expect(screen.getByText('salesSummary.export.sections.byPeriodDefaultHint')).toBeInTheDocument()
    exportar()
    await waitFor(() => expect(h.gets).toHaveLength(2))
    expect(h.gets[1].params.reportType).toBe('days')
  })
})

describe('D13.5 / D13.6 · secciones', () => {
  it('🔴 sin ninguna sección el botón se apaga y dice por qué', () => {
    pintar(base({ open: true }))
    fireEvent.click(casilla('salesSummary.export.sections.totals'))
    fireEvent.click(casilla('salesSummary.export.sections.paymentMethods'))
    expect(screen.getByRole('button', { name: /salesSummary\.export\.button/ })).toBeDisabled()
    expect(screen.getByText('salesSummary.export.sections.noneSelected')).toBeInTheDocument()
  })

  it('con un filtro de método, el desglose por método se apaga: marcarlo solo no deja exportar un archivo vacío', () => {
    pintar(base({ open: true, initialPaymentMethod: 'CASH' }))
    fireEvent.click(casilla('salesSummary.export.sections.totals')) // queda sólo «Desglose por método de pago», que sale vacío
    expect(screen.getByText('salesSummary.export.sections.paymentMethodsDisabledHint')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /salesSummary\.export\.button/ })).toBeDisabled()
  })

  it('«Estado del periodo» se puede exportar', async () => {
    pintar(base({ open: true }))
    fireEvent.click(casilla('salesSummary.export.sections.statement'))
    exportar()
    await waitFor(() => expect(h.gets).toHaveLength(1))
    expect(h.gets[0].params.sections.split(',')).toContain('statement')
  })
})

describe('QR anterior (Mindform)', () => {
  it('se nombra en el filtro y apaga «Transacciones detalladas» con su razón', () => {
    pintar(base({ open: true, initialPaymentMethod: 'QR_LEGACY' }))
    expect(screen.getByText('salesSummary.export.filters.paymentMethodOptions.qr_legacy')).toBeInTheDocument()
    expect(screen.getByText('salesSummary.export.mode.detailedQrHint')).toBeInTheDocument()
    expect(document.getElementById('mode-detailed')).toBeDisabled()
  })
})
