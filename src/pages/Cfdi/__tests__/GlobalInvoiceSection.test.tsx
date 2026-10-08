/**
 * C1 · Tarea 13, ronda 2 (N4 de la re-revisión) — el cableado del botón de hoy («Generar factura global ahora») con el aviso «Ver cuáles»:
 * timbrada ⇒ el listado por el id de ESA global (su periodo guardado); un 422 ⇒ el listado del último periodo cerrado (el que usó el
 * botón, sin `desde`). Las pruebas puras del aviso viven en `facturaGlobalUi.test.tsx`; ésta fija que la pantalla les pase lo correcto.
 */
import { describe, it, expect, vi } from 'vitest'
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
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

const m = vi.hoisted(() => ({ mutate: vi.fn(), toast: vi.fn() }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-cfdi', () => ({
  useTriggerGlobalCfdi: () => ({ mutate: m.mutate, isPending: false }),
  useFiscalConfig: () => ({ data: undefined, isLoading: false, isError: false }),
  useProvisionEmisor: () => ({ mutate: () => {}, isPending: false }),
  useSyncEmisorLogo: () => ({ mutate: () => {}, isPending: false }),
  useUpsertMerchantConfig: () => ({ mutate: () => {}, isPending: false }),
  // Ola final (punto 6): la tarjeta lee los periodos para saber si la global está apagada; aquí, un servidor que no lo dice.
  useGlobalPeriodos: () => ({ data: undefined }),
}))
vi.mock('../components/GlobalPeriodosPanel', () => ({ GlobalPeriodosPanel: () => null }))
vi.mock('../components/GlobalComplementariaDialog', () => ({ GlobalComplementariaDialog: () => null }))
vi.mock('../components/GlobalExcluidasDialog', () => ({
  GlobalExcluidasDialog: ({
    open,
    emisorId,
    principalId,
    desde,
  }: {
    open: boolean
    emisorId: string | null
    principalId?: string
    desde?: string
  }) => (open ? <div data-testid="excluidas">{`${emisorId}:${principalId ?? ''}:${desde ?? ''}`}</div> : null),
}))

import { GlobalInvoiceSection } from '../CfdiConfiguracion'

const g = es.globalInvoice
const emisor = { id: 'e1', legalName: 'Café Testarudo', rfc: 'ABC123456T1A', csdStatus: 'ACTIVE', globalPeriodicity: 'MENSUAL' } as Emisor

const disparar = () => {
  render(<GlobalInvoiceSection emisores={[emisor]} live />)
  fireEvent.click(screen.getByRole('button', { name: g.trigger }))
  fireEvent.click(screen.getByRole('button', { name: g.confirm.confirm }))
}
const pulsarVerCuales = async (count: number) => {
  const titulo = traducir('globalInvoice.excluded.summary', { count })
  await waitFor(() => expect(m.toast.mock.calls.some(c => c[0].title === titulo)).toBe(true))
  const accion = m.toast.mock.calls.map(c => c[0]).find(a => a.title === titulo)!.action
  act(() => accion.props.onClick())
}

describe('GlobalInvoiceSection · «Ver cuáles» del botón de hoy (N4)', () => {
  it('control — timbrada con ventas fuera ⇒ el listado por el id de la global recién timbrada', async () => {
    m.mutate.mockImplementation((_v: unknown, opts: any) => {
      opts.onSuccess({
        excluidas: { EFECTIVO: 2 },
        cfdi: { id: 'gx', uuid: 'U', serie: 'G', folio: '12', globalPeriod: null, pdfUrl: null },
      })
      opts.onSettled?.()
    })
    disparar()
    expect(m.mutate.mock.calls[0][0]).toEqual({ emisorId: 'e1' })
    await pulsarVerCuales(2)
    expect(screen.getByTestId('excluidas').textContent).toBe('e1:gx:')
  })

  it('control — un 422 con ventas fuera ⇒ el listado del último periodo cerrado (sin principal ni `desde`)', async () => {
    m.mutate.mockImplementation((_v: unknown, opts: any) => {
      opts.onError({
        response: { status: 422, data: { error: 'No se pudo generar la factura global', reasons: ['x'], excluidas: { NO_CUADRA: 1 } } },
      })
      opts.onSettled?.()
    })
    disparar()
    await pulsarVerCuales(1)
    expect(screen.getByTestId('excluidas').textContent).toBe('e1::')
  })
})
