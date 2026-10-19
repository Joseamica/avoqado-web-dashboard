/**
 * Variantes de producto, bloque 2 (Tarea 5): el alta de un producto con variantes desde el asistente de producto.
 * - La casilla sólo sale en el ALTA y en los tipos que admiten familia; en Gratis (o con el plan sin resolver) sale apagada con «Pro».
 * - Con la casilla, guardar crea la FAMILIA (`createProductGroup`), nunca el producto suelto; sin la casilla, el alta es la de siempre.
 * - Dos clics en el mismo instante = UNA familia. Enter dentro de la sección no envía el asistente.
 * Arnés copiado de `ProductWizardDialog.iva.test.tsx` (mismos `vi.mock`), parametrizado para el alta. `t` devuelve la clave.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Radix Select usa pointer capture, que jsdom no trae. Funciones planas, NO vi.fn() (mockReset: true las vaciaría).
Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}

const svc = vi.hoisted(() => ({
  getMenuCategories: vi.fn(),
  getModifierGroups: vi.fn(),
  getIvaPorProducto: vi.fn(),
  IVA_QUERY_KEY: (venueId: string) => ['iva-por-producto', venueId] as const,
}))
vi.mock('@/services/menu.service', () => svc)

const inv = vi.hoisted(() => ({
  productWizardApi: {
    shouldUseInventory: vi.fn(),
    getWizardProgress: vi.fn(),
    createProductWithInventory: vi.fn(),
    configureSimpleStock: vi.fn(),
    configureRecipe: vi.fn(),
  },
  rawMaterialsApi: { getAll: vi.fn() },
  recipesApi: { get: vi.fn(), update: vi.fn() },
  productInventoryApi: { switchInventoryMethod: vi.fn() },
}))
vi.mock('@/services/inventory.service', () => inv)
const productWizardApiMock = inv.productWizardApi

const grupos = vi.hoisted(() => ({ createProductGroup: vi.fn(), listOptionLibrary: vi.fn() }))
vi.mock('@/services/productGroups.service', () => grupos)

const http = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock('@/api', () => ({ default: http }))

vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({
    venueId: 'v1',
    venueSlug: 'mi-tienda',
    fullBasePath: '/venues/mi-tienda',
    venue: { id: 'v1', organizationId: 'o1' },
  }),
}))
const toastMock = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastMock }) }))
const plan = vi.hoisted(() => ({ hasAccess: true, isResolved: true }))
vi.mock('@/hooks/use-tier-feature-access', async importOriginal => ({
  ...(await importOriginal<object>()),
  useTierFeatureAccess: (code: string) =>
    code === 'PRODUCT_VARIANTS'
      ? { hasAccess: plan.hasAccess, isResolved: plan.isResolved, requiredTier: 'PRO', isLoading: false }
      : { hasAccess: true, isResolved: true, requiredTier: 'PRO', isLoading: false },
}))
vi.mock('@/hooks/use-image-uploader', () => ({
  useImageUploader: () => ({
    uploading: false,
    imageUrl: null,
    imageForCrop: null,
    crop: { x: 0, y: 0 },
    zoom: 1,
    onCropComplete: () => undefined,
    handleFileUpload: () => undefined,
    handleCropConfirm: () => undefined,
    handleFileRemove: () => undefined,
    setImageForCrop: () => undefined,
    setCrop: () => undefined,
    setZoom: () => undefined,
  }),
}))
vi.mock('@/components/PrintStationField', () => ({ PrintStationField: () => null }))
vi.mock('@/components/SatKeyPicker', () => ({ SatKeyPicker: () => null }))
const catalogo = vi.hoisted(() => ({ maestro: false }))
vi.mock('@/features/master-catalog/use-master-catalog-error', () => ({ useMasterCatalogError: () => () => catalogo.maestro }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es-MX' } }),
}))

import { ProductWizardDialog } from '../ProductWizardDialog'
import { Currency } from '@/utils/currency'

type Tipo = 'REGULAR' | 'FOOD_AND_BEV' | 'APPOINTMENTS_SERVICE' | 'CLASS' | 'EVENT' | 'DIGITAL' | 'DONATION' | 'OTHER'

function pintar({ mode = 'create', productType = 'REGULAR' }: { mode?: 'create' | 'edit'; productType?: Tipo } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onOpenChange = vi.fn()
  const ui = (open: boolean) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProductWizardDialog
          open={open}
          onOpenChange={onOpenChange}
          mode={mode}
          productType={productType}
          {...(mode === 'edit' ? { productId: 'p1' } : {})}
        />
      </MemoryRouter>
    </QueryClientProvider>
  )
  const { rerender } = render(ui(true))
  return { qc, onOpenChange, abrir: (open: boolean) => rerender(ui(open)) }
}

const botonGuardar = () => screen.getByRole('button', { name: 'wizard.finish' })
const casilla = () => screen.findByRole('checkbox', { name: /alta\.casilla/ })

async function llenarNombreYCategoria(nombre: string, categoria = 'Café') {
  fireEvent.change(await screen.findByPlaceholderText('wizard.step1.namePlaceholder'), { target: { value: nombre } })
  await userEvent.click(screen.getByPlaceholderText('wizard.step1.categoryPlaceholder'))
  await userEvent.click(await screen.findByRole('option', { name: categoria }))
}

/** Nombre, categoría, casilla, «Talla: S, M» y precio 199 para todas: listo para guardar. */
async function prepararFamiliaValida() {
  await llenarNombreYCategoria('Playera básica')
  fireEvent.click(await casilla())
  fireEvent.change(screen.getByLabelText('opciones.nombre'), { target: { value: 'Talla' } })
  fireEvent.change(screen.getByLabelText('opciones.valores'), { target: { value: 'S, M,' } })
  fireEvent.change(screen.getByLabelText('tabla.precioTodas'), { target: { value: '199' } })
  fireEvent.click(screen.getByRole('button', { name: 'tabla.aplicarTodas' }))
}

