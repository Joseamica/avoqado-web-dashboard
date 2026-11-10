/**
 * El editor compartido del menú del aparato (pestaña Menús y ficha). Arnés de `DeviceMenusTab.test.tsx`.
 * 🔴 Lo que importa: la elección siguiente parte de lo guardado aunque la relectura no llegue, y sin guardado en curso
 * el selector sigue a las props.
 */
import { onlineManager, QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const svc = vi.hoisted(() => ({ getDeviceMenuOptions: vi.fn(), setTerminalMenus: vi.fn() }))
const avisos = vi.hoisted(() => ({ toast: vi.fn() }))
const tpvSvc = vi.hoisted(() => ({ getTpvById: vi.fn() }))
vi.mock('@/services/deviceMenus.service', () => svc)
vi.mock('@/services/tpv.service', () => tpvSvc)
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: avisos.toast }) }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k}(${Object.values(o).join(',')})` : k),
    i18n: { language: 'es' },
  }),
}))

import { DeviceMenusEditor } from '../components/DeviceMenusEditor'

const NOMBRES: Record<string, string> = { m1: 'Desayunos', m2: 'Comidas', m3: 'Cenas' }
const fila = (ids: string[]) => ({ id: 't1', name: 'Caja', menus: ids.map(id => ({ id, name: NOMBRES[id] })) })
const m = (id: string) => ({ id, name: NOMBRES[id], appliesToOnline: true, categoryCount: 2 })

let qc: QueryClient
function pintar(props: Partial<React.ComponentProps<typeof DeviceMenusEditor>> = {}) {
  const base = { terminalId: 't1', menus: [] as Array<{ id: string; name: string }>, canEdit: true, deviceName: 'Caja' }
  const ui = (p: typeof props) => (
    <QueryClientProvider client={qc}>
      <DeviceMenusEditor {...base} {...p} />
    </QueryClientProvider>
  )
  const r = render(ui(props))
  return { ...r, rerenderCon: (p: typeof props) => r.rerender(ui({ ...props, ...p })) }
}
const selector = () => screen.getByRole('combobox', { name: /menusDelAparato/, hidden: true })
const opcion = (n: RegExp) => screen.findByRole('option', { name: n, hidden: true })

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
  svc.getDeviceMenuOptions.mockResolvedValue({ menus: [m('m1'), m('m2'), m('m3')], total: 3, page: 1, pageSize: 100 })
  svc.setTerminalMenus.mockImplementation((_v: string, _id: string, ids: string[]) => Promise.resolve(fila(ids)))
})

describe('DeviceMenusEditor', () => {
  it('elegir un menú llama setTerminalMenus y avisa a onSaved', async () => {
    const onSaved = vi.fn()
    const user = userEvent.setup()
    pintar({ onSaved })
    await user.click(selector())
    await user.click(await opcion(/Desayunos/))
    await waitFor(() => expect(svc.setTerminalMenus).toHaveBeenCalledWith('v1', 't1', ['m1']))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(fila(['m1'])))
    expect(avisos.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'deviceMenus.guardado' }))
  })

  it('sin opciones por props las pide él mismo', async () => {
    const user = userEvent.setup()
    pintar()
    await user.click(selector())
    await opcion(/Comidas/)
    expect(svc.getDeviceMenuOptions).toHaveBeenCalledWith('v1', { search: undefined, page: 1, pageSize: 100 })
  })

  it('al guardar invalida tpvs, la ficha, la lista y el ruteo', async () => {
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const user = userEvent.setup()
    pintar()
    await user.click(selector())
    await user.click(await opcion(/Desayunos/))
    await waitFor(() => expect(avisos.toast).toHaveBeenCalled())
    const llaves = spy.mock.calls.map(c => JSON.stringify((c[0] as { queryKey: unknown[] }).queryKey))
    for (const k of [
      ['tpvs', 'v1'],
      ['device-menus', 'v1'],
      ['tpv', 'v1', 't1'],
      ['printRouting', 'v1'],
    ])
      expect(llaves).toContain(JSON.stringify(k))
  })

  it('sin canEdit se ve la lista sin poder cambiar', () => {
    pintar({ canEdit: false, menus: [{ id: 'm1', name: 'Desayunos' }] })
    expect(selector()).toBeDisabled()
    expect(selector()).toHaveTextContent('Desayunos')
  })

  it('dos elecciones seguidas con la relectura lenta conservan las dos', async () => {
    vi.spyOn(qc, 'invalidateQueries').mockReturnValue(new Promise<never>(() => {}))
    const user = userEvent.setup()
    pintar()
    await user.click(selector())
    await user.click(await opcion(/Desayunos/))
    await waitFor(() => expect(selector()).toBeEnabled())
    await user.click(await opcion(/Comidas/))
    await waitFor(() => expect(svc.setTerminalMenus).toHaveBeenLastCalledWith('v1', 't1', ['m1', 'm2']))
  })

  it('con más de 100 menús, la búsqueda del servidor encuentra uno fuera de la primera página', async () => {
    const lejano = { id: 'm9', name: 'Cenas', appliesToOnline: true, categoryCount: 1 }
    svc.getDeviceMenuOptions.mockImplementation((_v: string, p: { search?: string }) =>
      Promise.resolve(
        p.search === 'Cen'
          ? { menus: [lejano], total: 1, page: 1, pageSize: 100 }
          : { menus: [m('m1')], total: 250, page: 1, pageSize: 100 },
      ),
    )
    const user = userEvent.setup()
    pintar()
    const buscador = await screen.findByLabelText('deviceMenus.buscarMenus')
    await user.type(buscador, 'Cen')
    await waitFor(() => expect(svc.getDeviceMenuOptions).toHaveBeenCalledWith('v1', { search: 'Cen', page: 1, pageSize: 100 }))
    await user.click(selector())
    await user.click(await opcion(/Cenas/))
    await waitFor(() => expect(svc.setTerminalMenus).toHaveBeenCalledWith('v1', 't1', ['m9']))
  })

  it('si no cargan las opciones, lo dice y deja reintentar', async () => {
    svc.getDeviceMenuOptions.mockRejectedValue(new Error('boom'))
    pintar()
    expect(await screen.findByText('deviceMenus.errorMenus')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'deviceMenus.reintentar' })).toBeInTheDocument()
  })

  it('una relectura con otra elección, sin guardado en curso, cambia lo que se ve', () => {
    const { rerenderCon } = pintar({ menus: [{ id: 'm1', name: 'Desayunos' }] })
    expect(selector()).toHaveTextContent('Desayunos')
    rerenderCon({ menus: [{ id: 'm3', name: 'Cenas' }] })
    expect(selector()).toHaveTextContent('Cenas')
    expect(selector()).not.toHaveTextContent('Desayunos')
  })

  it('con un guardado en curso ignora las props', async () => {
    svc.setTerminalMenus.mockReturnValue(new Promise<never>(() => {}))
    const user = userEvent.setup()
    const { rerenderCon } = pintar({ menus: [{ id: 'm1', name: 'Desayunos' }] })
    await user.click(selector())
    await user.click(await opcion(/Comidas/))
    await waitFor(() => expect(selector()).toBeDisabled())
    rerenderCon({ menus: [{ id: 'm3', name: 'Cenas' }] })
    expect(selector()).not.toHaveTextContent('Cenas')
  })

  describe('tras un error, lee del servidor la fila de este aparato antes de dejar elegir (Codex final #1, r2)', () => {
    // La ficha de verdad: `['tpv', v1, t1]` con la misma lectura (`getTpvById`) que usa el editor para recuperarse.
    let servidor: string[]
    let lecturaPendiente: (() => void) | null
    let retenerLectura: boolean
    let lecturaFalla: boolean
    const leer = () => {
      if (lecturaFalla) return Promise.reject(new Error('sin red'))
      const ficha = {
        id: 't1',
        name: 'Caja',
        deviceMenus: { menus: servidor.map(id => ({ id, name: NOMBRES[id] })), needsAppUpdate: false },
      }
      if (!retenerLectura) return Promise.resolve(ficha)
      return new Promise<typeof ficha>(r => (lecturaPendiente = () => r(ficha)))
    }
    function Ficha() {
      const q = useQuery({ queryKey: ['tpv', 'v1', 't1'], queryFn: () => tpvSvc.getTpvById('v1', 't1'), retry: false })
      return q.data ? <DeviceMenusEditor terminalId="t1" menus={q.data.deviceMenus.menus} canEdit deviceName="Caja" /> : null
    }
    const pintarFicha = async () => {
      render(
        <QueryClientProvider client={qc}>
          <Ficha />
        </QueryClientProvider>,
      )
      await screen.findByRole('combobox', { name: /menusDelAparato/, hidden: true })
    }
    beforeEach(() => {
      servidor = []
      lecturaPendiente = null
      retenerLectura = false
      lecturaFalla = false
      tpvSvc.getTpvById.mockReset()
      tpvSvc.getTpvById.mockImplementation(leer)
    })
    afterEach(() => onlineManager.setOnline(true))

    it('sin red: la lectura se pausa, sigue bloqueado y lo dice; no sale otro guardado hasta leer de verdad', async () => {
      svc.setTerminalMenus.mockImplementation((_v: string, _id: string, ids: string[]) => {
        servidor = ids
        onlineManager.setOnline(false) // la red se cae justo cuando el servidor ya guardó
        return Promise.reject(new Error('Network Error'))
      })
      await pintarFicha()
      const lecturasAntes = tpvSvc.getTpvById.mock.calls.length
      const user = userEvent.setup()
      await user.click(selector())
      await user.click(await opcion(/Desayunos/))
      expect(await screen.findByText('deviceMenus.sinConexionReleyendo')).toBeInTheDocument()
      // Se queda así: la lectura pausada no cuenta como terminada.
      await act(() => new Promise(r => setTimeout(r, 100)))
      expect(selector()).toBeDisabled()
      expect(tpvSvc.getTpvById).toHaveBeenCalledTimes(lecturasAntes)
      await user.click(await opcion(/Comidas/))
      expect(svc.setTerminalMenus).toHaveBeenCalledTimes(1)
      // Vuelve la red: la lectura sigue, trae [m1] y sólo entonces se puede elegir, sumando a lo guardado.
      svc.setTerminalMenus.mockImplementation((_v: string, _id: string, ids: string[]) => Promise.resolve(fila(ids)))
      act(() => onlineManager.setOnline(true))
      await waitFor(() => expect(selector()).toBeEnabled())
      expect(selector()).toHaveTextContent('Desayunos')
      expect(screen.queryByText('deviceMenus.sinConexionReleyendo')).toBeNull()
      await user.click(await opcion(/Comidas/))
      await waitFor(() => expect(svc.setTerminalMenus).toHaveBeenLastCalledWith('v1', 't1', ['m1', 'm2']))
      expect(svc.setTerminalMenus).toHaveBeenCalledTimes(2)
    })

    it('respuesta perdida: el servidor guardó [m1]; lo leído se toma y la siguiente elección suma m2 y no borra m1', async () => {
      svc.setTerminalMenus.mockImplementation((_v: string, _id: string, ids: string[]) => {
        servidor = ids
        return Promise.reject(new Error('Network Error'))
      })
      await pintarFicha()
      retenerLectura = true
      const user = userEvent.setup()
      await user.click(selector())
      await user.click(await opcion(/Desayunos/))
      await waitFor(() => expect(lecturaPendiente).not.toBeNull())
      expect(selector()).toBeDisabled()
      await act(async () => lecturaPendiente!())
      await waitFor(() => expect(selector()).toBeEnabled())
      expect(selector()).toHaveTextContent('Desayunos')
      svc.setTerminalMenus.mockImplementation((_v: string, _id: string, ids: string[]) => Promise.resolve(fila(ids)))
      await user.click(await opcion(/Comidas/))
      await waitFor(() => expect(svc.setTerminalMenus).toHaveBeenLastCalledWith('v1', 't1', ['m1', 'm2']))
    })

    it('una relectura que llega mientras guarda y luego falla el guardado: toma lo leído aunque se vea igual', async () => {
      servidor = ['m1']
      let fallar: (e: Error) => void = () => {}
      svc.setTerminalMenus.mockImplementation(() => new Promise((_r, rej) => (fallar = rej)))
      await pintarFicha()
      expect(selector()).toHaveTextContent('Desayunos')
      const user = userEvent.setup()
      await user.click(selector())
      await user.click(await opcion(/Comidas/))
      await waitFor(() => expect(selector()).toBeDisabled())
      servidor = ['m3']
      await act(() => qc.refetchQueries({ queryKey: ['tpv', 'v1', 't1'] }))
      expect(selector()).not.toHaveTextContent('Cenas')
      const invalidar = vi.spyOn(qc, 'invalidateQueries')
      await act(async () => fallar(new Error('boom')))
      await waitFor(() => expect(selector()).toBeEnabled())
      expect(selector()).toHaveTextContent('Cenas')
      expect(selector()).not.toHaveTextContent('Desayunos')
      const llaves = invalidar.mock.calls.map(c => JSON.stringify((c[0] as { queryKey: unknown[] }).queryKey))
      for (const k of [
        ['device-menus', 'v1'],
        ['tpv', 'v1', 't1'],
        ['tpvs', 'v1'],
        ['device-menu-options', 'v1'],
      ])
        expect(llaves).toContain(JSON.stringify(k))
    })

    it('si la lectura falla, sigue bloqueado y «Reintentar» vuelve a leer', async () => {
      svc.setTerminalMenus.mockImplementation((_v: string, _id: string, ids: string[]) => {
        servidor = ids
        return Promise.reject(new Error('boom'))
      })
      await pintarFicha()
      lecturaFalla = true
      const user = userEvent.setup()
      await user.click(selector())
      await user.click(await opcion(/Desayunos/))
      const reintentar = await screen.findByRole('button', { name: 'deviceMenus.reintentar', hidden: true })
      expect(screen.getByText('deviceMenus.errorAlReleer')).toBeInTheDocument()
      expect(selector()).toBeDisabled()
      lecturaFalla = false
      await user.keyboard('{Escape}')
      await user.click(reintentar)
      await waitFor(() => expect(selector()).toBeEnabled())
      expect(selector()).toHaveTextContent('Desayunos')
      expect(screen.queryByText('deviceMenus.errorAlReleer')).toBeNull()
    })
  })
})
