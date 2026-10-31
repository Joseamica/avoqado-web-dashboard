/**
 * Variantes de producto, bloque 2 (Tarea 13): la ficha `/menumaker/products/:id` de una VARIANTE (talla/color). Los enlaces de Shopify y
 * de extras abren la ficha por id, así que aquí también se respeta que nombre, descripción, categoría, tipo, foto, IVA y extras son del
 * padre: se ven deshabilitados, NO se mandan, y el 409 `PRODUCT_FIELD_OWNED_BY_GROUP` se lee en español.
 * Arnés copiado de `productId.type.test.tsx` (mismos `vi.mock`), con el toast espiado y `fullBasePath`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Radix Select usa pointer capture, que jsdom no trae. Funciones planas, NO vi.fn() (mockReset: true las vaciaría).
Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}

const svc = vi.hoisted(() => ({
  getProduct: vi.fn(),
  updateProduct: vi.fn(),
  getMenuCategories: vi.fn(),
  getModifierGroups: vi.fn(),
  deleteProduct: vi.fn(),
  getIvaPorProducto: vi.fn(),
  IVA_QUERY_KEY: (venueId: string) => ['iva-por-producto', venueId] as const,
}))
vi.mock('@/services/menu.service', () => svc)
vi.mock('@/services/inventory.service', () => ({ recipesApi: { get: vi.fn() } }))
vi.mock('@/api', () => ({ default: { patch: vi.fn(), get: vi.fn() } }))
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
const migas = vi.hoisted(() => ({ setCustomSegment: () => undefined, clearCustomSegment: () => undefined }))
vi.mock('@/context/BreadcrumbContext', () => ({ useBreadcrumb: () => migas }))
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
vi.mock('@/pages/Inventory/components/ProductWizardDialog', () => ({ ProductWizardDialog: () => null }))
vi.mock('@/features/master-catalog/use-master-catalog-error', () => ({ useMasterCatalogError: () => () => false }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es-MX' } }),
}))

import ProductId from '../productId'

const suelto = {
  id: 'p1',
  venueId: 'v1',
  name: 'Playera · M',
  sku: 'PLA-M',
  gtin: '',
  description: null,
  price: 199,
  type: 'REGULAR',
  imageUrl: 'https://cdn.example.com/playera.jpg',
  categoryId: 'c1',
  category: { id: 'c1', name: 'Ropa' },
  modifierGroups: [],
  trackInventory: true,
  inventoryMethod: 'QUANTITY',
  unit: 'UNIT',
  soldByWeight: false,
  inventory: { currentStock: 10, minimumStock: 2 },
  ivaTratamiento: 'IVA_16',
}
const variante = { ...suelto, productGroupId: 'g1', productGroupName: 'Playera' }

/** Muestra a dónde navegó «Abrir «Playera»» (ruta + búsqueda). */
function Destino() {
  const { pathname, search } = useLocation()
  return <p>destino:{pathname + search}</p>
}