beforeEach(() => {
  plan.hasAccess = true
  plan.isResolved = true
  catalogo.maestro = false
  svc.getMenuCategories.mockResolvedValue([{ id: 'c1', name: 'Café' }])
  svc.getModifierGroups.mockResolvedValue([])
  svc.getIvaPorProducto.mockResolvedValue({
    encendido: true,
    habilitadoAt: null,
    contabilidad: false,
    bloqueos: [],
    avisos: [],
    facturasSinSello: [],
  })
  productWizardApiMock.shouldUseInventory.mockResolvedValue({ data: { data: {} } })
  productWizardApiMock.getWizardProgress.mockResolvedValue({ data: { data: { inventoryMethod: null, details: null } } })
  productWizardApiMock.createProductWithInventory.mockResolvedValue({ data: { data: { productId: 'p9' } } })
  inv.recipesApi.get.mockResolvedValue({ data: { data: null } })
  http.get.mockResolvedValue({
    data: {
      data: {
        id: 'p1',
        name: 'Café en grano',
        price: 250,
        type: 'REGULAR',
        categoryId: 'c1',
        modifierGroups: [],
        ivaTratamiento: 'IVA_16',
      },
    },
  })
  http.put.mockResolvedValue({ data: {} })
  grupos.createProductGroup.mockResolvedValue({ groupId: 'g1', productIds: ['p1', 'p2'], categoryId: 'c1' })
})

