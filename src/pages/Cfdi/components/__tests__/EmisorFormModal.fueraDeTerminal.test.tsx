/**
 * C1 · Tarea 13, ronda 2 — el interruptor del founder (T10): «Incluir en la factura global las ventas cobradas fuera de la terminal».
 * Apagado de fábrica; se lee y se guarda con `includeOffTerminalSalesInGlobal`. Y el residual de la re-revisión: un 400 sin texto del
 * servidor nunca enseña el «Request failed…» de axios.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import es from '@/locales/es/cfdi.json'
import en from '@/locales/en/cfdi.json'
import type { Emisor } from '@/services/cfdi.service'

const traducir = (key: string, opts?: Record<string, unknown>) => {
  const raw = key.split('.').reduce<any>((o, k) => o?.[k], es as any)
  if (typeof raw !== 'string') return key
  return raw.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(opts?.[k] ?? ''))
}
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: traducir, i18n: { language: 'es' } }),
}))

const m = vi.hoisted(() => ({ mutate: vi.fn() }))
vi.mock('@/hooks/use-cfdi', () => ({ useUpsertEmisor: () => ({ mutate: m.mutate, isPending: false }) }))
vi.mock('@/components/ui/select', () => import('@/test/nativeSelectShim'))

import { EmisorFormModal } from '../EmisorFormModal'

const f = es.emisorForm
const emisor = (over: Partial<Emisor> = {}): Emisor => ({
  id: 'e1',
  venueId: 'v1',
  rfc: 'ABC123456T1A',
  legalName: 'Café Testarudo',
  regimenFiscal: '601',
  lugarExpedicion: '06000',
  provider: 'FACTURAPI',
  providerOrgId: null,
  csdStatus: 'ACTIVE',
  csdExpiresAt: null,
  csdLastCheckedAt: null,
  serie: 'A',
  defaultUsoCfdi: 'G03',
  globalPeriodicity: 'MENSUAL',
  invoiceCashSales: false,
  includeCashInAccounting: false,
  isnRate: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
})
const interruptor = () => screen.getByRole('switch', { name: f.includeOffTerminalSalesInGlobal })
const guardar = () => fireEvent.click(screen.getByRole('button', { name: f.save }))

describe('EmisorFormModal · ventas fuera de la terminal en la global (ronda 2)', () => {
  it('🔴 un emisor sin el campo (servidor viejo) lo ve APAGADO, con la pista; al prenderlo y guardar manda `true`', async () => {
    render(<EmisorFormModal open emisor={emisor()} onClose={() => {}} />)
    expect(interruptor()).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText(f.includeOffTerminalSalesInGlobalHint)).toBeInTheDocument()
    fireEvent.click(interruptor())
    guardar()
    await waitFor(() => expect(m.mutate).toHaveBeenCalled())
    expect(m.mutate.mock.calls[0][0]).toMatchObject({ emisorId: 'e1', data: { includeOffTerminalSalesInGlobal: true } })
  })

  it('🔴 un emisor que ya lo tiene prendido lo ve prendido, y guardar sin tocarlo lo conserva', async () => {
    render(<EmisorFormModal open emisor={emisor({ includeOffTerminalSalesInGlobal: true })} onClose={() => {}} />)
    expect(interruptor()).toHaveAttribute('aria-checked', 'true')
    guardar()
    await waitFor(() => expect(m.mutate).toHaveBeenCalled())
    expect(m.mutate.mock.calls[0][0].data.includeOffTerminalSalesInGlobal).toBe(true)
  })

  it('🔴 un alta nueva sale APAGADA (lo de fábrica)', async () => {
    render(<EmisorFormModal open emisor={null} onClose={() => {}} />)
    expect(interruptor()).toHaveAttribute('aria-checked', 'false')
  })

  it('🔴 M1 (ola final): la pista de «Facturar ventas en efectivo» dice que el efectivo cobrado sin terminal ADEMÁS necesita el interruptor nuevo', () => {
    render(<EmisorFormModal open emisor={emisor()} onClose={() => {}} />)
    expect(screen.getByText(f.invoiceCashSalesHint)).toBeInTheDocument()
    // Atada a la etiqueta REAL del interruptor (sin el paréntesis), para que no se separen si una cambia.
    const corta = (etiqueta: string) => etiqueta.split(' (')[0]
    expect(f.invoiceCashSalesHint).toContain(`«${corta(f.includeOffTerminalSalesInGlobal)}»`)
    expect(en.emisorForm.invoiceCashSalesHint).toContain(`"${corta(en.emisorForm.includeOffTerminalSalesInGlobal)}"`)
  })

  it('🔴 residual (re-revisión O1): un 400 sin texto del servidor dice el texto de la pantalla, nunca «Request failed…»', async () => {
    m.mutate.mockImplementation((_vars: unknown, opts: any) =>
      opts?.onError?.({ response: { status: 400, data: '<html>Bad Request</html>' }, message: 'Request failed with status code 400' }),
    )
    render(<EmisorFormModal open emisor={emisor()} onClose={() => {}} />)
    guardar()
    expect(await screen.findByText(f.saveError)).toBeInTheDocument()
    expect(screen.queryByText(/Request failed/)).not.toBeInTheDocument()
  })
})
