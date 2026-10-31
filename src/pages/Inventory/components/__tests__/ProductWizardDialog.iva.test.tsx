/**
 * IVA por producto (plan 6b, Tarea 11): el asistente de producto, SÓLO en modo edición, trae el mismo selector «IVA».
 * - El IVA entra UNA sola vez al PUT del producto (el de inventario no lo lleva).
 * - Un IVA elegido y abandonado (cerrar sin guardar) no viaja en el siguiente guardado (resetWizard lo limpia).
 * - Primer encendido (estado apagado, cargando o con error): el aviso de confirmación va antes del PUT.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
  // Función plana (no vi.fn): la clave de la consulta del estado del IVA.
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
vi.mock('@/hooks/use-tier-feature-access', () => ({ useTierFeatureAccess: () => ({ hasAccess: false }) }))
// El hook real devuelve SIEMPRE las mismas funciones (son de `useState`). Un objeto nuevo en cada llamada hace que `resetWizard`
// (depende de `setImageForCrop`) cambie en cada pintado y el efecto de «cerrar» corra sin fin: la prueba se colgaba al 105 % de CPU.
vi.mock('@/hooks/use-image-uploader', () => {
  const subida = {
    uploading: false,
    imageUrl: null,
    imageForCrop: null,
    crop: { x: 0, y: 0 },
    zoom: 1,
    onCropComplete: () => undefined,
    handleFileUpload: () => undefined,
    handleCropConfirm: () => undefined,
    handleFileRemove: () => undefined,
    resetImage: () => undefined,
    setImageForCrop: () => undefined,
    setCrop: () => undefined,
    setZoom: () => undefined,
  }
  return { useImageUploader: () => subida }
})
vi.mock('@/hooks/use-print-stations', () => ({ usePrintStations: () => ({ data: [], isLoading: false }) }))
vi.mock('@/components/PrintStationField', () => ({ PrintStationField: () => null }))
vi.mock('@/features/master-catalog/use-master-catalog-error', () => ({ useMasterCatalogError: () => () => false }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es-MX' } }),
}))

import { ProductWizardDialog } from '../ProductWizardDialog'

const URL_PRODUCTO = '/api/v1/dashboard/venues/v1/products/p1'
const estado = (over = {}) => ({
  encendido: false,
  habilitadoAt: null,
  contabilidad: false,
  bloqueos: [],
  avisos: [],
  facturasSinSello: [],
  ...over,
})
const producto = (over = {}) => ({
  id: 'p1',
  name: 'Café en grano',
  description: '',
  price: 250,
  type: 'REGULAR',
  categoryId: 'c1',
  imageUrl: '',
  sku: 'CAFE-001',
  gtin: '',
  modifierGroups: [],
  ivaTratamiento: 'IVA_16',
  ...over,
})
/** El `PUT` de producto del asistente: lo que viaja en el cuerpo. */
const puts = () => http.put.mock.calls as Array<[string, Record<string, unknown>]>

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onOpenChange = vi.fn()
  const ui = (open: boolean) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProductWizardDialog open={open} onOpenChange={onOpenChange} mode="edit" productId="p1" productType="REGULAR" />
      </MemoryRouter>
    </QueryClientProvider>
  )
  const { rerender } = render(ui(true))
  return { onOpenChange, abrir: (open: boolean) => rerender(ui(open)) }
}

async function elegirIva(opcion: 'IVA_16' | 'IVA_0' | 'EXENTO') {
  await userEvent.click(await screen.findByRole('combobox', { name: 'iva.label' }))
  await userEvent.click(await screen.findByRole('option', { name: `iva.opciones.${opcion}` }))
}
const guardar = () => userEvent.click(screen.getByRole('button', { name: 'save' }))

beforeEach(() => {
  svc.getMenuCategories.mockResolvedValue([{ id: 'c1', name: 'Café' }])
  svc.getModifierGroups.mockResolvedValue([])
  inv.productWizardApi.shouldUseInventory.mockResolvedValue({ data: { data: {} } })
  inv.productWizardApi.getWizardProgress.mockResolvedValue({ data: { data: { inventoryMethod: null, details: null } } })
  inv.productWizardApi.configureSimpleStock.mockResolvedValue({})
  inv.recipesApi.get.mockResolvedValue({ data: { data: null } })
  http.get.mockResolvedValue({ data: { data: producto() } })
  http.put.mockResolvedValue({ data: {} })
})

