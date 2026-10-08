/**
 * C1 · Tarea 13 (Tarea 9 en el servidor) — la periodicidad bimestral de la factura global sólo con el régimen 621 (Guía del CFDI
 * global, `InformacionGlobal/Periodicidad`: «Cuando el valor de este campo sea "05" el campo RegimenFiscal debe ser "621"»).
 */
import { describe, it, expect, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import es from '@/locales/es/cfdi.json'
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
// El select de Radix no abre en jsdom: el sustituto nativo de la casa, con `disabled` en cada opción.
vi.mock('@/components/ui/select', async () => {
  const shim = await import('@/test/nativeSelectShim')
  return {
    ...shim,
    SelectItem: ({ value, disabled }: { value: string; disabled?: boolean; children?: ReactNode }) => (
      <option value={value} disabled={disabled}>
        {value}
      </option>
    ),
  }
})

import { EmisorFormModal } from '../EmisorFormModal'

const AVISO = es.emisorForm.bimestralOnly621

const emisor = (over: Partial<Emisor>): Emisor => ({
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

const opcionBimestral = () => screen.getByRole('option', { name: 'BIMESTRAL' })
const guardar = () => fireEvent.click(screen.getByRole('button', { name: es.emisorForm.save }))

describe('EmisorFormModal · bimestral sólo con el régimen 621', () => {
  it('🔴 con régimen 601 la opción bimestral está deshabilitada y dice por qué', () => {
    render(<EmisorFormModal open emisor={emisor({ regimenFiscal: '601' })} onClose={() => {}} />)
    expect(opcionBimestral()).toBeDisabled()
    expect(screen.getByText(AVISO)).toBeInTheDocument()
  })

  it('control — con régimen 621 se puede elegir bimestral y se guarda', async () => {
    render(<EmisorFormModal open emisor={emisor({ regimenFiscal: '621' })} onClose={() => {}} />)
    expect(opcionBimestral()).toBeEnabled()
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
    await userEvent.selectOptions(opcionBimestral().closest('select')!, 'BIMESTRAL')
    guardar()
    await waitFor(() => expect(m.mutate).toHaveBeenCalled())
    expect(m.mutate.mock.calls[0][0]).toMatchObject({ emisorId: 'e1', data: { regimenFiscal: '621', globalPeriodicity: 'BIMESTRAL' } })
  })

  it('🔴 un emisor guardado bimestral con régimen 601 no se deja guardar así: el formulario dice por qué y no manda nada', async () => {
    render(<EmisorFormModal open emisor={emisor({ regimenFiscal: '601', globalPeriodicity: 'BIMESTRAL' })} onClose={() => {}} />)
    guardar()
    await waitFor(() => expect(screen.getByText(AVISO)).toBeInTheDocument())
    expect(m.mutate).not.toHaveBeenCalled()
  })

  it('🔴 si el servidor responde 400 con el texto, el formulario lo muestra', async () => {
    const TEXTO =
      'El SAT sólo permite la periodicidad bimestral al régimen 621 (Incorporación Fiscal). Elige otra periodicidad o corrige el régimen fiscal del emisor.'
    m.mutate.mockImplementation((_vars: unknown, opts: any) => opts?.onError?.({ response: { status: 400, data: { error: TEXTO } } }))
    render(<EmisorFormModal open emisor={emisor({ regimenFiscal: '621' })} onClose={() => {}} />)
    guardar()
    await waitFor(() => expect(screen.getByText(TEXTO)).toBeInTheDocument())
  })
})