function pintar(ruta = '/menumaker/products/p1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/menumaker/products/:productId" element={<ProductId />} />
          <Route path="/venues/mi-tienda/menumaker/products" element={<Destino />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function cambiarPrecioYGuardar() {
  const precio = await screen.findByDisplayValue('199')
  await userEvent.clear(precio)
  await userEvent.type(precio, '219')
  await userEvent.click(screen.getByRole('button', { name: 'modifiers.forms.save' }))
}

beforeEach(() => {
  svc.getIvaPorProducto.mockResolvedValue({
    encendido: true,
    habilitadoAt: null,
    contabilidad: false,
    bloqueos: [],
    avisos: [],
    facturasSinSello: [],
  })
  svc.getMenuCategories.mockResolvedValue([{ id: 'c1', name: 'Ropa' }])
  svc.getModifierGroups.mockResolvedValue([])
  svc.updateProduct.mockResolvedValue({})
})

describe('ficha de una variante (Tarea 13)', () => {
  it('arriba se ve el aviso de variante y «Abrir» lleva a la familia en la lista', async () => {
    svc.getProduct.mockResolvedValue(variante)
    pintar()
    expect(await screen.findByText('variante.aviso')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'variante.abrir' }))
    expect(await screen.findByText('destino:/venues/mi-tienda/menumaker/products?familia=g1')).toBeInTheDocument()
  })

  it('nombre, descripción, tipo y foto están deshabilitados; precio y SKU se editan', async () => {
    svc.getProduct.mockResolvedValue(variante)
    pintar()
    expect(await screen.findByDisplayValue('Playera · M')).toBeDisabled()
    expect(screen.getByPlaceholderText('products.create.descriptionPlaceholder')).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'products.create.type' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'products.create.replace' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'products.create.delete' })).toBeDisabled()
    expect(screen.getByDisplayValue('199')).toBeEnabled()
    expect(screen.getByDisplayValue('PLA-M')).toBeEnabled()
  })

  it('🔴 guardar el precio NO manda los campos del padre, y el 409 del server se ve con su texto en español', async () => {
    svc.getProduct.mockResolvedValue(variante)
    svc.updateProduct.mockRejectedValue({
      response: {
        status: 409,
        data: {
          message: 'Este dato se edita en el producto «Playera», no en cada variante.',
          code: 'PRODUCT_FIELD_OWNED_BY_GROUP',
        },
      },
      message: 'Request failed with status code 409',
    })
    pintar()
    await cambiarPrecioYGuardar()
    await waitFor(() => expect(svc.updateProduct).toHaveBeenCalledTimes(1))
    const body = svc.updateProduct.mock.calls[0][2]
    expect(body).toMatchObject({ price: 219, sku: 'PLA-M' })
    for (const campo of ['name', 'description', 'type', 'imageUrl', 'categoryId', 'modifierGroupIds', 'ivaTratamiento']) {
      expect(body).not.toHaveProperty(campo)
    }
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Este dato se edita en el producto «Playera», no en cada variante.' }),
      ),
    )
  })

  it('🔴 regresión: un producto suelto se ve y se guarda igual que hoy (sin aviso, nombre habilitado, manda nombre y categoría)', async () => {
    svc.getProduct.mockResolvedValue(suelto)
    pintar()
    expect(await screen.findByDisplayValue('Playera · M')).toBeEnabled()
    expect(screen.queryByText('variante.aviso')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'products.create.type' })).toBeEnabled()
    await cambiarPrecioYGuardar()
    await waitFor(() => expect(svc.updateProduct).toHaveBeenCalledTimes(1))
    expect(svc.updateProduct.mock.calls[0][2]).toMatchObject({ name: 'Playera · M', type: 'REGULAR', categoryId: 'c1', price: 219 })
  })

  it('🔴 QA ALTO-1: una variante con nombre más largo que el tope SÍ guarda (el nombre es del padre: no se valida ni se manda)', async () => {
    // 268 caracteres: más que el tope de un producto suelto (255), así que sólo pasa si la variante no valida el nombre.
    const nombreDeFamilia = `Playera QA Pro · S · Azul · ${'x'.repeat(240)}`
    svc.getProduct.mockResolvedValue({ ...variante, name: nombreDeFamilia })
    pintar()
    expect(await screen.findByDisplayValue(nombreDeFamilia)).toBeDisabled()
    await cambiarPrecioYGuardar()
    await waitFor(() => expect(svc.updateProduct).toHaveBeenCalledTimes(1))
    expect(svc.updateProduct.mock.calls[0][2]).toMatchObject({ price: 219 })
    expect(svc.updateProduct.mock.calls[0][2]).not.toHaveProperty('name')
    expect(screen.queryByText('forms.validation.productNameMaxLength')).not.toBeInTheDocument()
  })

  it('regresión: un producto suelto sigue validando su nombre, con el tope del servidor (255)', async () => {
    svc.getProduct.mockResolvedValue({ ...suelto, name: 'x'.repeat(256) })
    pintar()
    await cambiarPrecioYGuardar()
    expect(await screen.findByText('forms.validation.productNameMaxLength')).toBeInTheDocument()
    expect(svc.updateProduct).not.toHaveBeenCalled()
  })

  it('🔴 D2 (30-oct): un producto suelto con nombre de 33 caracteres ya guarda (con el tope de 30 la ficha lo bloqueaba)', async () => {
    svc.getProduct.mockResolvedValue({ ...suelto, name: 'Playera QA Pro · S · Azul · Corta' })
    pintar()
    await cambiarPrecioYGuardar()
    await waitFor(() => expect(svc.updateProduct).toHaveBeenCalledTimes(1))
    expect(svc.updateProduct.mock.calls[0][2]).toMatchObject({ name: 'Playera QA Pro · S · Azul · Corta', price: 219 })
  })

  it('🔴 Codex C4: si otra sesión lo volvió variante, el 409 relee la ficha (modo variante) y conserva el precio tecleado', async () => {
    // Antes del guardado es suelto; al releer ya es variante (y con un nombre de familia largo).
    svc.getProduct.mockResolvedValueOnce(suelto).mockResolvedValue({ ...variante, name: 'Playera QA Pro · S · Azul · Corta' })
    svc.updateProduct.mockRejectedValueOnce({
      response: {
        status: 409,
        data: { message: 'Este dato se edita en el producto «Playera», no en cada variante.', code: 'PRODUCT_FIELD_OWNED_BY_GROUP' },
      },
    })
    pintar()
    await cambiarPrecioYGuardar()
    await waitFor(() => expect(svc.updateProduct).toHaveBeenCalledTimes(1))
    expect(svc.updateProduct.mock.calls[0][2]).toHaveProperty('name') // como suelto mandó el nombre

    expect(await screen.findByText('variante.aviso')).toBeInTheDocument()
    expect(await screen.findByDisplayValue('Playera QA Pro · S · Azul · Corta')).toBeDisabled()
    expect(screen.getByDisplayValue('219')).toBeEnabled() // lo tecleado sigue

    await userEvent.click(screen.getByRole('button', { name: 'modifiers.forms.save' }))
    await waitFor(() => expect(svc.updateProduct).toHaveBeenCalledTimes(2))
    const body = svc.updateProduct.mock.calls[1][2]
    expect(body).toMatchObject({ price: 219, sku: 'PLA-M' })
    for (const campo of ['name', 'description', 'type', 'imageUrl', 'categoryId', 'modifierGroupIds', 'ivaTratamiento']) {
      expect(body).not.toHaveProperty(campo)
    }
  })

  const conflicto = {
    response: {
      status: 409,
      data: { message: 'Este dato se edita en el producto «Playera», no en cada variante.', code: 'PRODUCT_FIELD_OWNED_BY_GROUP' },
    },
  }

  it('🔴 ronda 3 (Codex N1): lo tecleado MIENTRAS se recarga tras el 409 se conserva (230, no el 219 del momento del error)', async () => {
    let llegaLaVariante: (v: unknown) => void = () => {}
    svc.getProduct
      .mockResolvedValueOnce(suelto)
      .mockReturnValueOnce(new Promise(r => (llegaLaVariante = r)))
      .mockResolvedValue(variante)
    svc.updateProduct.mockRejectedValueOnce(conflicto)
    pintar()
    await cambiarPrecioYGuardar()
    await waitFor(() => expect(svc.getProduct).toHaveBeenCalledTimes(2)) // la recarga ya salió y está pendiente
    const precio = screen.getByDisplayValue('219')
    await userEvent.clear(precio)
    await userEvent.type(precio, '230')

    await act(async () => llegaLaVariante(variante))
    expect(await screen.findByText('variante.aviso')).toBeInTheDocument()
    expect(screen.getByDisplayValue('230')).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'modifiers.forms.save' }))
    await waitFor(() => expect(svc.updateProduct).toHaveBeenCalledTimes(2))
    expect(svc.updateProduct.mock.calls[1][2]).toMatchObject({ price: 230 })
  })

  it('🔴 ronda 3 (Codex N2): sin tocar el inventario, el que activó otra sesión se queda (el PUT siguiente no lo apaga)', async () => {
    svc.getProduct
      .mockResolvedValueOnce({ ...suelto, trackInventory: false, inventoryMethod: null })
      .mockResolvedValue({ ...variante, trackInventory: true, inventoryMethod: 'QUANTITY' })
    svc.updateProduct.mockRejectedValueOnce(conflicto)
    pintar()
    await cambiarPrecioYGuardar()
    await waitFor(() => expect(svc.updateProduct).toHaveBeenCalledTimes(1))
    expect(svc.updateProduct.mock.calls[0][2]).toMatchObject({ trackInventory: false })

    expect(await screen.findByText('variante.aviso')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'modifiers.forms.save' }))
    await waitFor(() => expect(svc.updateProduct).toHaveBeenCalledTimes(2))
    expect(svc.updateProduct.mock.calls[1][2]).toMatchObject({ price: 219, trackInventory: true, inventoryMethod: 'QUANTITY' })
  })

  it('🔴 ronda 4: si SÓLO cambió el inventario («por cantidad») y llega el 409, tras recargar «Guardar» sigue habilitado y manda su elección', async () => {
    svc.getProduct
      .mockResolvedValueOnce({ ...suelto, trackInventory: false, inventoryMethod: null })
      .mockResolvedValue({ ...variante, trackInventory: false, inventoryMethod: null })
    svc.updateProduct.mockRejectedValueOnce(conflicto)
    pintar('/menumaker/products/p1#inventory')
    const guardar = () => screen.getByRole('button', { name: 'modifiers.forms.save' })
    await userEvent.click(await screen.findByRole('radio', { name: /products\.detail\.inventory\.trackByQuantity\b/ }))
    await waitFor(() => expect(guardar()).toBeEnabled())
    await userEvent.click(guardar())
    await waitFor(() => expect(svc.updateProduct).toHaveBeenCalledTimes(1))

    expect(await screen.findByText('variante.aviso')).toBeInTheDocument()
    await waitFor(() => expect(guardar()).toBeEnabled())
    await userEvent.click(guardar())
    await waitFor(() => expect(svc.updateProduct).toHaveBeenCalledTimes(2))
    expect(svc.updateProduct.mock.calls[1][2]).toMatchObject({ trackInventory: true, inventoryMethod: 'QUANTITY' })
  })
})
