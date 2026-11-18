// src/pages/Delivery/components/ChannelSettingsDialog.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { DeliveryChannelLink, DeliveryWeeklyHours } from '@/types/delivery'

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }))

// t devuelve la llave tal cual para poder afirmar sobre llaves i18n (convención del repo). Sólo `precio` se pega, para ver el
// precio que dice la pantalla («Rappi lo publica en $80»).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, o?: { precio?: unknown }) => (o?.precio !== undefined ? `${key} $${o.precio}` : key) }),
}))

const mockUpdateChannel = vi.fn()
vi.mock('@/services/delivery.service', () => ({
  updateChannel: (...args: unknown[]) => mockUpdateChannel(...args),
}))

const mockGetProducts = vi.fn()
vi.mock('@/services/menu.service', () => ({
  getProducts: (...args: unknown[]) => mockGetProducts(...args),
}))

vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => p === 'delivery-channels:manage' }) }))
vi.mock('./ImpresionDelCanalEditor', () => ({
  ImpresionDelCanalEditor: (p: {
    venueId: string
    channel: { id: string }
    canEdit: boolean
    onPendienteChange?: (x: unknown) => void
    conBotonGuardar?: boolean
  }) => (
    <div>
      <span data-testid="editor-impresion">{`${p.venueId}|${p.channel.id}|${p.canEdit}`}</span>
      <span data-testid="editor-boton">{String(p.conBotonGuardar)}</span>
      <span data-testid="editor-guardado">{JSON.stringify((p.channel as DeliveryChannelLink).config?.impresion ?? null)}</span>
      <button type="button" onClick={() => p.onPendienteChange?.({ comanda: 'UNA_ESTACION', estacionId: 'barra', empaque: 'NO' })}>
        elegir-todo-junto
      </button>
    </div>
  ),
}))

import { ChannelSettingsDialog } from './ChannelSettingsDialog'

const HORARIO_GUARDADO: DeliveryWeeklyHours = {
  monday: { enabled: true, ranges: [{ open: '11:00', close: '23:00' }] },
  tuesday: { enabled: true, ranges: [{ open: '11:00', close: '23:00' }] },
  wednesday: { enabled: true, ranges: [{ open: '11:00', close: '23:00' }] },
  thursday: { enabled: true, ranges: [{ open: '11:00', close: '23:00' }] },
  friday: { enabled: true, ranges: [{ open: '11:00', close: '23:00' }] },
  saturday: { enabled: true, ranges: [{ open: '11:00', close: '23:00' }] },
  sunday: { enabled: false, ranges: [] },
}

function channel(overrides: Partial<DeliveryChannelLink> = {}): DeliveryChannelLink {
  return {
    id: 'link-1',
    venueId: 'venue-1',
    provider: 'UBER_EATS',
    status: 'ACTIVE',
    orderAcceptanceMode: 'AUTO',
    autoSyncMenu: true,
    lastMenuSyncAt: '2026-07-18T10:00:00.000Z',
    externalLocationId: 'ext-1',
    ...overrides,
  }
}

/** El canal se conectó el 1-jun; lo creado antes nunca sale como «nuevo». */
const CONECTADO = '2026-06-01T00:00:00.000Z'
const DESPUES = '2026-07-01T00:00:00.000Z'

const prod = (id: string, sku: string, extra: Record<string, unknown> = {}) => ({
  id,
  sku,
  name: sku,
  price: 65,
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  categoryId: 'c1',
  category: { name: 'Bebidas' },
  ...extra,
})

let invalidateSpy: ReturnType<typeof vi.spyOn>
let refetchSpy: ReturnType<typeof vi.spyOn>

function renderDialog(ch: DeliveryChannelLink) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
  refetchSpy = vi.spyOn(qc, 'refetchQueries')
  const arbol = (c: DeliveryChannelLink) => (
    <QueryClientProvider client={qc}>
      <ChannelSettingsDialog open onClose={vi.fn()} venueId="venue-1" channel={c} />
    </QueryClientProvider>
  )
  const r = render(arbol(ch))
  return { ...r, rerenderCon: (c: DeliveryChannelLink) => r.rerender(arbol(c)) }
}

