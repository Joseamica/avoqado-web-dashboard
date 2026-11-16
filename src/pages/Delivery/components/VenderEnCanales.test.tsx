/**
 * D1 · casilla «Vender en: ☑ Rappi ☐ Uber Eats» del producto: qué canales salen, cómo arranca cada casilla y qué manda `aplicar`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { DeliveryChannelLink } from '@/types/delivery'

const toastMock = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastMock }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
const acceso = vi.hoisted(() => ({ puede: true }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => acceso.puede && p === 'delivery-channels:manage' }) }))
const plan = vi.hoisted(() => ({ hasAccess: true, isLoading: false }))
vi.mock('@/hooks/use-tier-feature-access', () => ({
  useTierFeatureAccess: (f: string) => ({ hasAccess: plan.hasAccess && f === 'DELIVERY_CHANNELS', isLoading: plan.isLoading }),
}))
const svc = vi.hoisted(() => ({ getChannels: vi.fn(), ponerProductoEnCanales: vi.fn() }))
vi.mock('@/services/delivery.service', () => svc)

import { useVenderEnCanales } from './useVenderEnCanales'
import { VenderEnCanales } from './VenderEnCanales'

const canal = (over: Partial<DeliveryChannelLink> = {}): DeliveryChannelLink => ({
  id: 'l1',
  venueId: 'v1',
  provider: 'RAPPI',
  status: 'ACTIVE',
  orderAcceptanceMode: 'AUTO',
  autoSyncMenu: true,
  lastMenuSyncAt: null,
  externalLocationId: 'ext',
  config: { productoIds: ['otro'] },
  ...over,
})

let estado: ReturnType<typeof useVenderEnCanales>
function Prueba({ producto }: { producto: { id?: string; sku?: string } }) {
  estado = useVenderEnCanales('v1', producto)
  return <VenderEnCanales estado={estado} />
}
let qc: QueryClient
function montar(producto: { id?: string; sku?: string } = {}, enCache?: DeliveryChannelLink[]) {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  // Lo que dejó otra pantalla en la misma llave (la página de Delivery sólo mira el plan, no `manage`).
  if (enCache) qc.setQueryData(['deliveryChannels', 'v1'], enCache)
  return render(
    <QueryClientProvider client={qc}>
      <Prueba producto={producto} />
    </QueryClientProvider>,
  )
}
const casilla = (nombre = 'Rappi') => screen.findByRole('checkbox', { name: nombre })

beforeEach(() => {
  acceso.puede = true
  plan.hasAccess = true
  plan.isLoading = false
  svc.getChannels.mockResolvedValue([canal()])
  svc.ponerProductoEnCanales.mockResolvedValue([])
})

describe('casilla «Vender en»: qué se ve', () => {
  it('sin permiso no consulta los canales ni aparece', async () => {
    acceso.puede = false
    montar()
    await act(async () => {})
    expect(svc.getChannels).not.toHaveBeenCalled()
    expect(screen.queryByText('venderEn.titulo')).not.toBeInTheDocument()
  })

  it.each([
    ['sin el plan', { hasAccess: false, isLoading: false }],
    ['con el plan todavía cargando (deja pasar todo)', { hasAccess: true, isLoading: true }],
  ])('%s no consulta los canales ni aparece', async (_caso, estadoDelPlan) => {
    Object.assign(plan, estadoDelPlan)
    montar()
    await act(async () => {})
    expect(svc.getChannels).not.toHaveBeenCalled()
    expect(screen.queryByText('venderEn.titulo')).not.toBeInTheDocument()
  })

  it.each([
    ['sin permiso', () => (acceso.puede = false)],
    ['sin el plan', () => (plan.hasAccess = false)],
  ])('%s, aunque los canales estén en caché: no aparece y aplicar no manda nada', async (_caso, quitar) => {
    quitar()
    montar({}, [canal()])
    await act(async () => {})
    expect(screen.queryByRole('checkbox', { name: 'Rappi' })).not.toBeInTheDocument()
    expect(estado.visible).toBe(false)
    await act(async () => {
      await expect(estado.aplicar('nuevo', { marcados: { l1: false }, base: { l1: false }, alta: true })).resolves.toBe(true)
    })
    expect(svc.ponerProductoEnCanales).not.toHaveBeenCalled()
  })

  it('si la lista de canales falla (403 sin plan), no aparece y no hay aviso', async () => {
    svc.getChannels.mockRejectedValue({ response: { status: 403 } })
    montar()
    await waitFor(() => expect(svc.getChannels).toHaveBeenCalled())
    await act(async () => {})
    expect(screen.queryByText('venderEn.titulo')).not.toBeInTheDocument()
    expect(estado.visible).toBe(false)
    expect(toastMock).not.toHaveBeenCalled()
  })

  it('un canal PENDING no aparece; uno PAUSED sí', async () => {
    svc.getChannels.mockResolvedValue([canal({ id: 'l2', provider: 'UBER_EATS', status: 'PENDING' }), canal({ status: 'PAUSED' })])
    montar()
    expect(await casilla('Rappi')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Uber Eats' })).not.toBeInTheDocument()
  })

  it('en un alta, un canal con lista arranca sin marcar', async () => {
    montar()
    expect(await casilla()).not.toBeChecked()
  })

  it('al editar, el producto que está en la lista por id sale marcado', async () => {
    svc.getChannels.mockResolvedValue([canal({ config: { productoIds: ['p1'] } })])
    montar({ id: 'p1', sku: 'CAFE' })
    expect(await casilla()).toBeChecked()
  })

  it('con la lista vieja por código, sale marcado si su código está', async () => {
    svc.getChannels.mockResolvedValue([canal({ config: { productos: ['CAFE'] } })])
    montar({ id: 'p1', sku: 'CAFE' })
    expect(await casilla()).toBeChecked()
  })

  it('un canal con todo el catálogo sale marcado y, al desmarcarlo, avisa qué pasa', async () => {
    svc.getChannels.mockResolvedValue([canal({ config: null })])
    montar()
    const rappi = await casilla()
    expect(rappi).toBeChecked()
    expect(screen.queryByText('venderEn.avisoTodoElCatalogo')).not.toBeInTheDocument()
    await userEvent.click(rappi)
    expect(rappi).not.toBeChecked()
    expect(screen.getByText('venderEn.avisoTodoElCatalogo')).toBeInTheDocument()
    expect(estado.cambio).toBe(true)
  })
})

describe('casilla «Vender en»: qué manda aplicar', () => {
  it('editar sin cambios no llama a la ruta', async () => {
    svc.getChannels.mockResolvedValue([canal({ config: { productoIds: ['p1'] } })])
    montar({ id: 'p1' })
    await casilla()
    await act(() => estado.aplicar('p1', { marcados: { l1: true }, base: { l1: true }, alta: false }))
    expect(svc.ponerProductoEnCanales).not.toHaveBeenCalled()
  })

  it('con un cambio manda sólo ese canal', async () => {
    montar({ id: 'p1' })
    await casilla()
    await act(() => estado.aplicar('p1', { marcados: { l1: true }, base: { l1: false }, alta: false }))
    expect(svc.ponerProductoEnCanales).toHaveBeenCalledExactlyOnceWith('v1', 'p1', { l1: true })
  })

  it('en un alta, un canal con lista que quedó sin marcar se manda en false (cuenta como revisado)', async () => {
    svc.getChannels.mockResolvedValue([canal(), canal({ id: 'l2', provider: 'UBER_EATS', config: null })])
    montar()
    await casilla()
    await act(() => estado.aplicar('nuevo', { marcados: { l1: false, l2: true }, base: { l1: false, l2: true }, alta: true }))
    expect(svc.ponerProductoEnCanales).toHaveBeenCalledExactlyOnceWith('v1', 'nuevo', { l1: false })
  })

  it('si la ruta falla: aviso con el texto de «agregar» y la promesa se resuelve', async () => {
    svc.ponerProductoEnCanales.mockRejectedValue(new Error('500'))
    montar()
    await casilla()
    await act(async () => {
      // no lanza: dice «no quedó»
      await expect(estado.aplicar('nuevo', { marcados: { l1: true }, base: { l1: false }, alta: true })).resolves.toBe(false)
    })
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'venderEn.falloAgregar' }))
  })

  it('si la ruta falla con un motivo del SERVIDOR, el aviso lo dice debajo del título de siempre', async () => {
    const motivo = 'Un canal necesita al menos un producto; pausa el canal si no quieres vender ahí'
    svc.ponerProductoEnCanales.mockRejectedValue({ response: { data: { message: motivo } } })
    svc.getChannels.mockResolvedValue([canal({ config: { productoIds: ['p1'] } })])
    montar({ id: 'p1' })
    await casilla()
    await act(() => estado.aplicar('p1', { marcados: { l1: false }, base: { l1: true }, alta: false }))
    expect(toastMock).toHaveBeenCalledWith({ title: 'venderEn.falloQuitar', description: motivo, variant: 'destructive' })
  })

  it('guardar SÓLO la casilla y fallar no dice que el producto se guardó', async () => {
    svc.ponerProductoEnCanales.mockRejectedValue(new Error('500'))
    montar({ id: 'p1' })
    await casilla()
    await act(() => estado.aplicar('p1', { marcados: { l1: true }, base: { l1: false }, alta: false, soloCanales: true }))
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'venderEn.noSePudoAgregar', variant: 'destructive' }))
    expect(toastMock).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'venderEn.falloAgregar' }))
  })

  // 🔴 Codex impl r1 #3: A marca sólo Rappi; mientras se guarda el producto, B lo agrega a Uber y la lectura nueva llega antes de
  // `aplicar`. Comparar contra esa lectura mandaba `Uber: false` y borraba lo de B sin aviso.
  it('compara contra cómo estaba cada canal AL ENVIAR: un refresco a media guardada no manda el canal que nadie tocó', async () => {
    const uber = (ids: string[]) => canal({ id: 'l2', provider: 'UBER_EATS', config: { productoIds: ids } })
    svc.getChannels.mockResolvedValue([canal(), uber(['otro'])])
    montar({ id: 'p1' })
    await casilla()
    act(() => estado.setMarcado('l1', true))
    const envio = estado.envio()
    expect(envio).toEqual({ marcados: { l1: true, l2: false }, base: { l1: false, l2: false } })

    svc.getChannels.mockResolvedValue([canal(), uber(['otro', 'p1'])])
    await act(() => qc.invalidateQueries({ queryKey: ['deliveryChannels', 'v1'] }))
    await waitFor(() => expect(estado.canales.find(c => c.id === 'l2')?.dentroInicial).toBe(true))

    await act(() => estado.aplicar('p1', { ...envio, alta: false }))
    expect(svc.ponerProductoEnCanales).toHaveBeenCalledExactlyOnceWith('v1', 'p1', { l1: true })
  })

  it('lo mismo con el envío escrito a mano: sólo cuenta la base que viajó con él', async () => {
    svc.getChannels.mockResolvedValue([canal(), canal({ id: 'l2', provider: 'UBER_EATS', config: { productoIds: ['otro', 'p1'] } })])
    montar({ id: 'p1' })
    await casilla()
    await act(() => estado.aplicar('p1', { marcados: { l1: true, l2: false }, base: { l1: false, l2: false }, alta: false }))
    expect(svc.ponerProductoEnCanales).toHaveBeenCalledExactlyOnceWith('v1', 'p1', { l1: true })
  })
})