describe('asistente de producto (modo edición): el IVA (6b)', () => {
  it('un IVA elegido y abandonado (cerrar sin guardar) no viaja en el siguiente guardado (Codex r1 P2-4)', async () => {
    svc.getIvaPorProducto.mockResolvedValue(estado({ encendido: true }))
    const { onOpenChange, abrir } = montar()
    await elegirIva('IVA_0')
    await userEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)

    abrir(false) // el padre cierra: resetWizard corre por el efecto de `open`
    abrir(true) // y reabre el MISMO componente
    const nombre = await screen.findByDisplayValue('Café en grano')
    expect(await screen.findByRole('combobox', { name: 'iva.label' })).toHaveTextContent('iva.opciones.IVA_16')
    await userEvent.clear(nombre)
    await userEvent.type(nombre, 'Café molido')
    await guardar()

    await waitFor(() => expect(puts()).toHaveLength(1))
    expect(puts()[0][0]).toBe(URL_PRODUCTO)
    expect(puts()[0][1]).toMatchObject({ name: 'Café molido' })
    expect(puts()[0][1]).not.toHaveProperty('ivaTratamiento')
  })

  it('con inventario, el IVA viaja en UN solo PUT (el del producto), nunca en el de inventario', async () => {
    svc.getIvaPorProducto.mockResolvedValue(estado({ encendido: true }))
    inv.productWizardApi.getWizardProgress.mockResolvedValue({
      data: { data: { inventoryMethod: 'QUANTITY', details: { currentStock: 5, costPerUnit: 2, reorderPoint: 3 } } },
    })
    montar()
    await elegirIva('IVA_0')
    await guardar()

    await waitFor(() => expect(inv.productWizardApi.configureSimpleStock).toHaveBeenCalled())
    const conIva = puts().filter(([, cuerpo]) => 'ivaTratamiento' in cuerpo)
    expect(conIva).toHaveLength(1)
    expect(conIva[0][1]).toMatchObject({ ivaTratamiento: 'IVA_0', name: 'Café en grano' })
    const deInventario = puts().find(([, cuerpo]) => cuerpo.inventoryMethod === 'QUANTITY')
    expect(deInventario?.[1]).not.toHaveProperty('ivaTratamiento')
  })

  it.each([
    ['apagado', () => Promise.resolve(estado({ encendido: false }))],
    ['todavía cargando', () => new Promise(() => undefined)],
    ['con error', () => Promise.reject(new Error('sin red'))],
  ])('estado %s: elegir IVA 0 % y guardar abre el aviso y no guarda hasta «Continuar» (Codex r2 N7)', async (_n, consulta) => {
    svc.getIvaPorProducto.mockImplementation(consulta)
    montar()
    await elegirIva('IVA_0')
    await guardar()
    expect(await screen.findByText('iva.confirmar.cuerpo')).toBeInTheDocument()
    expect(http.put).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'iva.confirmar.continuar' }))
    await waitFor(() => expect(puts()).toHaveLength(1))
    expect(puts()[0][1]).toMatchObject({ ivaTratamiento: 'IVA_0' })
  })

  it('negocio ya encendido: guarda directo, sin aviso', async () => {
    svc.getIvaPorProducto.mockResolvedValue(estado({ encendido: true }))
    montar()
    await elegirIva('EXENTO')
    await guardar()
    await waitFor(() => expect(puts()).toHaveLength(1))
    expect(screen.queryByText('iva.confirmar.cuerpo')).not.toBeInTheDocument()
    expect(puts()[0][1]).toMatchObject({ ivaTratamiento: 'EXENTO' })
    // y el estado del IVA se vuelve a pedir: el guardado pudo prender el IVA por producto
    await waitFor(() => expect(svc.getIvaPorProducto.mock.calls.length).toBeGreaterThan(1))
  })

  it('guardar un producto que ya existe dice «Producto guardado», nunca «Producto creado» (guía del IVA, 31-oct)', async () => {
    svc.getIvaPorProducto.mockResolvedValue(estado({ encendido: true }))
    montar()
    await elegirIva('EXENTO')
    await guardar()
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'products.detail.toasts.saved' })))
    expect(toastMock).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'wizard.success' }))
  })

  it('si encender necesita algo, la lista aparece junto al selector (guardado sin inventario)', async () => {
    svc.getIvaPorProducto.mockResolvedValue(estado({ encendido: true }))
    http.put.mockRejectedValue({
      response: {
        status: 409,
        data: {
          code: 'IVA_ENCENDIDO_BLOQUEADO',
          message: 'x',
          details: {
            bloqueos: [{ codigo: 'APARATO_VIEJO', mensaje: 'Caja 2 imprime el IVA de forma incorrecta', comoArreglar: 'Actualiza su app' }],
          },
        },
      },
    })
    montar()
    await elegirIva('EXENTO')
    await guardar()
    expect(await screen.findByRole('alert')).toHaveTextContent('Caja 2 imprime el IVA de forma incorrecta')
    expect(screen.getByRole('alert')).toHaveTextContent('Actualiza su app')
    // Pulido 6b: el toast manda a la lista de junto al selector (no repite el texto del servidor, que terminaba en «…esto:» sin lista).
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ description: 'iva.bloqueos.toast', variant: 'default' }))
    expect(toastMock).not.toHaveBeenCalledWith(expect.objectContaining({ description: 'x' }))
  })

  it('con inventario, un 409 de bloqueos: también el toast manda a la lista de junto al selector y la lista aparece', async () => {
    svc.getIvaPorProducto.mockResolvedValue(estado({ encendido: true }))
    inv.productWizardApi.getWizardProgress.mockResolvedValue({
      data: { data: { inventoryMethod: 'QUANTITY', details: { currentStock: 5, costPerUnit: 2, reorderPoint: 3 } } },
    })
    http.put.mockRejectedValue({
      response: {
        status: 409,
        data: {
          code: 'IVA_ENCENDIDO_BLOQUEADO',
          message: 'x',
          details: { bloqueos: [{ codigo: 'APARATO_VIEJO', mensaje: 'Caja 2 imprime el IVA mal', comoArreglar: 'Actualiza su app' }] },
        },
      },
    })
    montar()
    await elegirIva('EXENTO')
    await guardar()
    expect(await screen.findByText(/Caja 2 imprime el IVA mal/)).toBeInTheDocument() // la lista de junto al selector
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ description: 'iva.bloqueos.toast', variant: 'default' }))
    expect(inv.productWizardApi.configureSimpleStock).not.toHaveBeenCalled()
  })

  // Pulido 6b (QA 14-oct): el selector medía 36 x 384 px contra 48 px de sus vecinos. Misma altura (h-12) y sin tope de ancho (el campo de precio
  // ocupa todo el renglón). jsdom no mide px: se afirman las clases que los fijan.
  it('el selector del asistente tiene el alto (h-12) y el ancho del campo de precio vecino', async () => {
    svc.getIvaPorProducto.mockResolvedValue(estado({ encendido: true }))
    montar()
    const selector = await screen.findByRole('combobox', { name: 'iva.label' })
    expect(selector).toHaveClass('h-12', 'w-full')
    expect(selector).not.toHaveClass('h-9')
    expect(screen.getByText('iva.label').parentElement).not.toHaveClass('max-w-96')
    expect(await screen.findByPlaceholderText('0.00')).toHaveClass('h-12') // el vecino con el que debe cuadrar
  })

  it('409 IVA_ENCENDIDO_OCUPADO: el mensaje del servidor en un aviso neutro (es una espera), nunca rojo (revisión final, I-1)', async () => {
    svc.getIvaPorProducto.mockResolvedValue(estado({ encendido: true }))
    const mensaje = 'Hay facturas o ventas en proceso en tu organización; vuelve a intentar en un momento.'
    http.put.mockRejectedValue({ response: { status: 409, data: { code: 'IVA_ENCENDIDO_OCUPADO', message: mensaje } } })
    montar()
    await elegirIva('EXENTO')
    await guardar()
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ description: mensaje })))
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ description: mensaje, variant: 'default' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