describe('ChannelSettingsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateChannel.mockResolvedValue(channel())
    mockGetProducts.mockResolvedValue([])
  })

  // ── El bug que originó la pantalla ────────────────────────────────────────────────
  // `deliveryHours` y `precios` viven en la MISMA columna JSON. Si el formulario mandara
  // sólo el horario, el margen del comercio desaparecería — y el margen es lo único que
  // evita perder dinero en cada pedido, porque el marketplace se queda ~30%. No falla, no
  // avisa: simplemente deja de cobrar de más.
  it('manda el horario Y el margen juntos — guardar el horario NO deja fuera el margen', async () => {
    renderDialog(channel({ config: { deliveryHours: HORARIO_GUARDADO, precios: { markupPercent: 30 } } }))

    fireEvent.click(screen.getByText('settings.save'))

    await waitFor(() => expect(mockUpdateChannel).toHaveBeenCalled())
    const [, , body] = mockUpdateChannel.mock.calls[0]
    expect(body.config.precios).toEqual({ markupPercent: 30 })
    expect(body.config.deliveryHours).toEqual(HORARIO_GUARDADO)
  })

  it('borrar el campo de margen manda `precios: {}` — omitirlo dejaría vivo el markup viejo', async () => {
    renderDialog(channel({ config: { deliveryHours: HORARIO_GUARDADO, precios: { markupPercent: 30 } } }))

    fireEvent.change(screen.getByLabelText('settings.markupTitle'), { target: { value: '' } })
    fireEvent.click(screen.getByText('settings.save'))

    await waitFor(() => expect(mockUpdateChannel).toHaveBeenCalled())
    expect(mockUpdateChannel.mock.calls[0][2].config.precios).toEqual({})
  })

  // ── El input numérico no debe atrapar al usuario ──────────────────────────────────
  // Un `parseFloat(x) || 0` hace que al borrar el campo el valor rebote a 0 y no se pueda
  // vaciar. Regla obligatoria de `ui-patterns.md`.
  it('el campo de margen se puede dejar vacío (no rebota a 0)', () => {
    renderDialog(channel({ config: { precios: { markupPercent: 30 } } }))
    const input = screen.getByLabelText('settings.markupTitle') as HTMLInputElement

    expect(input.value).toBe('30')
    fireEvent.change(input, { target: { value: '' } })
    expect(input.value).toBe('')
  })

  it('avisa que el horario es un ESTIMADO cuando nadie lo configuró', () => {
    renderDialog(channel({ config: { precios: { markupPercent: 30 } } }))
    expect(screen.getByText('settings.hoursEstimated')).toBeInTheDocument()
  })

  it('no avisa de estimado cuando el horario SÍ está configurado', () => {
    renderDialog(channel({ config: { deliveryHours: HORARIO_GUARDADO } }))
    expect(screen.queryByText('settings.hoursEstimated')).not.toBeInTheDocument()
  })

  // ── Bloquear antes de guardar, no después ─────────────────────────────────────────
  // El backend rechaza el horario inválido, pero un error de servidor sale lejos del campo
  // que lo causó. El usuario tiene que ver QUÉ día está mal mientras lo puede corregir.
  it('bloquea guardar si un día tiene la hora de cierre antes de la de apertura', async () => {
    renderDialog(channel({ config: { deliveryHours: HORARIO_GUARDADO } }))

    // `getAllBy…`: el `t` mockeado devuelve la llave sin interpolar, así que los 6 días
    // comparten la misma etiqueta. El primero es lunes.
    fireEvent.change(screen.getAllByLabelText('settings.opensAt')[0], { target: { value: '23:00' } })

    await waitFor(() => expect(screen.getByText('settings.errorCloseBeforeOpen')).toBeInTheDocument())
    expect((screen.getByText('settings.save').closest('button') as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByText('settings.save'))
    expect(mockUpdateChannel).not.toHaveBeenCalled()
  })

  it('bloquea guardar con un margen fuera de rango (500%)', async () => {
    renderDialog(channel({ config: { deliveryHours: HORARIO_GUARDADO } }))

    fireEvent.change(screen.getByLabelText('settings.markupTitle'), { target: { value: '500' } })

    await waitFor(() => expect(screen.getByText('settings.errorMarkupRange')).toBeInTheDocument())
    expect(mockUpdateChannel).not.toHaveBeenCalled()
  })

  it('apagar un día lo manda cerrado, no con un rango vacío', async () => {
    renderDialog(channel({ config: { deliveryHours: HORARIO_GUARDADO } }))

    fireEvent.click(screen.getByLabelText('settings.day.monday'))
    fireEvent.click(screen.getByText('settings.save'))

    await waitFor(() => expect(mockUpdateChannel).toHaveBeenCalled())
    expect(mockUpdateChannel.mock.calls[0][2].config.deliveryHours.monday.enabled).toBe(false)
  })

  it('trae la sección «Impresión» con el editor del canal y el permiso de editar', () => {
    renderDialog(channel())
    expect(screen.getByTestId('editor-impresion').textContent).toBe('venue-1|link-1|true')
  })

  // La lista de canales usa ['deliveryChannels', venueId]; con otra llave guardar aquí no refrescaba la lista ni la otra puerta.
  it('«Guardar» de arriba guarda también la impresión elegida y sin guardar (no se pierde al cerrar)', async () => {
    renderDialog(channel({ config: { deliveryHours: HORARIO_GUARDADO } }))
    fireEvent.click(screen.getByText('elegir-todo-junto'))
    fireEvent.click(screen.getByText('settings.save'))

    await waitFor(() => expect(mockUpdateChannel).toHaveBeenCalledTimes(1))
    const [, , body] = mockUpdateChannel.mock.calls[0]
    expect(body.config.impresion).toEqual({ comanda: 'UNA_ESTACION', estacionId: 'barra', empaque: 'NO' })
    expect(body.config.deliveryHours).toEqual(HORARIO_GUARDADO)
  })

  it('sin cambios en la impresión, «Guardar» de arriba NO la manda (no pisa lo guardado desde Impresoras)', async () => {
    renderDialog(channel({ config: { deliveryHours: HORARIO_GUARDADO } }))
    fireEvent.click(screen.getByText('settings.save'))

    await waitFor(() => expect(mockUpdateChannel).toHaveBeenCalledTimes(1))
    const [, , body] = mockUpdateChannel.mock.calls[0]
    expect('impresion' in body.config).toBe(false)
  })

  it('UN solo «Guardar»: el editor de impresión va sin su botón propio', () => {
    renderDialog(channel())
    expect(screen.getByTestId('editor-boton').textContent).toBe('false')
  })

  it('un refresco que cambia OTRA llave de config no borra el horario que se está editando', async () => {
    const { rerenderCon } = renderDialog(channel({ config: { deliveryHours: HORARIO_GUARDADO } }))
    fireEvent.change(screen.getAllByLabelText('settings.opensAt')[0], { target: { value: '08:00' } })
    rerenderCon(channel({ config: { deliveryHours: HORARIO_GUARDADO, soldOutSkus: ['sku-1'] } as DeliveryChannelLink['config'] }))
    expect((screen.getAllByLabelText('settings.opensAt')[0] as HTMLInputElement).value).toBe('08:00')
  })

  it('al guardar refresca la MISMA consulta que usa la lista de canales', async () => {
    renderDialog(channel({ config: { deliveryHours: HORARIO_GUARDADO } }))
    fireEvent.click(screen.getByText('settings.save'))
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['deliveryChannels', 'venue-1'] }))
  })

  // ── D1: productos del canal ───────────────────────────────────────────────────────
  const guardar = () => fireEvent.click(screen.getByText('settings.save'))
  const cuerpo = async () => {
    await waitFor(() => expect(mockUpdateChannel).toHaveBeenCalled())
    return mockUpdateChannel.mock.calls[mockUpdateChannel.mock.calls.length - 1][2]
  }
  const fila = (nombre: string) => screen.getByRole('checkbox', { name: nombre }).closest('li') as HTMLElement
  const botonGuardar = () => screen.getByText('settings.save').closest('button') as HTMLButtonElement

  it('pide el catálogo sin recetas ni modificadores, ordenado por nombre', async () => {
    renderDialog(channel())
    await waitFor(() =>
      expect(mockGetProducts).toHaveBeenCalledWith('venue-1', { includeRecipe: false, includeModifiers: false, orderBy: 'name' }),
    )
  })

  it('sin lista: «Elegir cuáles» marca todos y «Guardar» manda todos los ids sin revisados', async () => {
    mockGetProducts.mockResolvedValue([prod('p1', 'LATTE'), prod('p2', 'TE')])
    renderDialog(channel({ createdAt: CONECTADO, config: { deliveryHours: HORARIO_GUARDADO } }))

    fireEvent.click(await screen.findByText('settings.productos.elegir'))
    expect(screen.getByRole('checkbox', { name: 'LATTE' })).toHaveAttribute('data-state', 'checked')
    guardar()

    const body = await cuerpo()
    expect([...body.config.productoIds].sort()).toEqual(['p1', 'p2'])
    expect(body.marcarRevisados ?? []).toEqual([])
  })

  it('sin lista y con más de 5,000 productos: «Elegir cuáles» arranca vacío y lo explica', async () => {
    mockGetProducts.mockResolvedValue(Array.from({ length: 5001 }, (_, i) => prod(`p${i}`, `C${i}`, { name: `Producto ${i}` })))
    renderDialog(channel({ createdAt: CONECTADO }))

    fireEvent.click(await screen.findByText('settings.productos.elegir'))

    expect(screen.getByText('settings.productos.masDe5000')).toBeInTheDocument()
    expect(screen.queryAllByRole('checkbox', { checked: true })).toHaveLength(0)
    expect(screen.getByText('settings.productos.listaVacia')).toBeInTheDocument()
    expect(botonGuardar().disabled).toBe(true)
  })

  it('5,002 productos creados antes de conectar: marcar uno manda ese id y ningún revisado (Codex r3 #4)', async () => {
    mockGetProducts.mockResolvedValue(Array.from({ length: 5002 }, (_, i) => prod(`p${i}`, `C${i}`, { name: `Producto ${i}` })))
    renderDialog(channel({ createdAt: CONECTADO }))

    fireEvent.click(await screen.findByText('settings.productos.elegir'))
    fireEvent.change(screen.getByLabelText('settings.productos.buscar'), { target: { value: 'Producto 4242' } })
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Producto 4242' }))
    guardar()

    const body = await cuerpo()
    expect(body.config.productoIds).toEqual(['p4242'])
    expect(body.marcarRevisados ?? []).toEqual([])
  })

  it('con lista por id: marcar otro con precio manda la lista, el precio, la huella de al abrir y los nuevos que quedan fuera', async () => {
    mockGetProducts.mockResolvedValue([prod('p1', 'LATTE'), prod('p2', 'TE'), prod('p3', 'MOKA', { createdAt: DESPUES })])
    renderDialog(channel({ provider: 'RAPPI', createdAt: CONECTADO, seleccionHuella: 'h-abrir', config: { productoIds: ['p1'] } }))

    fireEvent.click(await screen.findByRole('checkbox', { name: 'TE' }))
    fireEvent.change(within(fila('TE')).getByLabelText('settings.productos.precioDe'), { target: { value: '79.5' } })
    // Rappi sólo acepta pesos enteros: la pantalla dice el precio que de verdad se publica (Review Focus 4).
    expect(within(fila('TE')).getByText('settings.productos.rappiRedondea $80')).toBeInTheDocument()
    guardar()

    const body = await cuerpo()
    expect(body.config.productoIds).toEqual(['p1', 'p2'])
    expect(body.config.precios).toEqual({ porProducto: { p2: 79.5 } })
    expect(body.seleccionEsperada).toBe('h-abrir')
    expect(body.marcarRevisados).toEqual(['p3'])
  })

  it('lista vieja por código: se ve marcado su producto y «Guardar» la manda ya por id', async () => {
    mockGetProducts.mockResolvedValue([prod('p1', 'LATTE'), prod('p2', 'TE')])
    renderDialog(channel({ createdAt: CONECTADO, config: { productos: ['LATTE'] } }))

    expect(await screen.findByRole('checkbox', { name: 'LATTE' })).toHaveAttribute('data-state', 'checked')
    expect(screen.getByRole('checkbox', { name: 'TE' })).toHaveAttribute('data-state', 'unchecked')
    guardar()

    const body = await cuerpo()
    expect(body.config.productoIds).toEqual(['p1'])
    expect(body.marcarRevisados).toBeUndefined()
  })

  // 🔴 Codex impl r1 #1: el código de un producto puede empezar con `MOD-`. Descartarlo por el prefijo mandaba `porProducto: {}`
  // y el SERVIDOR borraba su precio: Rappi lo publicaba a $50 en vez de $79 sin que nadie lo tocara.
  it('canal viejo con un producto de código MOD-raro a $79: guardar sólo el horario conserva ese precio', async () => {
    mockGetProducts.mockResolvedValue([prod('pM', 'MOD-raro'), prod('p2', 'TE')])
    renderDialog(
      channel({
        provider: 'RAPPI',
        config: { deliveryHours: HORARIO_GUARDADO, productos: ['MOD-raro', 'TE'], precios: { overrides: { 'MOD-raro': 79 } } },
      }),
    )
    await screen.findByRole('checkbox', { name: 'MOD-raro' })
    fireEvent.change(screen.getAllByLabelText('settings.opensAt')[0], { target: { value: '08:00' } })
    guardar()

    const body = await cuerpo()
    expect(body.config.productoIds).toEqual(['pM', 'p2'])
    expect(body.config.precios).toEqual({ porProducto: { pM: 79 } })
  })

  it('desmarcar un producto de la lista no lo hace salir como «nuevo»; al guardar sí cuenta como revisado', async () => {
    mockGetProducts.mockResolvedValue([prod('p1', 'LATTE'), prod('p2', 'TE', { createdAt: DESPUES })])
    renderDialog(channel({ createdAt: CONECTADO, config: { productoIds: ['p1', 'p2'] } }))

    fireEvent.click(await screen.findByRole('checkbox', { name: 'TE' }))
    expect(screen.queryByText('settings.productos.nuevos')).not.toBeInTheDocument()
    guardar()

    const body = await cuerpo()
    expect(body.config.productoIds).toEqual(['p1'])
    expect(body.marcarRevisados).toEqual(['p2'])
  })

  it('cambiar sólo el horario (lista por id) NO manda la lista ni revisados', async () => {
    mockGetProducts.mockResolvedValue([prod('p1', 'LATTE'), prod('p2', 'TE', { createdAt: DESPUES })])
    renderDialog(channel({ createdAt: CONECTADO, config: { deliveryHours: HORARIO_GUARDADO, productoIds: ['p1'] } }))

    await screen.findByRole('checkbox', { name: 'LATTE' })
    fireEvent.change(screen.getAllByLabelText('settings.opensAt')[0], { target: { value: '08:00' } })
    guardar()

    const body = await cuerpo()
    expect('productoIds' in body.config).toBe(false)
    expect('marcarRevisados' in body).toBe(false)
  })

  it('sin lista y sin precios por producto, «precios» va como hoy (sólo el margen)', async () => {
    mockGetProducts.mockResolvedValue([prod('p1', 'LATTE')])
    renderDialog(channel({ config: { deliveryHours: HORARIO_GUARDADO, precios: { markupPercent: 30 } } }))

    await screen.findByText('settings.productos.elegir')
    guardar()

    const body = await cuerpo()
    expect(body.config.precios).toEqual({ markupPercent: 30 })
    expect('productoIds' in body.config).toBe(false)
  })

  it('un precio negativo bloquea «Guardar» con el error a la vista; vaciar el campo quita el precio del envío', async () => {
    mockGetProducts.mockResolvedValue([prod('p1', 'LATTE')])
    renderDialog(channel({ createdAt: CONECTADO, config: { productoIds: ['p1'], precios: { porProducto: { p1: 50 } } } }))

    await screen.findByRole('checkbox', { name: 'LATTE' })
    const precio = within(fila('LATTE')).getByLabelText('settings.productos.precioDe') as HTMLInputElement
    expect(precio.value).toBe('50')
    fireEvent.change(precio, { target: { value: '-5' } })

    expect(within(fila('LATTE')).getByText('settings.productos.errorPrecio')).toBeInTheDocument()
    expect(botonGuardar().disabled).toBe(true)

    fireEvent.change(precio, { target: { value: '' } })
    expect(precio.value).toBe('')
    expect(botonGuardar().disabled).toBe(false)
    guardar()

    const body = await cuerpo()
    expect(body.config.precios).toEqual({ porProducto: {} })
  })

  // Precios = dinero: quitar un producto por temporada no borra su precio fijo; al volver a marcarlo no se publica más barato.
  it('desmarcar un producto con precio fijo lo saca de la lista pero conserva su precio; al volver a marcarlo se ve igual', async () => {
    mockGetProducts.mockResolvedValue([prod('p1', 'LATTE'), prod('p2', 'TE')])
    renderDialog(channel({ config: { productoIds: ['p1', 'p2'], precios: { porProducto: { p2: 79 } } } }))

    fireEvent.click(await screen.findByRole('checkbox', { name: 'TE' }))
    guardar()

    const body = await cuerpo()
    expect(body.config.productoIds).toEqual(['p1'])
    expect(body.config.precios.porProducto).toEqual({ p2: 79 })

    fireEvent.click(screen.getByRole('checkbox', { name: 'TE' }))
    expect((within(fila('TE')).getByLabelText('settings.productos.precioDe') as HTMLInputElement).value).toBe('79')
  })

  // D100 (18-nov): con lista, «Publicar todo mi catálogo» manda `productoIds: null` (el SERVIDOR también limpia la copia por
  // código); los precios por canal viajan como estaban, no se pierden.
  it('con lista por id: «Publicar todo mi catálogo» manda `productoIds: null`, conserva los precios y la huella', async () => {
    mockGetProducts.mockResolvedValue([prod('p1', 'LATTE'), prod('p2', 'TE'), prod('p3', 'MOKA', { createdAt: DESPUES })])
    renderDialog(
      channel({
        createdAt: CONECTADO,
        seleccionHuella: 'h-abrir',
        config: { productoIds: ['p1', 'p2'], precios: { markupPercent: 10, porProducto: { p2: 79 } } },
      }),
    )

    fireEvent.click(await screen.findByRole('button', { name: 'settings.productos.publicarTodo' }))
    fireEvent.click(screen.getByRole('button', { name: 'settings.productos.publicarTodoConfirmar' }))
    expect(screen.getByText('settings.productos.todoElCatalogo')).toBeInTheDocument()
    guardar()

    const body = await cuerpo()
    expect(body.config.productoIds).toBeNull()
    expect(body.config.precios).toEqual({ markupPercent: 10, porProducto: { p2: 79 } })
    expect(body.seleccionEsperada).toBe('h-abrir')
    expect(body.marcarRevisados).toBeUndefined()
  })

  it('lista vieja por código: «Publicar todo mi catálogo» también manda `productoIds: null`', async () => {
    mockGetProducts.mockResolvedValue([prod('p1', 'LATTE'), prod('p2', 'TE')])
    renderDialog(channel({ createdAt: CONECTADO, config: { productos: ['LATTE'] } }))

    fireEvent.click(await screen.findByRole('button', { name: 'settings.productos.publicarTodo' }))
    fireEvent.click(screen.getByRole('button', { name: 'settings.productos.publicarTodoConfirmar' }))
    guardar()

    const body = await cuerpo()
    expect(body.config.productoIds).toBeNull()
  })

  it('sin lista, «Elegir cuáles» y luego «Publicar todo mi catálogo» deja el envío como hoy (no manda `productoIds`)', async () => {
    mockGetProducts.mockResolvedValue([prod('p1', 'LATTE'), prod('p2', 'TE')])
    renderDialog(channel({ createdAt: CONECTADO, config: { deliveryHours: HORARIO_GUARDADO } }))

    fireEvent.click(await screen.findByText('settings.productos.elegir'))
    fireEvent.click(screen.getByRole('button', { name: 'settings.productos.publicarTodo' }))
    guardar()

    const body = await cuerpo()
    expect('productoIds' in body.config).toBe(false)
  })

  it('un precio inválido de un producto desmarcado no bloquea «Guardar» ni se manda', async () => {
    mockGetProducts.mockResolvedValue([prod('p1', 'LATTE'), prod('p2', 'TE')])
    renderDialog(channel({ config: { productoIds: ['p1', 'p2'], precios: { porProducto: { p1: 60 } } } }))

    await screen.findByRole('checkbox', { name: 'TE' })
    fireEvent.change(within(fila('TE')).getByLabelText('settings.productos.precioDe'), { target: { value: '-5' } })
    expect(botonGuardar().disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'TE' }))
    expect(botonGuardar().disabled).toBe(false)
    guardar()

    const body = await cuerpo()
    expect(body.config.precios.porProducto).toEqual({ p1: 60 })
  })

  it('precio guardado en $79, escribir -5 y desmarcar: se manda el $79 de al abrir, no se pierde', async () => {
    mockGetProducts.mockResolvedValue([prod('p1', 'LATTE'), prod('p2', 'TE')])
    renderDialog(channel({ config: { productoIds: ['p1', 'p2'], precios: { porProducto: { p2: 79 } } } }))

    await screen.findByRole('checkbox', { name: 'TE' })
    fireEvent.change(within(fila('TE')).getByLabelText('settings.productos.precioDe'), { target: { value: '-5' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'TE' }))
    expect(botonGuardar().disabled).toBe(false)
    guardar()

    const body = await cuerpo()
    expect(body.config.productoIds).toEqual(['p1'])
    expect(body.config.precios.porProducto).toEqual({ p2: 79 })
  })

  it('desmarcar el único producto bloquea «Guardar» con el texto de pausar el canal', async () => {
    mockGetProducts.mockResolvedValue([prod('p1', 'LATTE')])
    renderDialog(channel({ config: { productoIds: ['p1'] } }))

    fireEvent.click(await screen.findByRole('checkbox', { name: 'LATTE' }))

    expect(screen.getByText('settings.productos.listaVacia')).toBeInTheDocument()
    expect(botonGuardar().disabled).toBe(true)
  })

  it('avisa de los productos nuevos y «Ya los revisé» los marca al momento', async () => {
    mockGetProducts.mockResolvedValue([prod('p1', 'LATTE'), prod('p2', 'TE', { createdAt: DESPUES })])
    renderDialog(channel({ createdAt: CONECTADO, config: { productoIds: ['p1'], productosRevisados: [] } }))

    fireEvent.click(await screen.findByText('settings.productos.yaLosRevise'))

    await waitFor(() => expect(mockUpdateChannel).toHaveBeenCalledWith('venue-1', 'link-1', { marcarRevisados: ['p2'] }))
    await waitFor(() => expect(screen.queryByText('settings.productos.nuevos')).not.toBeInTheDocument())
  })

  it('un producto ya revisado o creado antes de conectar no sale como nuevo', async () => {
    mockGetProducts.mockResolvedValue([prod('p1', 'LATTE'), prod('p2', 'TE', { createdAt: DESPUES }), prod('p3', 'MOKA')])
    renderDialog(channel({ createdAt: CONECTADO, config: { productoIds: ['p1'], productosRevisados: ['p2'] } }))

    await screen.findByRole('checkbox', { name: 'LATTE' })
    expect(screen.queryByText('settings.productos.nuevos')).not.toBeInTheDocument()
  })

  it('avisa de los productos de la lista que ya no existen y «Quitarlos» los saca al guardar', async () => {
    mockGetProducts.mockResolvedValue([prod('p1', 'LATTE')])
    renderDialog(channel({ config: { productoIds: ['p1', 'pX'] } }))

    fireEvent.click(await screen.findByText('settings.productos.quitarlos'))
    expect(screen.queryByText('settings.productos.yaNoExisten')).not.toBeInTheDocument()
    guardar()

    const body = await cuerpo()
    expect(body.config.productoIds).toEqual(['p1'])
  })

  it('«Marcar agotado según tu inventario» arranca prendido sin la llave y apagarlo manda `false`', async () => {
    renderDialog(channel({ config: { deliveryHours: HORARIO_GUARDADO } }))

    const sw = screen.getByRole('switch', { name: 'settings.agotar.title' })
    expect(sw).toHaveAttribute('data-state', 'checked')
    fireEvent.click(sw)
    guardar()

    const body = await cuerpo()
    expect(body.config.agotarPorInventario).toBe(false)
  })

  it('el interruptor respeta `agotarPorInventario: false` guardado', () => {
    renderDialog(channel({ config: { agotarPorInventario: false } }))
    expect(screen.getByRole('switch', { name: 'settings.agotar.title' })).toHaveAttribute('data-state', 'unchecked')
  })

  // 🔴 Codex plan r2 #5: el listado de canales se refresca solo (cada 10-30 s con Rappi). Todo lo editable se congela al abrir.
  it('un refresco con OTRO horario, OTRA impresión y otra huella no toca lo escrito, y se manda con la huella de al abrir', async () => {
    mockGetProducts.mockResolvedValue([prod('p1', 'LATTE')])
    const impresionA = { comanda: 'SALON' as const, empaque: 'NEGOCIO' as const }
    const { rerenderCon } = renderDialog(
      channel({ seleccionHuella: 'h-A', config: { deliveryHours: HORARIO_GUARDADO, impresion: impresionA, productoIds: ['p1'] } }),
    )
    await screen.findByRole('checkbox', { name: 'LATTE' })
    fireEvent.change(screen.getAllByLabelText('settings.opensAt')[0], { target: { value: '08:00' } })
    fireEvent.click(screen.getByText('elegir-todo-junto'))

    const otroHorario = { ...HORARIO_GUARDADO, monday: { enabled: true, ranges: [{ open: '06:00', close: '07:00' }] } }
    rerenderCon(
      channel({
        seleccionHuella: 'h-B',
        config: {
          deliveryHours: otroHorario,
          impresion: { comanda: 'SALON', empaque: 'NO' },
          productoIds: ['p1'],
          agotarPorInventario: false,
        },
      }),
    )

    expect((screen.getAllByLabelText('settings.opensAt')[0] as HTMLInputElement).value).toBe('08:00')
    expect(screen.getByTestId('editor-guardado').textContent).toBe(JSON.stringify(impresionA))
    expect(screen.getByRole('switch', { name: 'settings.agotar.title' })).toHaveAttribute('data-state', 'checked')
    guardar()

    const body = await cuerpo()
    expect(body.config.deliveryHours.monday.ranges[0].open).toBe('08:00')
    expect(body.config.impresion).toEqual({ comanda: 'UNA_ESTACION', estacionId: 'barra', empaque: 'NO' })
    expect(body.seleccionEsperada).toBe('h-A')
  })

  it('un 409 CHANNEL_CHANGED muestra el aviso con «Recargar», que reinicia todo desde el canal nuevo', async () => {
    mockGetProducts.mockResolvedValue([prod('p1', 'LATTE'), prod('p2', 'TE')])
    mockUpdateChannel.mockRejectedValueOnce({ response: { status: 409, data: { code: 'CHANNEL_CHANGED', message: 'x' } } })
    const { rerenderCon } = renderDialog(
      channel({ seleccionHuella: 'h-A', config: { deliveryHours: HORARIO_GUARDADO, productoIds: ['p1'] } }),
    )
    await screen.findByRole('checkbox', { name: 'LATTE' })
    fireEvent.change(screen.getAllByLabelText('settings.opensAt')[0], { target: { value: '08:00' } })
    fireEvent.click(screen.getByText('elegir-todo-junto'))
    guardar()

    expect(await screen.findByText('settings.conflicto')).toBeInTheDocument()
    // El aviso de arriba puede quedar fuera de la vista de quien edita abajo: también sale flotante, con el mismo texto.
    expect(mockToast).toHaveBeenCalledExactlyOnceWith({ title: 'settings.conflicto', variant: 'destructive' })
    expect(botonGuardar().disabled).toBe(true)

    const impresionB = { comanda: 'SALON' as const, empaque: 'NO' as const }
    const otroHorario = { ...HORARIO_GUARDADO, monday: { enabled: true, ranges: [{ open: '10:00', close: '20:00' }] } }
    rerenderCon(channel({ seleccionHuella: 'h-B', config: { deliveryHours: otroHorario, impresion: impresionB, productoIds: ['p2'] } }))
    fireEvent.click(screen.getByText('settings.recargar'))

    await waitFor(() => expect(screen.queryByText('settings.conflicto')).not.toBeInTheDocument())
    expect(refetchSpy).toHaveBeenCalledWith({ queryKey: ['deliveryChannels', 'venue-1'] })
    expect((screen.getAllByLabelText('settings.opensAt')[0] as HTMLInputElement).value).toBe('10:00')
    expect(screen.getByTestId('editor-guardado').textContent).toBe(JSON.stringify(impresionB))
    expect(await screen.findByRole('checkbox', { name: 'TE' })).toHaveAttribute('data-state', 'checked')
    expect(screen.getByRole('checkbox', { name: 'LATTE' })).toHaveAttribute('data-state', 'unchecked')

    guardar()
    await waitFor(() => expect(mockUpdateChannel).toHaveBeenCalledTimes(2))
    const body = mockUpdateChannel.mock.calls[1][2]
    expect(body.seleccionEsperada).toBe('h-B')
    expect('impresion' in body.config).toBe(false)
    expect(body.config.deliveryHours).toEqual(otroHorario)
  })

  it('«Recargar» también reinicia la búsqueda y el filtro «Revisarlos» de la sección de productos', async () => {
    mockGetProducts.mockResolvedValue([prod('p1', 'LATTE'), prod('p2', 'TE', { createdAt: DESPUES })])
    mockUpdateChannel.mockRejectedValueOnce({ response: { status: 409, data: { code: 'CHANNEL_CHANGED', message: 'x' } } })
    renderDialog(channel({ createdAt: CONECTADO, config: { deliveryHours: HORARIO_GUARDADO, productoIds: ['p1'] } }))
    await screen.findByRole('checkbox', { name: 'LATTE' })
    fireEvent.click(screen.getByText('settings.productos.revisarlos'))
    expect(screen.queryByRole('checkbox', { name: 'LATTE' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('settings.productos.buscar'), { target: { value: 'TE' } })
    guardar()
    fireEvent.click(await screen.findByText('settings.recargar'))

    await waitFor(() => expect(screen.queryByText('settings.conflicto')).not.toBeInTheDocument())
    expect(await screen.findByRole('checkbox', { name: 'LATTE' })).toBeInTheDocument()
    expect((screen.getByLabelText('settings.productos.buscar') as HTMLInputElement).value).toBe('')
  })

  it('doble clic en «Guardar» manda UN solo PATCH; al terminar (con error) se puede volver a guardar', async () => {
    let fallar!: (e: unknown) => void
    mockUpdateChannel.mockReturnValueOnce(new Promise((_r, rej) => (fallar = rej)))
    renderDialog(channel({ config: { deliveryHours: HORARIO_GUARDADO } }))
    const boton = botonGuardar()
    act(() => {
      boton.click()
      boton.click()
    })
    await waitFor(() => expect(mockUpdateChannel).toHaveBeenCalled())
    expect(mockUpdateChannel).toHaveBeenCalledTimes(1)

    await act(async () => fallar({ response: { status: 400, data: { message: 'horario malo' } } }))
    await waitFor(() => expect(botonGuardar().disabled).toBe(false))
    guardar()
    await waitFor(() => expect(mockUpdateChannel).toHaveBeenCalledTimes(2))
  })

  it('otro error (no 409) sigue saliendo como aviso flotante, sin «Recargar»', async () => {
    mockUpdateChannel.mockRejectedValueOnce({ response: { status: 400, data: { message: 'horario malo' } } })
    renderDialog(channel({ config: { deliveryHours: HORARIO_GUARDADO } }))
    guardar()

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ description: 'horario malo', variant: 'destructive' })),
    )
    expect(screen.queryByText('settings.recargar')).not.toBeInTheDocument()
  })
})