describe('asistente de producto: alta con variantes (Tarea 5)', () => {
  it('en Gratis la casilla se ve deshabilitada con la etiqueta Pro y el texto de Pro y Premium', async () => {
    plan.hasAccess = false
    pintar()
    expect(await casilla()).toBeDisabled()
    expect(screen.getByText('venuesSwitcher.tier.pro')).toBeInTheDocument()
    expect(screen.getByText('alta.casillaBloqueada')).toBeInTheDocument()
  })

  it('mientras el plan no se resuelve, la casilla también sale deshabilitada', async () => {
    plan.isResolved = false
    pintar()
    expect(await casilla()).toBeDisabled()
  })

  it.each<Tipo>(['APPOINTMENTS_SERVICE', 'CLASS', 'EVENT'])('un tipo sin familias (%s) no ve la casilla', async productType => {
    pintar({ productType })
    await screen.findByPlaceholderText('wizard.step1.namePlaceholder')
    expect(screen.queryByRole('checkbox', { name: /alta\.casilla/ })).not.toBeInTheDocument()
  })

  it('al editar un producto no sale la casilla', async () => {
    pintar({ mode: 'edit' })
    await screen.findByDisplayValue('Café en grano')
    expect(screen.queryByRole('checkbox', { name: /alta\.casilla/ })).not.toBeInTheDocument()
  })

  it('al marcarla se ocultan precio, venta por peso, SKU, código e inventario, y aparece la sección de variantes', async () => {
    pintar()
    fireEvent.change(await screen.findByPlaceholderText('wizard.step1.namePlaceholder'), { target: { value: 'Agua' } })
    fireEvent.change(screen.getByLabelText(/^wizard\.step1\.price/), { target: { value: '20' } })
    expect(screen.getByText(Currency(20))).toBeInTheDocument() // la vista previa lateral
    expect(screen.getByText('wizard.step2.useInventory')).toBeInTheDocument()
    fireEvent.click(await casilla())
    expect(screen.queryByText(Currency(20))).not.toBeInTheDocument() // un precio que no se guarda no se muestra
    expect(screen.queryByLabelText(/^wizard\.step1\.price/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^wizard\.step1\.soldByWeight/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^SKU/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^GTIN/)).not.toBeInTheDocument()
    expect(screen.queryByText('wizard.step2.useInventory')).not.toBeInTheDocument()
    expect(screen.getByText('alta.seccion')).toBeInTheDocument()
    expect(screen.getByLabelText('opciones.nombre')).toBeInTheDocument()
  })

  it('🔴 con la casilla, guardar crea la familia (no el producto suelto) con un renglón por combinación', async () => {
    const { onOpenChange } = pintar()
    await prepararFamiliaValida()
    fireEvent.click(botonGuardar())
    await waitFor(() => expect(grupos.createProductGroup).toHaveBeenCalledTimes(1))
    expect(grupos.createProductGroup.mock.calls[0][0]).toBe('v1')
    const body = grupos.createProductGroup.mock.calls[0][1]
    expect(body).toMatchObject({
      name: 'Playera básica',
      categoryId: 'c1',
      type: 'REGULAR',
      trackInventory: false,
      options: [{ name: 'Talla', values: ['S', 'M'] }],
      variants: [
        { values: ['S'], price: 199 },
        { values: ['M'], price: 199 },
      ],
    })
    expect(body.variants[0]).not.toHaveProperty('sku')
    expect(body).not.toHaveProperty('ivaTratamiento') // nace al 16 % (P4)
    expect(productWizardApiMock.createProductWithInventory).not.toHaveBeenCalled()
    // cierra como el alta normal
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'alta.creada' }))
  })

  it('dos clics en el mismo instante crean UNA familia, y el botón queda deshabilitado mientras se envía', async () => {
    grupos.createProductGroup.mockReturnValue(new Promise(() => {}))
    pintar()
    await prepararFamiliaValida()
    const b = botonGuardar()
    fireEvent.click(b)
    fireEvent.click(b)
    await waitFor(() => expect(grupos.createProductGroup).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(botonGuardar()).toBeDisabled())
    expect(grupos.createProductGroup).toHaveBeenCalledTimes(1)
  })

  it('una opción a medias no se manda: avisa qué falta', async () => {
    pintar()
    await llenarNombreYCategoria('Playera básica')
    fireEvent.click(await casilla())
    fireEvent.click(botonGuardar())
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'validacion.opcionSinNombre', variant: 'destructive' })),
    )
    expect(grupos.createProductGroup).not.toHaveBeenCalled()
    expect(productWizardApiMock.createProductWithInventory).not.toHaveBeenCalled()
  })

  it('sin categoría no se manda la familia: lo avisa, y al elegirla ya se puede guardar (no se queda atorado)', async () => {
    pintar()
    fireEvent.change(await screen.findByPlaceholderText('wizard.step1.namePlaceholder'), { target: { value: 'Playera básica' } })
    fireEvent.click(await casilla())
    fireEvent.change(screen.getByLabelText('opciones.nombre'), { target: { value: 'Talla' } })
    fireEvent.change(screen.getByLabelText('opciones.valores'), { target: { value: 'S,' } })
    fireEvent.change(screen.getByLabelText('tabla.precioTodas'), { target: { value: '199' } })
    fireEvent.click(screen.getByRole('button', { name: 'tabla.aplicarTodas' }))
    fireEvent.click(botonGuardar())
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'wizard.step1.categoryRequired', variant: 'destructive' })),
    )
    expect(grupos.createProductGroup).not.toHaveBeenCalled()

    await userEvent.click(screen.getByPlaceholderText('wizard.step1.categoryPlaceholder'))
    await userEvent.click(await screen.findByRole('option', { name: 'Café' }))
    fireEvent.click(botonGuardar())
    await waitFor(() => expect(grupos.createProductGroup).toHaveBeenCalledTimes(1))
    expect(grupos.createProductGroup.mock.calls[0][1]).toMatchObject({ categoryId: 'c1' })
  })

  it('el 403 del plan se ve en español', async () => {
    grupos.createProductGroup.mockRejectedValue({
      response: {
        status: 403,
        data: { featureCode: 'PRODUCT_VARIANTS', subscriptionRequired: true, message: 'This venue does not have access…' },
      },
    })
    pintar()
    await prepararFamiliaValida()
    fireEvent.click(botonGuardar())
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive', description: 'variants:errors.planRequired' }),
      ),
    )
  })

  it('error del catálogo maestro: lo atiende su aviso (sin el toast de variantes) y la lista igual se relee', async () => {
    catalogo.maestro = true
    grupos.createProductGroup.mockRejectedValue({ response: { status: 409, data: { code: 'MASTER_CATALOG_LOCKED', message: 'x' } } })
    const { qc } = pintar()
    const invalidar = vi.spyOn(qc, 'invalidateQueries')
    await prepararFamiliaValida()
    fireEvent.click(botonGuardar())
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ['products', 'v1'] }))
    expect(toastMock).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
  })

  it('con inventario encendido, marcar la casilla quita también el inventario de la vista previa', async () => {
    productWizardApiMock.shouldUseInventory.mockResolvedValue({ data: { data: { hasInventoryFeature: true } } })
    pintar()
    fireEvent.change(await screen.findByPlaceholderText('wizard.step1.namePlaceholder'), { target: { value: 'Playera' } })
    const usarInventario = screen.getByRole('switch', { name: 'wizard.step2.useInventory' })
    await waitFor(() => expect(usarInventario).toBeEnabled())
    fireEvent.click(usarInventario)
    expect(await screen.findByText('wizard.preview.stock')).toBeInTheDocument()
    fireEvent.click(await casilla())
    expect(screen.queryByText('wizard.preview.stock')).not.toBeInTheDocument()
  })

  it('el precio sale de la validación sólo con la casilla: al desmarcarla vuelve a ser obligatorio y conserva lo tecleado', async () => {
    pintar()
    await llenarNombreYCategoria('Agua')
    fireEvent.change(screen.getByLabelText(/^wizard\.step1\.price/), { target: { value: '20' } })
    fireEvent.click(await casilla())
    fireEvent.click(await casilla())
    expect(screen.getByLabelText(/^wizard\.step1\.price/)).toHaveValue(20) // lo tecleado antes de marcarla
    fireEvent.change(screen.getByLabelText(/^wizard\.step1\.price/), { target: { value: '' } })
    fireEvent.click(botonGuardar())
    expect(await screen.findByText('wizard.step1.priceRequired')).toBeInTheDocument()
    expect(productWizardApiMock.createProductWithInventory).not.toHaveBeenCalled()
  })

  it('nombre ya usado (p. ej. el reintento automático tras un corte): el texto del server y la lista se refresca', async () => {
    const mensaje = 'Ya existe la familia «Playera básica». Ábrela para agregarle variantes.'
    grupos.createProductGroup.mockRejectedValue({ response: { status: 409, data: { code: 'PRODUCT_GROUP_NAME_TAKEN', message: mensaje } } })
    const { qc } = pintar()
    const invalidar = vi.spyOn(qc, 'invalidateQueries')
    await prepararFamiliaValida()
    fireEvent.click(botonGuardar())
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', description: mensaje })))
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['products', 'v1'] })
  })

  it('Enter en un campo de la sección no envía el asistente; en un botón sí actúa', async () => {
    pintar()
    await prepararFamiliaValida()
    // fireEvent devuelve false si alguien llamó preventDefault (el envío implícito del <form> se cancela)
    expect(fireEvent.keyDown(screen.getByLabelText('tabla.precioTodas'), { key: 'Enter' })).toBe(false)
    expect(fireEvent.keyDown(screen.getAllByLabelText('tabla.sku')[0], { key: 'Enter' })).toBe(false)
    expect(fireEvent.keyDown(screen.getAllByLabelText('tabla.precio')[0], { key: 'Enter' })).toBe(false)
    expect(fireEvent.keyDown(screen.getByRole('button', { name: 'tabla.aplicarTodas' }), { key: 'Enter' })).toBe(true)
    expect(fireEvent.keyDown(screen.getByLabelText('tabla.precioTodas'), { key: 'a' })).toBe(true)
  })

  it('desmarcar conserva lo tecleado en la sección y el alta vuelve a ser la normal', async () => {
    pintar()
    await llenarNombreYCategoria('Agua')
    fireEvent.click(await casilla())
    fireEvent.change(screen.getByLabelText('opciones.nombre'), { target: { value: 'Tamaño' } })
    fireEvent.click(await casilla())
    expect(screen.queryByLabelText('opciones.nombre')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^wizard\.step1\.price/), { target: { value: '20' } })
    fireEvent.click(await casilla())
    expect(screen.getByLabelText('opciones.nombre')).toHaveValue('Tamaño')
    fireEvent.click(await casilla())
    fireEvent.click(botonGuardar())
    await waitFor(() => expect(productWizardApiMock.createProductWithInventory).toHaveBeenCalledTimes(1))
    expect(grupos.createProductGroup).not.toHaveBeenCalled()
  })

  it('cancelar con la casilla marcada y volver a abrir el alta: la casilla sale desmarcada y la sección vacía', async () => {
    const { onOpenChange, abrir } = pintar()
    fireEvent.click(await casilla())
    fireEvent.change(screen.getByLabelText('opciones.nombre'), { target: { value: 'Talla' } })
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    fireEvent.click(await screen.findByRole('button', { name: 'wizard.discard.confirm' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)

    abrir(false) // el padre cierra: resetWizard corre por el efecto de `open`
    abrir(true) // y reabre el MISMO componente
    expect(await casilla()).not.toBeChecked()
    expect(screen.queryByLabelText('opciones.nombre')).not.toBeInTheDocument()
    fireEvent.click(await casilla())
    expect(screen.getByLabelText('opciones.nombre')).toHaveValue('')
  })

  it('sin capturar nada, «Cancelar» cierra sin preguntar (marcar la casilla sola no cuenta como captura)', async () => {
    const { onOpenChange } = pintar()
    fireEvent.click(await casilla())
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(screen.queryByText('wizard.discard.title')).not.toBeInTheDocument()
  })

  it('🔴 con combinaciones capturadas, «Cancelar», la X y Esc preguntan antes de descartar; «Seguir editando» no pierde nada', async () => {
    const { onOpenChange } = pintar()
    await prepararFamiliaValida()

    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(await screen.findByText('wizard.discard.title')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'wizard.discard.keepEditing' }))
    await waitFor(() => expect(screen.queryByText('wizard.discard.title')).not.toBeInTheDocument())
    expect(screen.getAllByLabelText('tabla.precio').map(i => (i as HTMLInputElement).value)).toEqual(['199', '199'])

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' })) // la X
    expect(await screen.findByText('wizard.discard.title')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'wizard.discard.keepEditing' }))
    await waitFor(() => expect(screen.queryByText('wizard.discard.title')).not.toBeInTheDocument())

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(await screen.findByText('wizard.discard.title')).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'wizard.discard.confirm' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('🔴 tras descartar y volver a abrir, marcar sólo la casilla y cancelar cierra sin preguntar (QA en navegador)', async () => {
    const { onOpenChange, abrir } = pintar()
    await prepararFamiliaValida()
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    fireEvent.click(await screen.findByRole('button', { name: 'wizard.discard.confirm' }))
    abrir(false)
    abrir(true)
    onOpenChange.mockClear()
    fireEvent.click(await casilla())
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(screen.queryByText('wizard.discard.title')).not.toBeInTheDocument()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('elegir sólo la categoría también cuenta como captura', async () => {
    const { onOpenChange } = pintar()
    await userEvent.click(await screen.findByPlaceholderText('wizard.step1.categoryPlaceholder'))
    await userEvent.click(await screen.findByRole('option', { name: 'Café' }))
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(await screen.findByText('wizard.discard.title')).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('con algo escrito en el alta normal (sin variantes) también pregunta', async () => {
    const { onOpenChange } = pintar()
    fireEvent.change(await screen.findByPlaceholderText('wizard.step1.namePlaceholder'), { target: { value: 'Agua' } })
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(await screen.findByText('wizard.discard.title')).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('la vista previa dice cuántas variantes van y su precio (o el rango)', async () => {
    pintar()
    await prepararFamiliaValida()
    expect(screen.getByText(`alta.vistaPrevia · ${Currency(199)}`)).toBeInTheDocument()
    fireEvent.change(screen.getAllByLabelText('tabla.precio')[1], { target: { value: '249' } })
    expect(screen.getByText(`alta.vistaPrevia · ${Currency(199)} – ${Currency(249)}`)).toBeInTheDocument()
  })

  it('🔴 sin la casilla, el alta sigue siendo la de siempre (y termina bien)', async () => {
    const { onOpenChange } = pintar()
    await llenarNombreYCategoria('Agua')
    fireEvent.change(screen.getByLabelText(/^wizard\.step1\.price/), { target: { value: '20' } })
    fireEvent.click(botonGuardar())
    await waitFor(() => expect(productWizardApiMock.createProductWithInventory).toHaveBeenCalledTimes(1))
    expect(productWizardApiMock.createProductWithInventory.mock.calls[0][1]).toMatchObject({
      product: { name: 'Agua', price: 20, categoryId: 'c1', type: 'REGULAR' },
      inventory: { useInventory: false },
    })
    expect(grupos.createProductGroup).not.toHaveBeenCalled()
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'wizard.success' }))
  })
})

// Tarea 13: otras pantallas abren el asistente POR ID (la ficha, «Configurar inventario»). Si el producto es una variante, los campos del
// padre se ven deshabilitados y NO viajan en el PUT: deshabilitar no basta, `description: ''` (de un `null`) el server lo cuenta como cambio.
describe('asistente de producto: editar una variante (Tarea 13)', () => {
  const variante = {
    id: 'p1',
    name: 'Playera · M',
    description: null,
    price: 199,
    type: 'REGULAR',
    categoryId: 'c1',
    imageUrl: 'https://cdn.example.com/playera.jpg',
    modifierGroups: [{ groupId: 'm1', group: { id: 'm1', name: 'Leyenda' } }],
    printStationId: null,
    satProductKey: '53101600',
    satUnitKey: 'H87',
    ivaTratamiento: 'IVA_16',
    productGroupId: 'g1',
    productGroupName: 'Playera',
  }

  it('se ve el aviso; nombre y descripción deshabilitados, precio habilitado; «Abrir» cierra el asistente', async () => {
    http.get.mockResolvedValue({ data: { data: variante } })
    const { onOpenChange } = pintar({ mode: 'edit' })
    expect(await screen.findByText('variante.aviso')).toBeInTheDocument()
    expect(await screen.findByDisplayValue('Playera · M')).toBeDisabled()
    expect(screen.getByPlaceholderText('wizard.step1.descriptionPlaceholder')).toBeDisabled()
    expect(screen.getByPlaceholderText('wizard.step1.categoryPlaceholder')).toBeDisabled()
    expect(screen.getByLabelText(/^wizard\.step1\.price/)).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'variante.abrir' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(http.put).not.toHaveBeenCalled() // «Abrir» vive dentro del <form>: no lo envía
  })

  it('🔴 cambiar SÓLO el precio y guardar manda un PUT sin nombre, descripción, categoría, extras, impresora, foto, tipo ni claves SAT', async () => {
    http.get.mockResolvedValue({ data: { data: variante } })
    pintar({ mode: 'edit' })
    await screen.findByDisplayValue('Playera · M')
    fireEvent.change(screen.getByLabelText(/^wizard\.step1\.price/), { target: { value: '219' } })
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1))
    const [url, body] = http.put.mock.calls[0]
    expect(url).toBe('/api/v1/dashboard/venues/v1/products/p1')
    expect(body).toMatchObject({ price: 219, trackInventory: false })
    for (const campo of [
      'name',
      'description',
      'categoryId',
      'modifierGroupIds',
      'printStationId',
      'imageUrl',
      'type',
      'satProductKey',
      'satUnitKey',
      'ivaTratamiento',
    ]) {
      expect(body).not.toHaveProperty(campo)
    }
  })

  it('QA ALTO-1 (revisado): una variante con nombre de más de 30 caracteres también guarda desde el asistente', async () => {
    http.get.mockResolvedValue({ data: { data: { ...variante, name: 'Playera QA Pro · S · Azul · Corta' } } })
    pintar({ mode: 'edit' })
    await screen.findByDisplayValue('Playera QA Pro · S · Azul · Corta')
    fireEvent.change(screen.getByLabelText(/^wizard\.step1\.price/), { target: { value: '219' } })
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1))
    expect(http.put.mock.calls[0][1]).toMatchObject({ price: 219 })
    expect(http.put.mock.calls[0][1]).not.toHaveProperty('name')
  })

  it('🔴 regresión: un producto suelto se sigue editando y mandando como hoy (sin aviso, con nombre y categoría)', async () => {
    pintar({ mode: 'edit' })
    expect(await screen.findByDisplayValue('Café en grano')).toBeEnabled()
    expect(screen.queryByText('variante.aviso')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1))
    expect(http.put.mock.calls[0][1]).toMatchObject({ name: 'Café en grano', categoryId: 'c1', modifierGroupIds: [] })
  })
})
