/**
 * Aparatos claros, Paso 2: el bloque «Qué hace este aparato» de la ficha. Trae migrados los casos de los cuadros del Paso 1
 * (`DeviceRoleSummary`), con sus mismas reglas, y lo nuevo: «Cambiar» en sitio.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  permisos: [] as string[],
  plan: { hasAccess: true, isResolved: true, requiredTier: 'PRO', isLoading: false },
  overview: vi.fn(),
  pasos: { data: undefined as Record<string, boolean> | undefined, isLoading: false, isError: false },
  pantalla: { data: undefined as { design: unknown } | undefined, isLoading: false, isError: false },
}))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => h.permisos.includes(p) }) }))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useTierFeatureAccess: () => h.plan }))
vi.mock('@/services/areaTickets.service', () => ({ getAreaTicketOverview: h.overview }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}(${Object.values(o).join(',')})` : k) }),
}))
vi.mock('@/pages/Settings/components/areaTickets/TerminalAreaTicketEditor', () => ({
  TerminalAreaTicketEditor: (p: { terminal: { id: string }; showScale: boolean }) => (
    <div data-testid="editor-de-vales" data-terminal={p.terminal.id} data-bascula={String(p.showScale)} />
  ),
}))
vi.mock('../components/DeviceMenusEditor', () => ({ DeviceMenusEditor: () => <div data-testid="editor-de-menus" /> }))
vi.mock('../customer-display/queries', () => ({
  usePasosDelCobro: () => h.pasos,
  useCustomerDisplay: () => h.pantalla,
}))

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DeviceSetupBlock, type FichaDelBloque } from '../components/DeviceSetupBlock'
import { useIrALaSeccion } from '../components/useIrALaSeccion'

const BASE = '/venues/galeterie'
const panaderia = { id: 'a1', name: 'Panadería', sendsComanda: false, active: true }
const pc = (extra: Partial<FichaDelBloque> = {}): FichaDelBloque => ({ id: 't1', name: 'Caja 1', type: 'POS_DESKTOP', areaTicketsEnabled: true, ...extra })
const emitePanaderia = pc({ canIssueAreaTickets: true, defaultWorkspace: 'AREA_OPERATIONS', fulfillmentArea: panaderia })

function Donde() {
  return <span data-testid="ruta">{useLocation().pathname}</span>
}
const pintar = (tpv: FichaDelBloque, onGoTo = vi.fn()) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/venues/galeterie/devices/t1']}>
        <DeviceSetupBlock venueId="v1" tpv={tpv} fullBasePath={BASE} onGoTo={onGoTo} />
        <Donde />
      </MemoryRouter>
    </QueryClientProvider>,
  )
const renglon = (tour: string) => document.querySelector(`[data-tour="${tour}"]`) as HTMLElement

beforeEach(() => {
  h.permisos = ['area-tickets:configure', 'tpv:update', 'tpv-settings:read', 'tpv-settings:update']
  h.plan = { hasAccess: true, isResolved: true, requiredTier: 'PRO', isLoading: false }
  h.pasos = { data: undefined, isLoading: false, isError: false }
  h.pantalla = { data: undefined, isLoading: false, isError: false }
  h.overview.mockReset()
  h.overview.mockResolvedValue({
    terminals: [{ id: 't1', name: 'Caja 1' }],
    areas: [],
    scaleProfiles: [],
    effective: { scales: false },
  })
})

describe('DeviceSetupBlock (casos migrados del Paso 1)', () => {
  it('PC que emite vales de Panadería sin comanda, con su menú: papel, comanda y menú con su «Cambiar»', () => {
    pintar({ ...emitePanaderia, deviceMenus: { menus: [{ id: 'm1', name: 'Cremería y Panadería' }], needsAppUpdate: false } })
    const papel = renglon('device-setup-papel')
    expect(within(papel).getByText('device.papel.emite(Panadería)')).toBeInTheDocument()
    expect(within(papel).getByRole('button', { name: 'device.setup.change' })).toBeInTheDocument()
    expect(within(renglon('device-setup-comanda')).getByText(/device\.role\.comandaOff/)).toBeInTheDocument()
    expect(within(renglon('device-setup-comanda')).getByRole('link')).toHaveAttribute('href', `${BASE}/settings/area-tickets#areas`)
    expect(within(renglon('device-setup-menu')).getByText('Cremería y Panadería')).toBeInTheDocument()
    expect(within(renglon('device-setup-menu')).getByRole('button', { name: 'device.setup.change' })).toBeInTheDocument()
  })

  it('la caja: «Cobra vales», sin comanda; «Todos los menús»', () => {
    pintar(pc({ canCheckoutAreaTickets: true, deviceMenus: { menus: [], needsAppUpdate: false } }))
    expect(within(renglon('device-setup-papel')).getByText('device.papel.cobraVales')).toBeInTheDocument()
    expect(renglon('device-setup-comanda')).toBeNull()
    expect(within(renglon('device-setup-menu')).getByText('device.role.allMenus')).toBeInTheDocument()
  })

  it('D5: con «Emitir» y «Cobrar» prendidos, sólo emite', () => {
    pintar({ ...emitePanaderia, canCheckoutAreaTickets: true })
    expect(within(renglon('device-setup-papel')).getByText('device.papel.emite(Panadería)')).toBeInTheDocument()
  })

  it('una app vieja que no aplica el menú lo dice', () => {
    pintar(pc({ areaTicketsEnabled: undefined, deviceMenus: { menus: [{ id: 'm1', name: 'Café' }], needsAppUpdate: true } }))
    expect(screen.getByText('device.role.menuNeedsUpdate')).toBeInTheDocument()
  })

  it('sin permiso de Vales por área no hay «Cambiar» del papel ni enlace de la comanda (el letrero sí)', () => {
    h.permisos = []
    pintar(emitePanaderia)
    expect(within(renglon('device-setup-papel')).getByText('device.papel.emite(Panadería)')).toBeInTheDocument()
    expect(within(renglon('device-setup-papel')).queryByRole('button')).toBeNull()
    expect(within(renglon('device-setup-comanda')).queryByRole('link')).toBeNull()
  })

  it('«Emitir» prendido sin área: dice «Punto de venta» y por qué, en ámbar (Codex r1 #2)', () => {
    pintar(pc({ canIssueAreaTickets: true, fulfillmentArea: null }))
    expect(within(renglon('device-setup-papel')).getByText('device.papel.puntoDeVenta')).toBeInTheDocument()
    expect(within(renglon('device-setup-papel')).getByText('device.role.emitirSinEfecto.sinArea')).toBeInTheDocument()
    expect(renglon('device-setup-comanda')).toBeNull()
  })

  it('Codex r3 #2: con «Preparar después de pagar» y comanda prendida no promete «Manda comanda»', () => {
    pintar(pc({ canIssueAreaTickets: true, defaultWorkspace: 'AREA_OPERATIONS', fulfillmentArea: { ...panaderia, sendsComanda: true, fulfillmentMode: 'PREPARE_ON_PAID' } }))
    expect(within(renglon('device-setup-papel')).getByText('device.papel.emite(Panadería)')).toBeInTheDocument()
    expect(renglon('device-setup-comanda')).toBeNull()
  })
})

describe('DeviceSetupBlock (Paso 2: cambiar en sitio)', () => {
  it('Cambiar del papel abre el editor encima y no navega', async () => {
    h.overview.mockResolvedValue({ terminals: [{ id: 't1', name: 'Caja 1' }], areas: [], scaleProfiles: [], effective: { scales: true } })
    pintar(emitePanaderia)
    fireEvent.click(within(renglon('device-setup-papel')).getByRole('button', { name: 'device.setup.change' }))
    const editor = await screen.findByTestId('editor-de-vales')
    expect(editor).toHaveAttribute('data-terminal', 't1')
    expect(editor).toHaveAttribute('data-bascula', 'true')
    expect(h.overview).toHaveBeenCalledWith('v1')
    expect(screen.getByTestId('ruta')).toHaveTextContent('/venues/galeterie/devices/t1')
  })

  it('el overview de vales no se pide hasta abrir el editor', () => {
    pintar(emitePanaderia)
    expect(h.overview).not.toHaveBeenCalled()
  })

  it('sin area-tickets:configure no hay Cambiar en el papel ni se pide el overview', () => {
    h.permisos = ['tpv:update']
    pintar(emitePanaderia)
    expect(within(renglon('device-setup-papel')).queryByRole('button')).toBeNull()
    expect(h.overview).not.toHaveBeenCalled()
  })

  it('una TPV dice Terminal de cobro sin Cambiar', () => {
    pintar(pc({ type: 'TPV_ANDROID', canIssueAreaTickets: true }))
    expect(within(renglon('device-setup-papel')).getByText('device.papel.terminalDeCobro')).toBeInTheDocument()
    expect(within(renglon('device-setup-papel')).queryByRole('button')).toBeNull()
  })

  it('sin vales dice Punto de venta sin Cambiar', () => {
    pintar(pc({ areaTicketsEnabled: false }))
    expect(within(renglon('device-setup-papel')).getByText('device.papel.puntoDeVenta')).toBeInTheDocument()
    expect(within(renglon('device-setup-papel')).queryByRole('button')).toBeNull()
  })

  it('Cambiar del menú abre su editor encima', async () => {
    pintar(pc({ deviceMenus: { menus: [], needsAppUpdate: false } }))
    fireEvent.click(within(renglon('device-setup-menu')).getByRole('button', { name: 'device.setup.change' }))
    expect(await screen.findByTestId('editor-de-menus')).toBeInTheDocument()
  })

  it('sin Pro el menú dice Todos los menús y no hay botón Cambiar ni con teclado', async () => {
    h.plan = { hasAccess: false, isResolved: true, requiredTier: 'PRO', isLoading: false, isError: false }
    pintar(pc({ areaTicketsEnabled: false, deviceMenus: { menus: [], needsAppUpdate: false } }))
    const menu = renglon('device-setup-menu')
    expect(within(menu).getByText('device.role.allMenus')).toBeInTheDocument()
    expect(within(menu).queryByRole('button')).toBeNull()
    expect(within(menu).getByRole('link', { name: 'device.setup.menuPlanInvite(Pro)' })).toHaveAttribute('href', `${BASE}/devices?tab=menus`)
    // Con el teclado, lo único enfocable del renglón es la invitación de plan.
    const user = userEvent.setup()
    for (let i = 0; i < 10; i++) {
      await user.tab()
      expect(document.activeElement?.textContent).not.toBe('device.setup.change')
    }
  })

  it('mientras el plan no se resuelve, no hay botón Cambiar del menú', () => {
    h.plan = { hasAccess: true, isResolved: false, requiredTier: 'PRO', isLoading: true }
    pintar(pc({ deviceMenus: { menus: [], needsAppUpdate: false } }))
    expect(within(renglon('device-setup-menu')).queryByRole('button')).toBeNull()
    expect(within(renglon('device-setup-menu')).queryByRole('link')).toBeNull()
  })

  it('sin tpv:update no hay Cambiar del menú', () => {
    h.permisos = ['area-tickets:configure']
    pintar(pc({ deviceMenus: { menus: [], needsAppUpdate: false } }))
    expect(within(renglon('device-setup-menu')).queryByRole('button')).toBeNull()
  })

  it('¿Cómo cobra? dice los pasos prendidos; en gris con el aviso si sólo emite', () => {
    h.pasos = { data: { showTipScreen: true, showReviewScreen: false, showReceiptScreen: true }, isLoading: false, isError: false }
    pintar({ ...emitePanaderia, type: 'POS_ANDROID' })
    const cobro = renglon('device-setup-cobro')
    expect(within(cobro).getByText('customerDisplay:steps.tip · customerDisplay:steps.receipt')).toBeInTheDocument()
    expect(within(cobro).getByTestId('device-setup-cobro-dimmed')).toBeInTheDocument()
    expect(within(cobro).getByText('customerDisplay:steps.notCharging')).toBeInTheDocument()
  })

  it('una PC de WINDOWS no tiene renglón de cobro ni de pantalla (no aparecen hoy en su ficha)', () => {
    pintar(pc())
    expect(renglon('device-setup-cobro')).toBeNull()
    expect(renglon('device-setup-pantalla')).toBeNull()
  })

  it('Cambiar de ¿Cómo cobra? lleva a la sección de pasos del cobro', () => {
    h.pasos = { data: { showTipScreen: false, showReviewScreen: false, showReceiptScreen: false }, isLoading: false, isError: false }
    const onGoTo = vi.fn()
    pintar(pc({ type: 'POS_IOS' }), onGoTo)
    expect(within(renglon('device-setup-cobro')).getByText('device.setup.stepsNone')).toBeInTheDocument()
    fireEvent.click(within(renglon('device-setup-cobro')).getByRole('button', { name: 'device.setup.change' }))
    expect(onGoTo).toHaveBeenCalledWith('checkout-steps')
  })

  it('Cambiar de ¿Cómo cobra? desde la pestaña Comandos cambia a Información y llega a la sección', async () => {
    h.pasos = { data: { showTipScreen: true, showReviewScreen: false, showReceiptScreen: false }, isLoading: false, isError: false }
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    function Ficha() {
      const [tab, setTab] = useState('commands')
      const irA = useIrALaSeccion(tab, () => setTab('info'))
      return (
        <>
          <span data-testid="pestana">{tab}</span>
          <DeviceSetupBlock venueId="v1" tpv={pc({ type: 'POS_ANDROID' })} fullBasePath={BASE} onGoTo={irA} />
          {tab === 'info' && <div id="ficha-checkout-steps" tabIndex={-1} data-testid="seccion-de-pasos" />}
        </>
      )
    }
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <Ficha />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(screen.queryByTestId('seccion-de-pasos')).toBeNull()
    fireEvent.click(within(renglon('device-setup-cobro')).getByRole('button', { name: 'device.setup.change' }))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('seccion-de-pasos')))
    expect(screen.getByTestId('pestana')).toHaveTextContent('info')
    expect(scroll).toHaveBeenCalled()
  })

  it('con las pestañas reales (Radix), Cambiar desde Comandos llega a la sección aunque se monte después (Codex final #2)', async () => {
    h.pasos = { data: { showTipScreen: true, showReviewScreen: false, showReceiptScreen: false }, isLoading: false, isError: false }
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    function Ficha() {
      const [tab, setTab] = useState('commands')
      const irA = useIrALaSeccion(tab, () => setTab('info'))
      return (
        <>
          <DeviceSetupBlock venueId="v1" tpv={pc({ type: 'POS_ANDROID' })} fullBasePath={BASE} onGoTo={irA} />
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="info">info</TabsTrigger>
              <TabsTrigger value="commands">commands</TabsTrigger>
            </TabsList>
            <TabsContent value="info">
              <div id="ficha-checkout-steps" tabIndex={-1} data-testid="seccion-de-pasos" />
            </TabsContent>
            <TabsContent value="commands">comandos</TabsContent>
          </Tabs>
        </>
      )
    }
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <Ficha />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(screen.queryByTestId('seccion-de-pasos')).toBeNull()
    fireEvent.click(within(renglon('device-setup-cobro')).getByRole('button', { name: 'device.setup.change' }))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('seccion-de-pasos')))
    expect(scroll).toHaveBeenCalledTimes(1)
  })

  it('si la sección no aparece en ~60 cuadros, suelta el pendiente y no salta después por sorpresa', async () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    const { result, rerender } = renderHook(({ tab }) => useIrALaSeccion(tab, () => {}), { initialProps: { tab: 'info' } })
    const cuadros = vi.spyOn(window, 'requestAnimationFrame')
    act(() => result.current('checkout-steps'))
    // 1 intento inmediato + 59 cuadros = 60, y ya no pide más.
    await waitFor(() => expect(cuadros).toHaveBeenCalledTimes(59), { timeout: 10_000 })
    await act(() => new Promise(r => setTimeout(r, 50)))
    expect(cuadros).toHaveBeenCalledTimes(59)
    cuadros.mockRestore()
    const el = document.createElement('div')
    el.id = 'ficha-checkout-steps'
    el.tabIndex = -1
    document.body.appendChild(el)
    rerender({ tab: 'commands' })
    rerender({ tab: 'info' })
    await act(() => new Promise(r => setTimeout(r, 100)))
    expect(scroll).not.toHaveBeenCalled()
    expect(document.activeElement).not.toBe(el)
    el.remove()
  })

  it('¿Cómo cobra? con datos viejos en caché y la relectura fallida dice el error, no los pasos viejos (Codex final #3)', () => {
    h.pasos = { data: { showTipScreen: true, showReviewScreen: false, showReceiptScreen: false }, isLoading: false, isError: true }
    pintar(pc({ type: 'POS_ANDROID' }))
    const cobro = renglon('device-setup-cobro')
    expect(within(cobro).getByText('device.setup.loadError')).toBeInTheDocument()
    expect(within(cobro).queryByText('customerDisplay:steps.tip')).toBeNull()
  })

  it('Pantalla del cliente con datos viejos y la relectura fallida dice el error, no el diseño viejo', () => {
    h.permisos = [...h.permisos, 'customer-display:read']
    h.pantalla = { data: { design: null }, isLoading: false, isError: true }
    pintar(pc({ type: 'POS_ANDROID' }))
    const pantalla = renglon('device-setup-pantalla')
    expect(within(pantalla).getByText('device.setup.loadError')).toBeInTheDocument()
    expect(within(pantalla).queryByText(/customerDisplay:card\.design/)).toBeNull()
  })

  it.each(['PRINTER_RECEIPT', 'PRINTER_KITCHEN', 'KDS'])('%s: «¿Qué hace?» dice que no aplica, sin Cambiar ni aviso (Codex final #4)', type => {
    pintar(pc({ type, canDeliverAreaTickets: true, fulfillmentArea: null }))
    const papel = renglon('device-setup-papel')
    expect(within(papel).getByText('device.papel.noAplica')).toBeInTheDocument()
    expect(within(papel).queryByRole('button')).toBeNull()
    expect(within(papel).queryByText(/SinEfecto/)).toBeNull()
  })
})
