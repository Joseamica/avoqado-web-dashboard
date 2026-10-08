/**
 * C1 · Tarea 13, ronda 1 (I1) — las tres consultas pesadas de la factura global (periodos, ventas que no entraron y vista previa de la
 * complementaria) siguen la política de la casa (`.claude/rules/bounded-data-and-query-load.md`, mismo criterio que B4b en
 * `errorDelReporte.ts`): un reintento como mucho, ninguno ante el corte del proxy (504/524) ni ante un 4xx, y ni el foco ni la
 * reconexión relanzan una consulta que el proxy cortó. El cliente va SIN opciones, como el de `main.tsx`: lo que se prueba es lo que
 * fija cada hook.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  getGlobalPeriodos: vi.fn(),
  getGlobalExcluidas: vi.fn(),
  getGlobalComplementariaPreview: vi.fn(),
  triggerGlobalCfdi: vi.fn(),
  updateEmisor: vi.fn(),
  createEmisor: vi.fn(),
  upsertMerchantConfig: vi.fn(),
  toast: vi.fn(),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/services/cfdi.service', () => ({
  default: {
    getGlobalPeriodos: m.getGlobalPeriodos,
    getGlobalExcluidas: m.getGlobalExcluidas,
    getGlobalComplementariaPreview: m.getGlobalComplementariaPreview,
    triggerGlobalCfdi: m.triggerGlobalCfdi,
    updateEmisor: m.updateEmisor,
    createEmisor: m.createEmisor,
    upsertMerchantConfig: m.upsertMerchantConfig,
  },
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))

import {
  useGlobalComplementariaPreview,
  useGlobalExcluidas,
  useGlobalPeriodos,
  useTriggerGlobalCfdi,
  useUpsertEmisor,
  useUpsertMerchantConfig,
} from './use-cfdi'

const conCliente = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)
const unRato = () => new Promise(r => setTimeout(r, 50))
const volverALaVentanaYReconectar = async () => {
  act(() => {
    window.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('offline'))
    window.dispatchEvent(new Event('online'))
  })
  await unRato()
}

// Tipado común: lo único que la prueba lee de cada hook es si quedó en error.
const consultas: Array<{ nombre: string; servicio: ReturnType<typeof vi.fn>; useConsulta: () => { isError: boolean } }> = [
  { nombre: 'periodos', servicio: m.getGlobalPeriodos, useConsulta: () => useGlobalPeriodos('e1') },
  { nombre: 'ventas que no entraron', servicio: m.getGlobalExcluidas, useConsulta: () => useGlobalExcluidas('e1', { principalId: 'g1' }) },
  {
    nombre: 'vista previa de la complementaria',
    servicio: m.getGlobalComplementariaPreview,
    useConsulta: () => useGlobalComplementariaPreview('e1', 'g1'),
  },
]
const corte = (status: number) => ({
  response: { status, data: `error code: ${status}` },
  message: `Request failed with status code ${status}`,
})

describe('C1 · consultas pesadas de la factura global (I1)', () => {
  it.each(consultas)(
    '🔴 $nombre · un 524 del proxy hace UNA sola llamada, y ni el foco ni la reconexión la repiten',
    async ({ servicio, useConsulta }) => {
      servicio.mockRejectedValue(corte(524))
      const { result } = renderHook(useConsulta, { wrapper: conCliente })
      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(servicio).toHaveBeenCalledTimes(1)
      await volverALaVentanaYReconectar()
      expect(servicio).toHaveBeenCalledTimes(1)
    },
  )

  it.each(consultas)('🔴 $nombre · un 504 tampoco se reintenta', async ({ servicio, useConsulta }) => {
    servicio.mockRejectedValue(corte(504))
    const { result } = renderHook(useConsulta, { wrapper: conCliente })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(servicio).toHaveBeenCalledTimes(1)
  })

  it.each(consultas)(
    '$nombre · un 400 del servidor no se reintenta (🔴 en periodos; control en las otras dos)',
    async ({ servicio, useConsulta }) => {
      servicio.mockRejectedValue({ response: { status: 400, data: { error: 'Ese periodo ya no se emite desde aquí; pídelo a soporte.' } } })
      const { result } = renderHook(useConsulta, { wrapper: conCliente })
      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(servicio).toHaveBeenCalledTimes(1)
    },
  )

  it.each(consultas)(
    '$nombre · un 500 se reintenta UNA vez: dos llamadas, nunca cuatro (🔴 en periodos; control en las otras dos)',
    async ({ servicio, useConsulta }) => {
      servicio.mockRejectedValue({ response: { status: 500, data: { error: 'Error interno' } } })
      const { result } = renderHook(useConsulta, { wrapper: conCliente })
      await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5_000 })
      expect(servicio).toHaveBeenCalledTimes(2)
    },
  )
})

describe('C1 · invalidaciones acotadas al emisor (I1, M3)', () => {
  const conEspia = () => {
    const qc = new QueryClient()
    const invalidar = vi.spyOn(qc, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    const llaves = () => invalidar.mock.calls.map(c => JSON.stringify((c[0] as { queryKey?: unknown })?.queryKey))
    return { wrapper, llaves, qc }
  }
  const DATOS_DEL_RFC = { rfc: 'X', legalName: 'X', regimenFiscal: '601', lugarExpedicion: '06000' }
  const lasTres = (...resto: string[]) => [
    JSON.stringify(['global-periodos', 'v1', ...resto]),
    JSON.stringify(['global-excluidas', 'v1', ...resto]),
    JSON.stringify(['global-complementaria', 'v1', ...resto]),
  ]

  it('🔴 I1: emitir la global de un emisor refresca SUS periodos y SUS excluidas, no los de todos los emisores', async () => {
    m.triggerGlobalCfdi.mockResolvedValue({ status: 'NOTHING_TO_INVOICE', message: 'x' })
    const { wrapper, llaves } = conEspia()
    const { result } = renderHook(() => useTriggerGlobalCfdi(), { wrapper })
    await act(() => result.current.mutateAsync({ emisorId: 'e1', desde: '2026-10-04T06:00:00.000Z' }))
    expect(llaves()).toContain(JSON.stringify(['global-periodos', 'v1', 'e1']))
    expect(llaves()).toContain(JSON.stringify(['global-excluidas', 'v1', 'e1']))
    expect(llaves()).not.toContain(JSON.stringify(['global-periodos', 'v1']))
  })

  it('🔴 M3: guardar el emisor (p. ej. cambiar la periodicidad) refresca sus periodos', async () => {
    m.updateEmisor.mockResolvedValue({ id: 'e1' })
    const { wrapper, llaves } = conEspia()
    const { result } = renderHook(() => useUpsertEmisor(), { wrapper })
    await act(() =>
      result.current.mutateAsync({ emisorId: 'e1', data: { rfc: 'X', legalName: 'X', regimenFiscal: '601', lugarExpedicion: '06000' } }),
    )
    expect(llaves()).toContain(JSON.stringify(['global-periodos', 'v1', 'e1']))
  })

  it('🔴 M2 (ola final): guardar el emisor refresca también SUS excluidas y SU vista previa de complementaria (el interruptor de ventas fuera de la terminal cambia las dos), no las de todo el negocio', async () => {
    m.updateEmisor.mockResolvedValue({ id: 'e1' })
    const { wrapper, llaves } = conEspia()
    const { result } = renderHook(() => useUpsertEmisor(), { wrapper })
    await act(() => result.current.mutateAsync({ emisorId: 'e1', data: DATOS_DEL_RFC }))
    for (const llave of lasTres('e1')) expect(llaves()).toContain(llave)
    for (const llave of lasTres()) expect(llaves()).not.toContain(llave)
  })

  it('🔴 M2 (ola final): dar de alta un RFC refresca la global de todo el negocio (con dos RFC, las ventas fuera de la terminal ya no entran a ninguna)', async () => {
    m.createEmisor.mockResolvedValue({ id: 'e2' })
    const { wrapper, llaves } = conEspia()
    const { result } = renderHook(() => useUpsertEmisor(), { wrapper })
    await act(() => result.current.mutateAsync({ data: DATOS_DEL_RFC }))
    for (const llave of lasTres()) expect(llaves()).toContain(llave)
  })

  const comercio = (fiscalEmisorId: string) => ({
    id: 'mc1',
    merchantAccountId: 'ma1',
    ecommerceMerchantId: null,
    fiscalEmisorId,
    facturacionEnabled: true,
    autofacturaEnabled: false,
    includeInGlobal: false,
    includeInAccounting: true,
  })
  const guardarComercio = { merchantAccountId: 'ma1', facturacionEnabled: true, autofacturaEnabled: false, includeInGlobal: true }

  it('🔴 6 (ola final): prender «Incluir en global» en un comercio refresca la global de SU RFC (si no, el panel seguiría diciendo «apagada»)', async () => {
    m.upsertMerchantConfig.mockResolvedValue(comercio('e1'))
    const { wrapper, llaves, qc } = conEspia()
    qc.setQueryData(['fiscal-config', 'v1'], { emisores: [], merchantConfigs: [comercio('e1')] })
    const { result } = renderHook(() => useUpsertMerchantConfig(), { wrapper })
    await act(() => result.current.mutateAsync({ ...guardarComercio, fiscalEmisorId: 'e1' }))
    for (const llave of lasTres('e1')) expect(llaves()).toContain(llave)
    for (const llave of lasTres()) expect(llaves()).not.toContain(llave)
  })

  it('🔴 6 (ola final): mover un comercio a otro RFC refresca la global de los DOS (el de antes y el de ahora)', async () => {
    m.upsertMerchantConfig.mockResolvedValue(comercio('e2'))
    const { wrapper, llaves, qc } = conEspia()
    qc.setQueryData(['fiscal-config', 'v1'], { emisores: [], merchantConfigs: [comercio('e1')] })
    const { result } = renderHook(() => useUpsertMerchantConfig(), { wrapper })
    await act(() => result.current.mutateAsync({ ...guardarComercio, fiscalEmisorId: 'e2' }))
    for (const llave of [...lasTres('e1'), ...lasTres('e2')]) expect(llaves()).toContain(llave)
  })

  it('🔴 6 (ola final): un comercio que se agrega por primera vez refresca la global de su RFC', async () => {
    m.upsertMerchantConfig.mockResolvedValue(comercio('e1'))
    const { wrapper, llaves, qc } = conEspia()
    qc.setQueryData(['fiscal-config', 'v1'], { emisores: [], merchantConfigs: [] })
    const { result } = renderHook(() => useUpsertMerchantConfig(), { wrapper })
    await act(() => result.current.mutateAsync({ ...guardarComercio, fiscalEmisorId: 'e1' }))
    for (const llave of lasTres('e1')) expect(llaves()).toContain(llave)
  })
})

describe('C1 · ronda 2 (N3 y residual de la re-revisión)', () => {
  it('🔴 N3: con páginas cargadas, la reconexión NO vuelve a pedir todas las páginas del listado', async () => {
    m.getGlobalExcluidas.mockImplementation(async (_v: string, _e: string, q: { cursor?: string }) => ({
      excluidas: [],
      siguiente: q.cursor ? null : 'o1',
    }))
    const qc = new QueryClient()
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useGlobalExcluidas('e1', { principalId: 'g1' }), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    await act(() => result.current.fetchNextPage())
    expect(m.getGlobalExcluidas).toHaveBeenCalledTimes(2)
    // Los datos «viejos» (como si hubiera pasado el minuto) y vuelve la red.
    const consulta = qc.getQueryCache().findAll({ queryKey: ['global-excluidas', 'v1', 'e1'] })[0]
    act(() => consulta.setState({ isInvalidated: true }))
    act(() => {
      window.dispatchEvent(new Event('offline'))
      window.dispatchEvent(new Event('online'))
    })
    await unRato()
    expect(m.getGlobalExcluidas).toHaveBeenCalledTimes(2)
  })

  it('🔴 residual (use-cfdi:90): si guardar el emisor falla sin texto del servidor, el aviso no dice «Request failed…»', async () => {
    m.updateEmisor.mockRejectedValue({ response: { status: 524, data: 'error code: 524' }, message: 'Request failed with status code 524' })
    const { result } = renderHook(() => useUpsertEmisor(), { wrapper: conCliente })
    await act(async () => {
      await result.current
        .mutateAsync({ emisorId: 'e1', data: { rfc: 'X', legalName: 'X', regimenFiscal: '601', lugarExpedicion: '06000' } })
        .catch(() => {})
    })
    expect(m.toast).toHaveBeenCalled()
    expect(JSON.stringify(m.toast.mock.calls)).not.toMatch(/Request failed/)
  })
})
