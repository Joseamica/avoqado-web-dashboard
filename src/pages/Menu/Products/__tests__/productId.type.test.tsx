/**
 * W1 (full-testing del conector Shopify, 10-oct-2026): la ficha de edición de producto no conocía el tipo canónico
 * `REGULAR` (ni los demás de Square que usa el asistente de alta). Todo producto regular —el que crea el asistente y el
 * que importa Shopify— se veía mal y no se podía guardar sin elegir un tipo viejo («Retail» ⇒ RETAIL, deprecado).
 * La ficha debe mostrar y conservar el tipo real del producto, ofrecer los tipos del asistente y seguir mostrando los
 * tipos viejos de los productos que ya los tienen.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
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
}))
vi.mock('@/services/menu.service', () => svc)
vi.mock('@/services/inventory.service', () => ({ recipesApi: { get: vi.fn() } }))
vi.mock('@/api', () => ({ default: { patch: vi.fn(), get: vi.fn() } }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', venueSlug: 'mi-tienda', venue: { id: 'v1', organizationId: 'o1' } }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => undefined }) }))
// Funciones ESTABLES, como las del contexto real: el efecto que llena el formulario depende de ellas y, si cambiaran en
// cada render, el formulario se reiniciaría a cada tecla.
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
// La llave tal cual (los tipos viejos se ven por su llave de i18n); el idioma, español, como la mayoría de los negocios.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es-MX' } }),
}))

import ProductId from '../productId'

const producto = (type: string) => ({
  id: 'p1',
  venueId: 'v1',
  name: 'Camiseta lino',
  sku: 'CAM-001',
  gtin: '',
  description: '',
  price: 499,
  type,
  imageUrl: null,
  categoryId: 'c1',
  category: { id: 'c1', name: 'Ropa' },
  modifierGroups: [],
  trackInventory: true,
  inventoryMethod: 'QUANTITY',
  unit: 'UNIT',
  soldByWeight: false,
  inventory: { currentStock: 10, minimumStock: 2 },
})

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/menumaker/products/p1']}>
        <Routes>
          <Route path="/menumaker/products/:productId" element={<ProductId />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Cambia el precio (el botón de guardar sólo se prende con un cambio) y guarda, sin tocar el tipo. */
async function guardarSinTocarElTipo() {
  const precio = await screen.findByDisplayValue('499')
  await userEvent.clear(precio)
  await userEvent.type(precio, '520')
  await userEvent.click(screen.getByRole('button', { name: 'modifiers.forms.save' }))
}

beforeEach(() => {
  svc.getMenuCategories.mockResolvedValue([{ id: 'c1', name: 'Ropa' }])
  svc.getModifierGroups.mockResolvedValue([])
  svc.updateProduct.mockResolvedValue({})
})

describe('ficha de producto: el tipo (W1)', () => {
  it('un producto REGULAR se ve como «Artículo Regular» y se guarda sin error conservando REGULAR', async () => {
    svc.getProduct.mockResolvedValue(producto('REGULAR'))
    pintar()
    expect(await screen.findByRole('combobox', { name: 'products.create.type' })).toHaveTextContent('Artículo Regular')
    await guardarSinTocarElTipo()
    await waitFor(() => expect(svc.updateProduct).toHaveBeenCalledTimes(1))
    expect(svc.updateProduct.mock.calls[0][2]).toMatchObject({ type: 'REGULAR', price: 520 })
    expect(screen.queryByText('products.create.typeRequired')).not.toBeInTheDocument()
  })

  it('ofrece los tipos alineados con Square, sin la lista vieja y SIN servicio con cita ni clase (los maneja «Servicios»)', async () => {
    svc.getProduct.mockResolvedValue(producto('REGULAR'))
    pintar()
    const tipo = await screen.findByRole('combobox', { name: 'products.create.type' })
    await waitFor(() => expect(tipo).toHaveTextContent('Artículo Regular'))
    await userEvent.click(tipo)
    const opciones = (await screen.findAllByRole('option')).map(o => o.textContent)
    expect(opciones).toEqual(['Artículo Regular', 'Bebidas y alimentos preparados', 'Evento', 'Producto Digital', 'Donación', 'Otro'])
  })

  it.each([
    ['APPOINTMENTS_SERVICE', 'Servicio con cita'],
    ['CLASS', 'Clase / Taller'],
  ])('un producto guardado como %s lo sigue mostrando, lo ofrece SÓLO a él y lo conserva al guardar', async (codigo, nombre) => {
    svc.getProduct.mockResolvedValue({ ...producto(codigo), trackInventory: false, inventoryMethod: null })
    pintar()
    const tipo = await screen.findByRole('combobox', { name: 'products.create.type' })
    await waitFor(() => expect(tipo).toHaveTextContent(nombre))
    await guardarSinTocarElTipo()
    await waitFor(() => expect(svc.updateProduct).toHaveBeenCalledTimes(1))
    expect(svc.updateProduct.mock.calls[0][2]).toMatchObject({ type: codigo })
    await userEvent.click(tipo)
    const opciones = (await screen.findAllByRole('option')).map(o => o.textContent)
    expect(opciones).toEqual([
      'Artículo Regular',
      'Bebidas y alimentos preparados',
      'Evento',
      'Producto Digital',
      'Donación',
      'Otro',
      nombre,
    ])
  })

  it('un producto con un tipo VIEJO (RETAIL) lo sigue mostrando y, sin tocarlo, lo conserva al guardar', async () => {
    svc.getProduct.mockResolvedValue(producto('RETAIL'))
    pintar()
    const tipo = await screen.findByRole('combobox', { name: 'products.create.type' })
    await waitFor(() => expect(tipo).toHaveTextContent('products.create.types.retail'))
    await guardarSinTocarElTipo()
    await waitFor(() => expect(svc.updateProduct).toHaveBeenCalledTimes(1))
    expect(svc.updateProduct.mock.calls[0][2]).toMatchObject({ type: 'RETAIL' })
  })

  it('los demás tipos viejos también se ven con su nombre (FOOD ⇒ Comida)', async () => {
    svc.getProduct.mockResolvedValue(producto('FOOD'))
    pintar()
    const tipo = await screen.findByRole('combobox', { name: 'products.create.type' })
    await waitFor(() => expect(tipo).toHaveTextContent('products.create.types.food'))
  })
})
