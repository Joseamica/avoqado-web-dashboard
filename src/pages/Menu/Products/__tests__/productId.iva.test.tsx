/**
 * IVA por producto (plan 6b, Tarea 11, D1): el selector «IVA» junto al precio en la ficha del producto.
 * Se manda `ivaTratamiento` SÓLO si cambió; el primer encendido pide confirmación (también con el estado cargando o
 * fallido: un estado desconocido nunca se salta el aviso); si encender necesita algo, la lista sale al guardar.
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
  getIvaPorProducto: vi.fn(),
  // Función plana (no vi.fn): la clave de la consulta del estado del IVA.
  IVA_QUERY_KEY: (venueId: string) => ['iva-por-producto', venueId] as const,
}))
vi.mock('@/services/menu.service', () => svc)
vi.mock('@/services/inventory.service', () => ({ recipesApi: { get: vi.fn() } }))
vi.mock('@/api', () => ({ default: { patch: vi.fn(), get: vi.fn() } }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', venueSlug: 'mi-tienda', venue: { id: 'v1', organizationId: 'o1' } }),
}))
const toastMock = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastMock }) }))
// Funciones ESTABLES, como las del contexto real: el efecto que llena el formulario depende de ellas.
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
import esMenu from '@/locales/es/menu.json'
import enMenu from '@/locales/en/menu.json'

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
  venueId: 'v1',
  name: 'Café en grano',
  sku: 'CAFE-001',
  gtin: '',
  description: '',
  price: 250,
  type: 'REGULAR',
  imageUrl: null,
  categoryId: 'c1',
  category: { id: 'c1', name: 'Café' },
  modifierGroups: [],
  trackInventory: false,
  inventoryMethod: null,
  ivaTratamiento: 'IVA_16',
  ...over,
})

function renderFicha() {
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

const guardarBtn = () => screen.getByRole('button', { name: /save|guardar/i })

beforeEach(() => {
  svc.getMenuCategories.mockResolvedValue([{ id: 'c1', name: 'Café' }])
  svc.getModifierGroups.mockResolvedValue([])
  svc.updateProduct.mockResolvedValue({})
})

describe('ficha de producto: el IVA junto al precio (6b)', () => {
  it('el IVA va junto al precio; elegir 0 % lo manda al guardar (negocio ya encendido: sin aviso)', async () => {
    svc.getProduct.mockResolvedValue(producto())
    svc.getIvaPorProducto.mockResolvedValue(estado({ encendido: true }))
    svc.updateProduct.mockResolvedValue(producto({ ivaTratamiento: 'IVA_0' }))
    renderFicha()
    await userEvent.click(await screen.findByRole('combobox', { name: 'iva.label' }))
    await userEvent.click(await screen.findByRole('option', { name: 'iva.opciones.IVA_0' }))
    await userEvent.click(guardarBtn())
    await waitFor(() => expect(svc.updateProduct).toHaveBeenCalled())
    expect(svc.updateProduct.mock.calls[0][2]).toMatchObject({ ivaTratamiento: 'IVA_0' })
  })

  it('sin tocar el IVA, el guardado NO lo manda (Review Focus 3)', async () => {
    svc.getProduct.mockResolvedValue(producto({ ivaTratamiento: 'BLOQUEADO_04' }))
    svc.getIvaPorProducto.mockResolvedValue(estado({ encendido: true }))
    svc.updateProduct.mockResolvedValue(producto())
    renderFicha()
    expect(await screen.findByText('iva.porRevisar')).toBeInTheDocument()
    // Sin tocar el IVA, el botón se prende con otro cambio (el precio).
    const precio = await screen.findByDisplayValue('250')
    await userEvent.clear(precio)
    await userEvent.type(precio, '260')
    await userEvent.click(guardarBtn())
    await waitFor(() => expect(svc.updateProduct).toHaveBeenCalled())
    expect(svc.updateProduct.mock.calls[0][2]).toMatchObject({ price: 260 })
    expect(svc.updateProduct.mock.calls[0][2]).not.toHaveProperty('ivaTratamiento')
  })

  it('elegir otro IVA y volver al que ya tenía no es un cambio: Guardar sigue apagado y no lo manda (Review Focus 3)', async () => {
    svc.getProduct.mockResolvedValue(producto())
    svc.getIvaPorProducto.mockResolvedValue(estado({ encendido: true }))
    renderFicha()
    const guardar = await screen.findByRole('button', { name: /save|guardar/i })
    await userEvent.click(screen.getByRole('combobox', { name: 'iva.label' }))
    await userEvent.click(await screen.findByRole('option', { name: 'iva.opciones.IVA_0' }))
    expect(guardar).toBeEnabled()
    await userEvent.click(screen.getByRole('combobox', { name: 'iva.label' }))
    await userEvent.click(await screen.findByRole('option', { name: 'iva.opciones.IVA_16' }))
    expect(guardar).toBeDisabled()
    // y con otro cambio (el precio), el guardado sale sin `ivaTratamiento`
    const precio = await screen.findByDisplayValue('250')
    await userEvent.clear(precio)
    await userEvent.type(precio, '270')
    await userEvent.click(guardar)
    await waitFor(() => expect(svc.updateProduct).toHaveBeenCalled())
    expect(svc.updateProduct.mock.calls[0][2]).toMatchObject({ price: 270 })
    expect(svc.updateProduct.mock.calls[0][2]).not.toHaveProperty('ivaTratamiento')
  })

  it('si encender necesita algo, la lista aparece al guardar con cómo arreglarlo', async () => {
    svc.getProduct.mockResolvedValue(producto())
    svc.getIvaPorProducto.mockResolvedValue(estado())
    svc.updateProduct.mockRejectedValue({
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
    renderFicha()
    await userEvent.click(await screen.findByRole('combobox', { name: 'iva.label' }))
    await userEvent.click(await screen.findByRole('option', { name: 'iva.opciones.EXENTO' }))
    await userEvent.click(guardarBtn())
    await userEvent.click(await screen.findByRole('button', { name: 'iva.confirmar.continuar' })) // primer encendido
    expect(await screen.findByRole('alert')).toHaveTextContent('Caja 2 imprime el IVA de forma incorrecta')
    expect(screen.getByRole('alert')).toHaveTextContent('Actualiza su app')
    // Pulido 6b: el toast no repite el texto del servidor (terminaba en «…falta resolver esto:» sin lista); manda a la lista de junto al selector.
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ description: 'iva.bloqueos.toast', variant: 'default' }))
    expect(toastMock).not.toHaveBeenCalledWith(expect.objectContaining({ description: 'x' }))
  })

  it('el texto real del toast de los bloqueos (es y en) manda a la lista de junto al selector', () => {
    expect(esMenu.iva.bloqueos.toast).toBe('Para usar este IVA falta resolver lo que aparece junto al selector.')
    expect(enMenu.iva.bloqueos.toast).toBe('To use this VAT rate, resolve what appears next to the selector.')
  })

  it('en la ficha el selector sigue con su alto y ancho de siempre (h-9, max-w-96); el asistente es el que lo agranda', async () => {
    svc.getProduct.mockResolvedValue(producto())
    svc.getIvaPorProducto.mockResolvedValue(estado({ encendido: true }))
    renderFicha()
    const selector = await screen.findByRole('combobox', { name: 'iva.label' })
    expect(selector).toHaveClass('h-9')
    expect(selector).not.toHaveClass('h-12')
    expect(screen.getByText('iva.label').parentElement).toHaveClass('max-w-96')
  })

  it('cambiar SÓLO el IVA (sin tocar precio ni nombre) habilita Guardar y lo manda (Codex r1 P2-3)', async () => {
    svc.getProduct.mockResolvedValue(producto())
    svc.getIvaPorProducto.mockResolvedValue(estado({ encendido: true }))
    svc.updateProduct.mockResolvedValue(producto({ ivaTratamiento: 'EXENTO' }))
    renderFicha()
    const guardar = await screen.findByRole('button', { name: /save|guardar/i })
    expect(guardar).toBeDisabled()
    await userEvent.click(screen.getByRole('combobox', { name: 'iva.label' }))
    await userEvent.click(await screen.findByRole('option', { name: 'iva.opciones.EXENTO' }))
    expect(guardar).toBeEnabled()
    await userEvent.click(guardar)
    await waitFor(() =>
      expect(svc.updateProduct.mock.calls[0][2]).toMatchObject({ ivaTratamiento: 'EXENTO', price: 250, name: 'Café en grano' }),
    )
  })

  it('primer encendido: Guardar pide confirmación y sin «Continuar» no guarda (decisión del founder, 12-oct)', async () => {
    svc.getProduct.mockResolvedValue(producto())
    svc.getIvaPorProducto.mockResolvedValue(estado({ encendido: false }))
    renderFicha()
    await userEvent.click(await screen.findByRole('combobox', { name: 'iva.label' }))
    await userEvent.click(await screen.findByRole('option', { name: 'iva.opciones.IVA_0' }))
    await userEvent.click(guardarBtn())
    expect(await screen.findByText('iva.confirmar.cuerpo')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'iva.confirmar.cancelar' }))
    expect(svc.updateProduct).not.toHaveBeenCalled()
    await userEvent.click(guardarBtn())
    await userEvent.click(await screen.findByRole('button', { name: 'iva.confirmar.continuar' }))
    await waitFor(() => expect(svc.updateProduct).toHaveBeenCalledTimes(1))
  })

  it.each([
    ['todavía cargando', () => new Promise(() => undefined)],
    ['con error', () => Promise.reject(new Error('sin red'))],
  ])('estado %s: el primer cambio de IVA también pide confirmación (Codex r2 N7)', async (_n, consulta) => {
    svc.getProduct.mockResolvedValue(producto())
    svc.getIvaPorProducto.mockImplementation(consulta)
    renderFicha()
    await userEvent.click(await screen.findByRole('combobox', { name: 'iva.label' }))
    await userEvent.click(await screen.findByRole('option', { name: 'iva.opciones.IVA_0' }))
    await userEvent.click(guardarBtn())
    expect(await screen.findByText('iva.confirmar.cuerpo')).toBeInTheDocument()
    expect(svc.updateProduct).not.toHaveBeenCalled()
  })

  it('un 403 muestra el mensaje del servidor en el toast (Codex r2 N6)', async () => {
    svc.getProduct.mockResolvedValue(producto())
    svc.getIvaPorProducto.mockResolvedValue(estado({ encendido: false }))
    svc.updateProduct.mockRejectedValue({
      message: 'Request failed with status code 403',
      response: { status: 403, data: { code: 'IVA_ENCENDIDO_SOLO_DUENO', message: 'sólo dueño o administrador' } },
    })
    renderFicha()
    await userEvent.click(await screen.findByRole('combobox', { name: 'iva.label' }))
    await userEvent.click(await screen.findByRole('option', { name: 'iva.opciones.IVA_0' }))
    await userEvent.click(guardarBtn())
    await userEvent.click(await screen.findByRole('button', { name: 'iva.confirmar.continuar' }))
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ description: 'sólo dueño o administrador' })))
  })

  it('409 IVA_ENCENDIDO_OCUPADO (facturas en proceso): el mensaje del servidor en un aviso neutro, nunca rojo ni como bloqueos (revisión final, I-1)', async () => {
    svc.getProduct.mockResolvedValue(producto())
    svc.getIvaPorProducto.mockResolvedValue(estado({ encendido: false }))
    const mensaje = 'Hay facturas o ventas en proceso en tu organización; vuelve a intentar en un momento.'
    svc.updateProduct.mockRejectedValue({
      message: 'Request failed with status code 409',
      response: { status: 409, data: { code: 'IVA_ENCENDIDO_OCUPADO', message: mensaje } },
    })
    renderFicha()
    await userEvent.click(await screen.findByRole('combobox', { name: 'iva.label' }))
    await userEvent.click(await screen.findByRole('option', { name: 'iva.opciones.IVA_0' }))
    await userEvent.click(guardarBtn())
    await userEvent.click(await screen.findByRole('button', { name: 'iva.confirmar.continuar' }))
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ description: mensaje })))
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ description: mensaje, variant: 'default' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    [{ ajusteDeliveryAlgunaVez: true }, {}, 'iva.deshabilitado.delivery'],
    [{}, { contabilidad: true }, 'iva.deshabilitado.contabilidad'],
  ])('deshabilitado con su motivo (%#)', async (p, e, motivo) => {
    svc.getProduct.mockResolvedValue(producto(p))
    svc.getIvaPorProducto.mockResolvedValue(estado(e))
    renderFicha()
    expect(await screen.findByText(motivo)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'iva.label' })).toBeDisabled()
  })
})
