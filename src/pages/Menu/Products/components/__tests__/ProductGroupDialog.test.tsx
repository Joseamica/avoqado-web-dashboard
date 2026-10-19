/**
 * Variantes de producto, bloque 2 (Tarea 6): editar una familia («Playera básica»).
 * - Datos del padre: se manda SOLO lo que cambió (PATCH); un cambio ajeno se adopta y nunca se revierte (Codex N1).
 * - Tabla de variantes: un PUT /products/:id por variante cambiada; si una falla, su renglón conserva lo tecleado (Codex R2).
 * - Gratis: el padre bloqueado con aviso; precios y códigos de cada variante siguen editables. Archivada: todo en sólo lectura.
 * Arnés de `productId.type.test.tsx` (vi.hoisted + vi.mock; respuestas en beforeEach: vitest corre con mockReset). `t` devuelve la clave.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const grupos = vi.hoisted(() => ({ getProductGroup: vi.fn(), updateProductGroup: vi.fn(), getArchivedVariants: vi.fn(), listOptionLibrary: vi.fn() }))
const menu = vi.hoisted(() => ({ updateProduct: vi.fn(), deleteProduct: vi.fn(), getMenuCategories: vi.fn(), getModifierGroups: vi.fn() }))
const plan = vi.hoisted(() => ({ hasAccess: true }))
const avisos = vi.hoisted(() => ({ toast: vi.fn() }))
const maestro = vi.hoisted(() => ({ atrapa: false }))
vi.mock('@/services/productGroups.service', () => grupos)
vi.mock('@/services/menu.service', async o => ({ ...(await o<object>()), ...menu }))
vi.mock('@/hooks/use-tier-feature-access', () => ({
  useTierFeatureAccess: () => ({ hasAccess: plan.hasAccess, isResolved: true, requiredTier: 'PRO', isLoading: false }),
}))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: avisos.toast }) }))
vi.mock('@/features/master-catalog/use-master-catalog-error', () => ({ useMasterCatalogError: () => () => maestro.atrapa }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
// Componentes vecinos pesados: se simulan (sus pruebas propias viven en su módulo).
vi.mock('@/components/venue-tier-badge', () => ({ VenueTierBadge: () => <span>PRO</span> }))
vi.mock('@/components/PrintStationField', () => ({ PrintStationField: () => null }))
vi.mock('@/components/SatKeyPicker', () => ({ SatKeyPicker: () => null }))
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
    setImageForCrop: () => undefined,
    setCrop: () => undefined,
    setZoom: () => undefined,
  }),
}))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (d: string) => `fecha:${d}` }) }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', venueSlug: 'mi-tienda', venue: { id: 'v1', organizationId: 'o1' }, fullBasePath: '/venues/mi-tienda' }),
}))

import { ProductGroupDialog } from '../ProductGroupDialog'

const familia = {
  id: 'g1', name: 'Playera', description: null, imageUrl: null, categoryId: 'c1', type: 'REGULAR', ivaTratamiento: 'IVA_16',
  satProductKey: null, satUnitKey: null, printStationId: null, source: 'MANUAL', modifierGroupIds: [],
  options: [{ id: 'o1', name: 'Talla', position: 0, values: [{ id: 's', value: 'S', position: 0 }] }],
  variants: [{ id: 'p1', name: 'Playera · S', sku: 'PL-S', gtin: null, price: 199, cost: null, active: true, variantImageUrl: null, values: ['S'], stock: null }],
  archivedCount: 0, archived: false, archivedAt: null,
}

function pintar(groupId = 'g1', onClose: () => void = () => {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const arbol = (id: string) => (
    <QueryClientProvider client={qc}>
      <ProductGroupDialog open onClose={onClose} venueId="v1" groupId={id} />
    </QueryClientProvider>
  )
  const r = render(arbol(groupId))
  return { ...r, qc, cambiarFamilia: (id: string) => r.rerender(arbol(id)) }
}

beforeEach(() => {
  plan.hasAccess = true
  maestro.atrapa = false
  grupos.getProductGroup.mockResolvedValue(familia)
  grupos.updateProductGroup.mockResolvedValue({ groupId: 'g1', productIds: ['p1'], categoryId: 'c1' })
  menu.updateProduct.mockResolvedValue({})
  menu.getMenuCategories.mockResolvedValue([{ id: 'c1', name: 'Ropa' }])
  menu.getModifierGroups.mockResolvedValue([])
})

describe('ProductGroupDialog', () => {
  it('cambiar el nombre del padre manda SOLO el nombre', async () => {
    pintar()
    const nombre = await screen.findByLabelText('padre.nombre')
    fireEvent.change(nombre, { target: { value: 'Playera básica' } })
    fireEvent.click(screen.getByRole('button', { name: 'padre.guardar' }))
    await waitFor(() => expect(grupos.updateProductGroup).toHaveBeenCalledWith('v1', 'g1', { name: 'Playera básica' }))
  })

  it('cambiar el precio de una variante usa la edición de producto de siempre, sólo con el precio', async () => {
    pintar()
    const precio = await screen.findByLabelText('variantesTabla.precio')
    fireEvent.change(precio, { target: { value: '249' } })
    fireEvent.click(screen.getByRole('button', { name: 'variantesTabla.guardar' }))
    await waitFor(() => expect(menu.updateProduct).toHaveBeenCalledWith('v1', 'p1', { price: 249 }))
  })

  it('🔴 en Gratis los datos del padre se bloquean con aviso, y los precios de las variantes siguen editables', async () => {
    plan.hasAccess = false
    pintar()
    expect(await screen.findByLabelText('padre.nombre')).toBeDisabled()
    expect(screen.getByText('familia.avisoPlan')).toBeInTheDocument()
    expect(screen.getByLabelText('variantesTabla.precio')).not.toBeDisabled()
  })

  it('una familia archivada se ve en sólo lectura', async () => {
    grupos.getProductGroup.mockResolvedValue({ ...familia, archived: true, archivedAt: '2026-10-14T00:00:00.000Z' })
    pintar()
    expect(await screen.findByText('familia.archivada')).toBeInTheDocument()
    expect(screen.getByLabelText('padre.nombre')).toBeDisabled()
    expect(screen.getByLabelText('variantesTabla.precio')).toBeDisabled()
  })

  it('🔴 si la segunda variante falla, su renglón conserva lo tecleado y su motivo; la que pasó adopta lo guardado', async () => {
    const m = { ...familia.variants[0], id: 'p2', name: 'Playera · M', sku: 'PL-M', values: ['M'] }
    const antes = { ...familia, variants: [familia.variants[0], m] }
    // Lo que devuelve el server tras guardar: el primer precio ya quedó (y otra persona le cambió el SKU).
    const despues = { ...antes, variants: [{ ...familia.variants[0], price: 249, sku: 'PL-S2' }, m] }
    grupos.getProductGroup.mockResolvedValueOnce(antes).mockResolvedValue(despues)
    menu.updateProduct.mockResolvedValueOnce({}).mockRejectedValueOnce({ response: { status: 400, data: { message: 'El SKU ya existe.' } } })
    pintar()
    await waitFor(() => expect(screen.getAllByLabelText('variantesTabla.precio')).toHaveLength(2))
    const [p1, p2] = screen.getAllByLabelText('variantesTabla.precio')
    fireEvent.change(p1, { target: { value: '249' } })
    fireEvent.change(p2, { target: { value: '259' } })
    fireEvent.click(screen.getByRole('button', { name: 'variantesTabla.guardar' }))

    expect(await screen.findByText('El SKU ya existe.')).toBeInTheDocument()
    expect(menu.updateProduct).toHaveBeenNthCalledWith(1, 'v1', 'p1', { price: 249 })
    expect(menu.updateProduct).toHaveBeenNthCalledWith(2, 'v1', 'p2', { price: 259 })
    expect(grupos.getProductGroup).toHaveBeenCalledTimes(2)
    // El renglón guardado se suelta y muestra el detalle nuevo; el que falló conserva lo tecleado.
    await waitFor(() => expect(screen.getAllByLabelText('variantesTabla.sku')[0]).toHaveValue('PL-S2'))
    const precios = screen.getAllByLabelText('variantesTabla.precio')
    expect(precios[0]).toHaveValue(249)
    expect(precios[1]).toHaveValue(259)
    expect(avisos.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', title: 'variantesTabla.algunasFallaron' }))
  })

  it('un error del catálogo maestro no felicita ni marca el renglón (su aviso ya salió)', async () => {
    maestro.atrapa = true
    menu.updateProduct.mockRejectedValue({ response: { status: 409, data: { code: 'MASTER_CATALOG_LOCKED' } } })
    pintar()
    fireEvent.change(await screen.findByLabelText('variantesTabla.precio'), { target: { value: '249' } })
    fireEvent.click(screen.getByRole('button', { name: 'variantesTabla.guardar' }))
    await waitFor(() => expect(grupos.getProductGroup).toHaveBeenCalledTimes(2)) // se invalidó tras el error
    await waitFor(() => expect(screen.getByLabelText('variantesTabla.precio')).not.toBeDisabled())
    expect(avisos.toast).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('variantesTabla.precio')).toHaveValue(249)
  })

  it('🔴 Codex N1: un nombre que cambió otra persona se adopta y guardar la descripción no lo revierte', async () => {
    const { qc } = pintar()
    fireEvent.change(await screen.findByLabelText('padre.descripcion'), { target: { value: 'Algodón' } })
    grupos.getProductGroup.mockResolvedValue({ ...familia, name: 'Playera premium' })
    await act(() => qc.invalidateQueries())
    await waitFor(() => expect(screen.getByLabelText('padre.nombre')).toHaveValue('Playera premium'))
    expect(screen.getByLabelText('padre.descripcion')).toHaveValue('Algodón')
    fireEvent.click(screen.getByRole('button', { name: 'padre.guardar' }))
    await waitFor(() => expect(grupos.updateProductGroup).toHaveBeenCalledWith('v1', 'g1', { description: 'Algodón' }))
  })

  it('mientras se guardan los precios, la tabla no deja teclear', async () => {
    menu.updateProduct.mockReturnValue(new Promise(() => {}))
    pintar()
    fireEvent.change(await screen.findByLabelText('variantesTabla.precio'), { target: { value: '249' } })
    fireEvent.click(screen.getByRole('button', { name: 'variantesTabla.guardar' }))
    await waitFor(() => expect(screen.getByLabelText('variantesTabla.precio')).toBeDisabled())
    expect(screen.getByLabelText('variantesTabla.sku')).toBeDisabled()
    expect(screen.getByLabelText('variantesTabla.activa')).toBeDisabled()
  })

  it('🔴 Codex N1 en la tabla: tocar sólo el SKU de un renglón no revierte el precio que otra persona cambió', async () => {
    const { qc } = pintar()
    fireEvent.change(await screen.findByLabelText('variantesTabla.sku'), { target: { value: 'PL-S-1' } })
    grupos.getProductGroup.mockResolvedValue({ ...familia, variants: [{ ...familia.variants[0], price: 249 }] })
    await act(() => qc.invalidateQueries())
    await waitFor(() => expect(screen.getByLabelText('variantesTabla.precio')).toHaveValue(249))
    expect(screen.getByLabelText('variantesTabla.sku')).toHaveValue('PL-S-1')
    fireEvent.click(screen.getByRole('button', { name: 'variantesTabla.guardar' }))
    await waitFor(() => expect(menu.updateProduct).toHaveBeenCalledWith('v1', 'p1', { sku: 'PL-S-1' }))
  })

  it('un renglón que nadie tocó no se valida ni se manda (dato viejo con precio 0)', async () => {
    const vieja = { ...familia.variants[0], price: 0 }
    const otra = { ...familia.variants[0], id: 'p2', name: 'Playera · M', sku: 'PL-M', values: ['M'] }
    grupos.getProductGroup.mockResolvedValue({ ...familia, variants: [vieja, otra] })
    pintar()
    await waitFor(() => expect(screen.getAllByLabelText('variantesTabla.sku')).toHaveLength(2))
    expect(screen.getByRole('button', { name: 'variantesTabla.guardar' })).toBeDisabled()
    fireEvent.change(screen.getAllByLabelText('variantesTabla.sku')[1], { target: { value: 'PL-M-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'variantesTabla.guardar' }))
    await waitFor(() => expect(menu.updateProduct).toHaveBeenCalledWith('v1', 'p2', { sku: 'PL-M-1' }))
    expect(menu.updateProduct).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(avisos.toast).toHaveBeenCalledWith({ title: 'variantesTabla.guardadas' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('cambiar de familia con el diálogo abierto no arrastra lo tecleado a la otra', async () => {
    const g2 = { ...familia, id: 'g2', name: 'Pantalón', variants: [{ ...familia.variants[0], id: 'p9', sku: 'PA-30' }] }
    grupos.getProductGroup.mockImplementation((_v: string, id: string) => Promise.resolve(id === 'g2' ? g2 : familia))
    const { qc, cambiarFamilia } = pintar()
    fireEvent.change(await screen.findByLabelText('padre.nombre'), { target: { value: 'Playera básica' } })
    fireEvent.change(screen.getByLabelText('variantesTabla.sku'), { target: { value: 'PL-S-1' } })
    // g2 ya estaba en caché (se abrió antes): el diálogo no pasa por «cargando» y los formularios NO se desmontan solos.
    qc.setQueryData(['products', 'v1', 'groups', 'detail', 'g2'], g2)
    cambiarFamilia('g2')
    await waitFor(() => expect(screen.getByLabelText('padre.nombre')).toHaveValue('Pantalón'))
    expect(screen.getByLabelText('variantesTabla.sku')).toHaveValue('PA-30')
  })

  it('si fallan las categorías o los extras lo dice y deja reintentar (no «no hay extras»)', async () => {
    menu.getMenuCategories.mockRejectedValue({ response: { status: 500 } })
    menu.getModifierGroups.mockRejectedValue({ response: { status: 500 } })
    pintar()
    expect(await screen.findByText('padre.errorCategorias')).toBeInTheDocument()
    expect(await screen.findByText('padre.errorExtras')).toBeInTheDocument()
    expect(screen.queryByText('padre.sinExtras')).not.toBeInTheDocument()
    menu.getMenuCategories.mockResolvedValue([{ id: 'c1', name: 'Ropa' }])
    menu.getModifierGroups.mockResolvedValue([])
    for (const b of screen.getAllByRole('button', { name: 'familia.reintentar' })) fireEvent.click(b)
    expect(await screen.findByText('padre.sinExtras')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('padre.errorCategorias')).not.toBeInTheDocument())
    expect(screen.getByLabelText('wizard.step1.category')).toHaveValue('Ropa')
  })

  it('si la familia ya no existe (404) lo dice y ofrece cerrar, no «Reintentar»', async () => {
    grupos.getProductGroup.mockRejectedValue({ response: { status: 404, data: { message: 'Ese producto con variantes no existe en esta sucursal.' } } })
    pintar()
    // useProductGroup reintenta una vez (retry: 1, ~1 s) antes de dar el error.
    expect(await screen.findByText('familia.noExiste', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'familia.cerrar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'familia.reintentar' })).not.toBeInTheDocument()
  })

  it('🔴 Codex C1: si falla la recarga, los editores siguen montados con lo tecleado y arriba se ofrece reintentar', async () => {
    const { qc } = pintar()
    fireEvent.change(await screen.findByLabelText('padre.nombre'), { target: { value: 'Playera básica' } })
    fireEvent.change(screen.getByLabelText('variantesTabla.precio'), { target: { value: '249' } })
    grupos.getProductGroup.mockRejectedValue({ response: { status: 500, data: { message: 'Algo falló en el servidor.' } } })
    await act(() => qc.invalidateQueries({ queryKey: ['products', 'v1', 'groups'] }))
    // useProductGroup reintenta una vez (~1 s) antes de dar el error.
    expect(await screen.findByText('familia.errorAlReleer', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByText('Algo falló en el servidor.')).toBeInTheDocument()
    expect(screen.getByLabelText('padre.nombre')).toHaveValue('Playera básica')
    expect(screen.getByLabelText('variantesTabla.precio')).toHaveValue(249)

    grupos.getProductGroup.mockResolvedValue(familia)
    fireEvent.click(screen.getByRole('button', { name: 'familia.reintentar' }))
    await waitFor(() => expect(screen.queryByText('familia.errorAlReleer')).not.toBeInTheDocument())
    expect(screen.getByLabelText('padre.nombre')).toHaveValue('Playera básica')
    expect(screen.getByLabelText('variantesTabla.precio')).toHaveValue(249)
  }, 10_000)

  it('🔴 QA BAJO-2: archivada abierta por enlace: «Archivada · N», sin botones de guardar ni tabla vacía, y sus archivadas a la vista', async () => {
    grupos.getProductGroup.mockResolvedValue({ ...familia, variants: [], archivedCount: 2, archived: true, archivedAt: '2026-10-14T00:00:00.000Z' })
    grupos.getArchivedVariants.mockResolvedValue({
      items: [
        { id: 'p1', name: 'Short · S', sku: 'SH-S', archivedAt: '2026-10-14T00:00:00.000Z' },
        { id: 'p2', name: 'Short · M', sku: 'SH-M', archivedAt: '2026-10-14T00:00:00.000Z' },
      ],
      total: 2,
      page: 1,
      pageSize: 25,
    })
    pintar()
    expect(await screen.findByText('familia.subtituloArchivada')).toBeInTheDocument()
    expect(screen.queryByText('familia.subtitulo')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'padre.guardar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'padre.descartar' })).not.toBeInTheDocument()
    expect(screen.queryByText('padre.ayuda')).not.toBeInTheDocument()
    expect(screen.queryByText('variantesTabla.titulo')).not.toBeInTheDocument()
    expect(await screen.findByText('Short · S')).toBeInTheDocument()
    expect(screen.getByText('Short · M')).toBeInTheDocument()
  })

  it('🔴 QA BAJO-1: el título se recorta con «…» dentro del espacio libre y «Más acciones» es sólo ícono en un celular', async () => {
    pintar()
    const titulo = await screen.findByRole('heading', { name: 'Playera' })
    expect(titulo.parentElement).toHaveClass('max-w-[calc(100%-9rem)]', '*:truncate', 'sm:max-w-[calc(100%-22rem)]')
    const mas = screen.getByRole('button', { name: 'accionesFamilia.mas' })
    expect(mas.querySelector('span')).toHaveClass('hidden', 'sm:inline')
  })

  it('🔴 con algo sin guardar (padre, tabla o «Agregar variantes») Esc no cierra y la X pregunta; sin nada, cierra de una', async () => {
    const onClose = vi.fn()
    const cerrarConX = () => fireEvent.click(screen.getByTestId('cerrar-familia'))
    pintar('g1', onClose)
    const nombre = await screen.findByLabelText('padre.nombre')

    // 1. Datos del padre: Esc no hace nada; la X pregunta y «Seguir editando» conserva lo tecleado.
    fireEvent.change(nombre, { target: { value: 'Playera básica' } })
    fireEvent.keyDown(nombre, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    cerrarConX()
    fireEvent.click(await screen.findByRole('button', { name: 'agrupar.descartar.seguir' }))
    await waitFor(() => expect(screen.queryByText('agrupar.descartar.titulo')).not.toBeInTheDocument())
    expect(screen.getByLabelText('padre.nombre')).toHaveValue('Playera básica')
    fireEvent.click(screen.getByRole('button', { name: 'padre.descartar' }))
    await waitFor(() => expect(screen.getByLabelText('padre.nombre')).toHaveValue('Playera'))

    // 2. Tabla de variantes.
    fireEvent.change(screen.getByLabelText('variantesTabla.precio'), { target: { value: '249' } })
    cerrarConX()
    expect(await screen.findByText('agrupar.descartar.titulo')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'agrupar.descartar.seguir' }))
    await waitFor(() => expect(screen.queryByText('agrupar.descartar.titulo')).not.toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('variantesTabla.precio'), { target: { value: '199' } }) // igual que antes: ya no hay cambio

    // 3. «Agregar variantes»: un valor nuevo tecleado.
    const valores = screen.getByLabelText('crecer.valoresNuevos')
    fireEvent.change(valores, { target: { value: 'XL' } })
    fireEvent.keyDown(valores, { key: 'Enter' })
    fireEvent.keyDown(screen.getByLabelText('padre.nombre'), { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    cerrarConX()
    fireEvent.click(await screen.findByRole('button', { name: 'agrupar.descartar.si' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('🔴 ronda 2: «XL» escrito sin Enter en «Agregar variantes»: Esc no cierra (Radix lo oye antes de que el campo lo confirme)', async () => {
    const onClose = vi.fn()
    pintar('g1', onClose)
    const valores = await screen.findByLabelText('crecer.valoresNuevos')
    fireEvent.change(valores, { target: { value: 'XL' } })
    fireEvent.keyDown(valores, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(valores).toHaveValue('XL')
    // control: el nombre del padre siempre trae texto y ahí, sin cambios, Esc sí cierra
    fireEvent.change(valores, { target: { value: '' } })
    fireEvent.keyDown(screen.getByLabelText('padre.nombre'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('🔴 ronda 2: un renombre a medias con el lápiz («S» → «Chica» sin ✓) hace que la X pregunte; abrirlo sin cambiar el texto, no', async () => {
    const onClose = vi.fn()
    pintar('g1', onClose)
    fireEvent.click((await screen.findAllByRole('button', { name: 'valores.renombrar' }))[0])
    fireEvent.click(screen.getByTestId('cerrar-familia'))
    expect(onClose).toHaveBeenCalledTimes(1) // el lápiz abierto con el mismo texto no es un cambio

    fireEvent.change(screen.getByRole('textbox', { name: 'valores.renombrar' }), { target: { value: 'Chica' } })
    fireEvent.click(screen.getByTestId('cerrar-familia'))
    expect(await screen.findByText('agrupar.descartar.titulo')).toBeInTheDocument()
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'agrupar.descartar.seguir' }))
    await waitFor(() => expect(screen.queryByText('agrupar.descartar.titulo')).not.toBeInTheDocument())
    expect(screen.getByRole('textbox', { name: 'valores.renombrar' })).toHaveValue('Chica')
  })

  it('sin nada tecleado, Esc y la X cierran sin preguntar', async () => {
    const onClose = vi.fn()
    pintar('g1', onClose)
    fireEvent.keyDown(await screen.findByLabelText('padre.nombre'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('cerrar-familia'))
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('agrupar.descartar.titulo')).not.toBeInTheDocument()
  })
})
