/**
 * Menú del aparato (B4): la pestaña «Qué muestra cada aparato» de Dispositivos.
 * Arnés de `ProductOptions.test.tsx`: servicios con vi.hoisted, FeatureGate con stub y `t` que regresa la llave (con sus
 * valores entre paréntesis). Respuestas en beforeEach: vitest corre con mockReset.
 * 🔴 Lo que importa: cada elección se guarda sola y la fila cambia con lo que regresó el PUT, aunque la relectura no llegue.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const svc = vi.hoisted(() => ({
  getDeviceMenus: vi.fn(),
  getDeviceMenuOptions: vi.fn(),
  setTerminalMenus: vi.fn(),
}))
const menuSvc = vi.hoisted(() => ({ getMenus: vi.fn() }))
const acceso = vi.hoisted(() => ({ permisos: [] as string[] }))
const avisos = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('@/services/deviceMenus.service', () => svc)
vi.mock('@/services/menu.service', () => menuSvc)
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/mi-tienda' }) }))
vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({ can: (p: string) => acceso.permisos.includes(p) }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: avisos.toast }) }))
// El candado de plan tiene sus propias pruebas: aquí sólo se comprueba QUÉ función pide.
vi.mock('@/components/billing/FeatureGate', () => ({
  FeatureGate: ({ feature, children }: { feature: string; children: React.ReactNode }) => (
    <div data-testid={`gate-${feature}`}>{children}</div>
  ),
}))
// El asistente tiene sus pruebas; aquí sólo con qué casillas nace y qué pasa al crear.
vi.mock('@/pages/Menu/Menus/components/MenuWizardDialog', () => ({
  MenuWizardDialog: ({ open, defaults, onSuccess }: { open: boolean; defaults?: unknown; onSuccess?: (id: string) => void }) =>
    open ? (
      <div data-testid="asistente" data-defaults={JSON.stringify(defaults)}>
        <button onClick={() => onSuccess?.('m9')}>crear</button>
      </div>
    ) : null,
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k}(${Object.values(o).join(',')})` : k),
    i18n: { language: 'es' },
  }),
}))

import DeviceMenusTab from '../components/DeviceMenusTab'

const nunca = () => new Promise<never>(() => {})
const ve = (c: number, p: number) => `deviceMenus.ve(deviceMenus.categorias(${c}),deviceMenus.productos(${p}))`

type Fila = Record<string, unknown>
const fila = (id: string, name: string, extra: Fila = {}) => ({
  id,
  name,
  type: 'POS_ANDROID',
  model: null,
  version: '2.25.23',
  areaName: null,
  needsAppUpdate: false,
  menus: [] as Array<{ id: string; name: string }>,
  sees: { categories: 20, products: 1022 },
  seesAfterUpdate: null,
  ...extra,
})
const paginaAparatos = (terminals: Fila[], total = terminals.length, page = 1) => ({
  everything: { categories: 20, products: 1022 },
  terminals,
  total,
  page,
  pageSize: 50,
})
const menu = (id: string, name: string, categoryCount = 3) => ({ id, name, appliesToOnline: true, categoryCount })
const paginaMenus = (menus: ReturnType<typeof menu>[], total = menus.length) => ({ menus, total, page: 1, pageSize: 100 })
const NOMBRES: Record<string, string> = { m1: 'Desayunos', m2: 'Comidas' }

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
  return render(
    <QueryClientProvider client={qc}>
      <DeviceMenusTab />
    </QueryClientProvider>,
  )
}

// El popover es modal: deja lo demás aria-hidden mientras está abierto, por eso las consultas por fila van con `hidden`.
const enFila = (id: string) => within(screen.getByTestId(`device-menus-row-${id}`))
const selector = (id: string) => enFila(id).getByRole('combobox', { hidden: true })
const opcion = (nombre: RegExp) => screen.findByRole('option', { name: nombre, hidden: true })

beforeEach(() => {
  acceso.permisos = ['tpv:read', 'tpv:update', 'menu:create']
  svc.getDeviceMenus.mockResolvedValue(
    paginaAparatos([fila('t1', 'Caja'), fila('t2', 'Barra', { areaName: 'Cafetería', sees: { categories: 4, products: 88 } })]),
  )
  svc.getDeviceMenuOptions.mockResolvedValue(paginaMenus([menu('m1', 'Desayunos', 3), menu('m2', 'Comidas', 5)]))
  svc.setTerminalMenus.mockImplementation((_v: string, id: string, ids: string[]) =>
    Promise.resolve(fila(id, 'Caja', { menus: ids.map(m => ({ id: m, name: NOMBRES[m] })), sees: { categories: 4, products: 88 } })),
  )
})

describe('DeviceMenusTab — qué muestra cada aparato', () => {
  it('va dentro de FeatureGate DEVICE_MENUS', async () => {
    pintar()
    expect(screen.getByTestId('gate-DEVICE_MENUS')).toBeInTheDocument()
    await screen.findByText('Caja')
  })

  it('mientras carga no dice vacío ni error', () => {
    svc.getDeviceMenus.mockReturnValue(nunca())
    pintar()
    expect(screen.getByTestId('device-menus-cargando')).toBeInTheDocument()
    expect(screen.queryByText('deviceMenus.sinAparatos')).not.toBeInTheDocument()
    expect(screen.queryByText('deviceMenus.error')).not.toBeInTheDocument()
  })

  it('pinta una fila por aparato con lo que ve', async () => {
    pintar()
    await screen.findByText('Caja')
    expect(enFila('t1').getByText('—')).toBeInTheDocument()
    expect(enFila('t1').getByText(ve(20, 1022))).toBeInTheDocument()
    expect(enFila('t2').getByText('Barra')).toBeInTheDocument()
    expect(enFila('t2').getByText('Cafetería')).toBeInTheDocument()
    expect(enFila('t2').getByText(ve(4, 88))).toBeInTheDocument()
    expect(svc.getDeviceMenus).toHaveBeenCalledWith('v1', { page: 1, pageSize: 50 })
  })

  it('lista vacía se lee Todos los menús', async () => {
    pintar()
    await screen.findByText('Caja')
    expect(selector('t1')).toHaveTextContent('deviceMenus.todosLosMenus')
  })

  it('elegir un menú llama setTerminalMenus y la fila cambia sin recargar', async () => {
    // La relectura nunca contesta: lo que cambie en la fila sólo puede venir de la respuesta del PUT.
    svc.getDeviceMenus.mockResolvedValueOnce(paginaAparatos([fila('t1', 'Caja')])).mockReturnValue(nunca())
    const user = userEvent.setup()
    pintar()
    await screen.findByText('Caja')
    await user.click(selector('t1'))
    await user.click(await opcion(/Desayunos/))
    await waitFor(() => expect(svc.setTerminalMenus).toHaveBeenCalledWith('v1', 't1', ['m1']))
    await waitFor(() => expect(enFila('t1').getByText(ve(4, 88))).toBeInTheDocument())
    expect(selector('t1')).toHaveTextContent('Desayunos')
    expect(avisos.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'deviceMenus.guardado' }))
  })

  it('quitar el último menú con su X manda [] y la fila dice Todos los menús', async () => {
    svc.getDeviceMenus
      .mockResolvedValueOnce(paginaAparatos([fila('t1', 'Caja', { menus: [{ id: 'm1', name: 'Desayunos' }] })]))
      .mockReturnValue(nunca())
    const user = userEvent.setup()
    pintar()
    await screen.findByText('Caja')
    await user.click(enFila('t1').getByText('Desayunos'))
    await waitFor(() => expect(svc.setTerminalMenus).toHaveBeenCalledWith('v1', 't1', []))
    await waitFor(() => expect(selector('t1')).toHaveTextContent('deviceMenus.todosLosMenus'))
  })

  it('mientras guarda, el selector de esa fila está deshabilitado', async () => {
    svc.setTerminalMenus.mockReturnValue(nunca())
    const user = userEvent.setup()
    pintar()
    await screen.findByText('Caja')
    await user.click(selector('t1'))
    await user.click(await opcion(/Desayunos/))
    await waitFor(() => expect(selector('t1')).toBeDisabled())
    expect(selector('t2')).toBeEnabled()
  })

  it('dos elecciones seguidas con la relectura retenida conservan las dos', async () => {
    svc.getDeviceMenus.mockResolvedValueOnce(paginaAparatos([fila('t1', 'Caja')])).mockReturnValue(nunca())
    const user = userEvent.setup()
    pintar()
    await screen.findByText('Caja')
    await user.click(selector('t1'))
    await user.click(await opcion(/Desayunos/))
    await waitFor(() => expect(selector('t1')).toHaveTextContent('Desayunos'))
    await waitFor(() => expect(selector('t1')).toBeEnabled())
    await user.click(await opcion(/Comidas/))
    await waitFor(() => expect(svc.setTerminalMenus).toHaveBeenLastCalledWith('v1', 't1', ['m1', 'm2']))
    await waitFor(() => expect(selector('t1')).toHaveTextContent('Comidas'))
    expect(selector('t1')).toHaveTextContent('Desayunos')
  })

  it('un error al guardar enseña el mensaje del servidor', async () => {
    svc.setTerminalMenus.mockRejectedValue({ response: { data: { message: 'Ese menú no existe, está apagado o no es para aparatos.' } } })
    const user = userEvent.setup()
    pintar()
    await screen.findByText('Caja')
    await user.click(selector('t1'))
    await user.click(await opcion(/Desayunos/))
    await waitFor(() =>
      expect(avisos.toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Ese menú no existe, está apagado o no es para aparatos.', variant: 'destructive' }),
      ),
    )
    expect(selector('t1')).toHaveTextContent('deviceMenus.todosLosMenus')
  })

  it('las opciones salen de tpvs/menus/options y no se llama getMenus', async () => {
    const user = userEvent.setup()
    pintar()
    await screen.findByText('Caja')
    await user.click(selector('t1'))
    // El selector dice cuántas categorías tiene el MENÚ, con otra llave que «En su pantalla ve»: no son la misma cuenta.
    expect(await opcion(/Desayunos/)).toHaveTextContent('deviceMenus.categoriasDelMenu(3)')
    expect(svc.getDeviceMenuOptions).toHaveBeenCalledWith('v1', { search: undefined, page: 1, pageSize: 100 })
    expect(menuSvc.getMenus).not.toHaveBeenCalled()
    // Todas las opciones cupieron: no hace falta el buscador de menús.
    expect(screen.queryByLabelText('deviceMenus.buscarMenus')).not.toBeInTheDocument()
  })

  it('con más opciones que las cargadas aparece el buscador', async () => {
    svc.getDeviceMenuOptions.mockResolvedValue(paginaMenus([menu('m1', 'Desayunos'), menu('m2', 'Comidas')], 150))
    pintar()
    const buscador = await screen.findByLabelText('deviceMenus.buscarMenus')
    fireEvent.change(buscador, { target: { value: 'des' } })
    await waitFor(() => expect(svc.getDeviceMenuOptions).toHaveBeenCalledWith('v1', { search: 'des', page: 1, pageSize: 100 }))
    // La búsqueda va en la llave: el buscador no se desmonta ni pierde lo escrito.
    expect(screen.getByLabelText('deviceMenus.buscarMenus')).toHaveValue('des')
  })

  it('un menú elegido que no está en la página de opciones se pinta con su nombre', async () => {
    svc.getDeviceMenus.mockResolvedValue(paginaAparatos([fila('t1', 'Caja', { menus: [{ id: 'm99', name: 'Menú viejo' }] })]))
    pintar()
    await screen.findByText('Caja')
    expect(enFila('t1').getByText('Menú viejo')).toBeInTheDocument()
  })

  it('aparato viejo dice Actualiza la app para que lo aplique', async () => {
    svc.getDeviceMenus.mockResolvedValue(
      paginaAparatos([
        fila('t1', 'Caja', { needsAppUpdate: true, seesAfterUpdate: { categories: 4, products: 88 } }),
        fila('t2', 'Barra', { needsAppUpdate: true, seesAfterUpdate: null }),
        fila('t3', 'Mostrador'),
      ]),
    )
    pintar()
    await screen.findByText('Caja')
    expect(enFila('t1').getByText('deviceMenus.actualizaLaApp')).toBeInTheDocument()
    // HOY ve todo; lo filtrado es lo que verá al actualizar (Ruling 11).
    expect(enFila('t1').getByText(ve(20, 1022))).toBeInTheDocument()
    expect(enFila('t1').getByText(`deviceMenus.veAlActualizar(${ve(4, 88)})`)).toBeInTheDocument()
    expect(enFila('t2').getByText('deviceMenus.actualizaLaApp')).toBeInTheDocument()
    expect(enFila('t2').queryByText(/deviceMenus.veAlActualizar/)).not.toBeInTheDocument()
    expect(enFila('t3').queryByText('deviceMenus.actualizaLaApp')).not.toBeInTheDocument()
  })

  it('sin tpv:update el selector está deshabilitado', async () => {
    acceso.permisos = ['tpv:read']
    pintar()
    await screen.findByText('Caja')
    expect(selector('t1')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'deviceMenus.nuevoMenu' })).not.toBeInTheDocument()
  })

  it('sin aparatos POS enseña sinAparatos', async () => {
    svc.getDeviceMenus.mockResolvedValue(paginaAparatos([]))
    pintar()
    expect(await screen.findByText('deviceMenus.sinAparatos')).toBeInTheDocument()
    expect(screen.queryByText('deviceMenus.error')).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('sin menús para aparatos lo dice y ofrece crear uno', async () => {
    svc.getDeviceMenuOptions.mockResolvedValue(paginaMenus([]))
    pintar()
    const aviso = await screen.findByTestId('device-menus-sin-menus')
    expect(aviso).toHaveTextContent('deviceMenus.sinMenusParaAparatos')
    expect(within(aviso).getByRole('button', { name: 'deviceMenus.nuevoMenu' })).toBeInTheDocument()
    // Los aparatos se siguen viendo: hoy muestran todo.
    expect(screen.getByText('Caja')).toBeInTheDocument()
  })

  it('error se distingue de vacío', async () => {
    svc.getDeviceMenus.mockRejectedValue(new Error('boom'))
    pintar()
    expect(await screen.findByText('deviceMenus.error')).toBeInTheDocument()
    expect(screen.queryByText('deviceMenus.sinAparatos')).not.toBeInTheDocument()
    svc.getDeviceMenus.mockResolvedValue(paginaAparatos([fila('t1', 'Caja')]))
    fireEvent.click(screen.getByRole('button', { name: 'deviceMenus.reintentar' }))
    expect(await screen.findByText('Caja')).toBeInTheDocument()
  })

  it('«+ Nuevo menú» nace sólo con Aparatos y al crear vuelve a pedir aparatos y opciones', async () => {
    const user = userEvent.setup()
    pintar()
    await screen.findByText('Caja')
    await user.click(screen.getByRole('button', { name: 'deviceMenus.nuevoMenu' }))
    expect(JSON.parse(screen.getByTestId('asistente').dataset.defaults!)).toEqual({ appliesToDevices: true, appliesToOnline: false })
    const aparatos = svc.getDeviceMenus.mock.calls.length
    const opciones = svc.getDeviceMenuOptions.mock.calls.length
    await user.click(screen.getByRole('button', { name: 'crear' }))
    await waitFor(() => expect(svc.getDeviceMenus.mock.calls.length).toBeGreaterThan(aparatos))
    await waitFor(() => expect(svc.getDeviceMenuOptions.mock.calls.length).toBeGreaterThan(opciones))
  })

  it('con más aparatos que una página enseña el total y pide la siguiente', async () => {
    svc.getDeviceMenus.mockResolvedValue(paginaAparatos([fila('t1', 'Caja')], 120))
    const user = userEvent.setup()
    pintar()
    await screen.findByText('Caja')
    expect(screen.getByText('deviceMenus.rango(1,50,120)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'deviceMenus.siguiente' }))
    await waitFor(() => expect(svc.getDeviceMenus).toHaveBeenCalledWith('v1', { page: 2, pageSize: 50 }))
  })
})
