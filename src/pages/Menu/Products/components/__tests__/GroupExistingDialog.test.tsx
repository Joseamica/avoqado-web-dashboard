/**
 * Variantes de producto, bloque 2 (Tarea 10): agrupar «Tenis - Talla 26» y «Tenis - Talla 27» como variantes de «Tenis».
 * 🔴 La huella (Review Focus 3): «Confirmar» manda EXACTAMENTE el body de la vista previa + su huella; cualquier cambio posterior apaga
 * «Confirmar» hasta volver a «Ver cambios»; un 409 PRODUCT_GROUP_PREVIEW_STALE vuelve a pedir la vista previa con lo tecleado AHORA.
 * `t` pega los valores con «:» (`agrupar.valorDe:Talla:Tenis - Talla 26`). vitest corre con mockReset: respuestas en beforeEach.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const grupos = vi.hoisted(() => ({ previewGroupExisting: vi.fn(), applyGroupExisting: vi.fn() }))
const menu = vi.hoisted(() => ({ getMenuCategories: vi.fn(), getModifierGroups: vi.fn() }))
const avisos = vi.hoisted(() => ({ toast: vi.fn() }))
const estables = vi.hoisted(() => ({
  i18n: {
    t: (k: string, o?: Record<string, unknown>) =>
      [k, ...Object.entries(o ?? {}).flatMap(([c, v]) => (c === 'defaultValue' ? [] : [String(v)]))].join(':'),
    i18n: { language: 'es' },
  },
}))
vi.mock('@/services/productGroups.service', () => grupos)
vi.mock('@/services/menu.service', async o => ({ ...(await o<object>()), ...menu }))
vi.mock('@/hooks/use-print-stations', () => ({ usePrintStations: () => ({ data: [], isLoading: false }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: avisos.toast }) }))
vi.mock('@/features/master-catalog/use-master-catalog-error', () => ({ useMasterCatalogError: () => () => false }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', venue: { id: 'v1', organizationId: 'o1' } }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => estables.i18n }))

import { GroupExistingDialog } from '../GroupExistingDialog'
import type { EstadoAgrupar } from '@/features/product-variants/groupExisting'

const inicial: EstadoAgrupar = {
  name: 'Tenis',
  optionNames: ['Talla'],
  members: [
    { productId: 'p1', name: 'Tenis - Talla 26', sku: 'T26', values: ['26'] },
    { productId: 'p2', name: 'Tenis - Talla 27', values: ['27'] },
  ],
}
const cuerpo = (name = 'Tenis', v2 = '27') => ({
  name,
  options: [{ name: 'Talla', values: ['26', v2] }],
  members: [
    { productId: 'p1', values: ['26'] },
    { productId: 'p2', values: [v2] },
  ],
})
const vistaPrevia = (fingerprint = 'huella-1') => ({
  parent: {
    name: 'Tenis', categoryId: 'c1', type: 'REGULAR', ivaTratamiento: 'IVA_16', description: null, imageUrl: null, printStationId: null,
    satProductKey: null, satUnitKey: null, modifierGroupIds: [],
  },
  options: [{ name: 'Talla', values: ['26', '27'] }],
  members: [
    { productId: 'p1', sku: 'T26', currentName: 'Tenis - Talla 26', newName: 'Tenis · 26', values: ['26'], changes: ['Nombre: «Tenis - Talla 26» → «Tenis · 26»'] },
    { productId: 'p2', sku: 'T27', currentName: 'Tenis - Talla 27', newName: 'Tenis · 27', values: ['27'], changes: [] },
  ],
  warnings: ['Cambia el IVA de 1 producto(s).'],
  fingerprint,
  firstMemberIva: 'IVA_16',
})
const stale = { response: { status: 409, data: { code: 'PRODUCT_GROUP_PREVIEW_STALE', message: 'Los productos cambiaron desde la vista previa.' } } }

function pintar(estado: EstadoAgrupar = inicial) {
  const onDone = vi.fn()
  const onClose = vi.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidar = vi.spyOn(qc, 'invalidateQueries')
  render(
    <QueryClientProvider client={qc}>
      <GroupExistingDialog open onClose={onClose} venueId="v1" inicial={estado} onDone={onDone} />
    </QueryClientProvider>,
  )
  return { onDone, onClose, invalidar }
}
const LISTA = { queryKey: ['products', 'v1'] }
const verCambios = () => screen.getByRole('button', { name: 'agrupar.verCambios' })
const confirmar = () => screen.getByRole('button', { name: 'agrupar.confirmar' })
const valor = (option: string, name: string) => screen.getByLabelText(`agrupar.valorDe:${option}:${name}`)

beforeEach(() => {
  grupos.previewGroupExisting.mockResolvedValue(vistaPrevia())
  grupos.applyGroupExisting.mockResolvedValue({ groupId: 'g9', productIds: ['p1', 'p2'], categoryId: 'c1' })
  menu.getMenuCategories.mockResolvedValue([{ id: 'c1', name: 'Calzado' }])
  menu.getModifierGroups.mockResolvedValue([])
})

describe('GroupExistingDialog', () => {
  it('🔴 «Confirmar» manda EXACTAMENTE el body de la vista previa más su huella', async () => {
    const { onDone, invalidar } = pintar()
    expect(confirmar()).toBeDisabled()
    fireEvent.click(verCambios())
    await waitFor(() => expect(grupos.previewGroupExisting).toHaveBeenCalledWith('v1', cuerpo()))
    await waitFor(() => expect(confirmar()).toBeEnabled())
    fireEvent.click(confirmar())
    await waitFor(() => expect(grupos.applyGroupExisting).toHaveBeenCalledWith('v1', cuerpo(), 'huella-1'))
    expect(grupos.applyGroupExisting.mock.calls[0][1]).toEqual(grupos.previewGroupExisting.mock.calls[0][1])
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('g9'))
    expect(invalidar).toHaveBeenCalledWith(LISTA)
    expect(avisos.toast).toHaveBeenCalledWith({ title: 'agrupar.listo:2:Tenis' })
  })

  it('🔴 cambiar un valor después de la vista previa apaga «Confirmar» hasta volver a «Ver cambios»', async () => {
    pintar()
    fireEvent.click(verCambios())
    await waitFor(() => expect(confirmar()).toBeEnabled())
    fireEvent.change(valor('Talla', 'Tenis - Talla 27'), { target: { value: '28' } })
    expect(confirmar()).toBeDisabled()
    expect(screen.getByText('agrupar.desactualizada')).toBeInTheDocument()

    grupos.previewGroupExisting.mockResolvedValue(vistaPrevia('huella-2'))
    fireEvent.click(verCambios())
    await waitFor(() => expect(confirmar()).toBeEnabled())
    expect(grupos.previewGroupExisting).toHaveBeenLastCalledWith('v1', cuerpo('Tenis', '28'))
    expect(screen.queryByText('agrupar.desactualizada')).not.toBeInTheDocument()
    fireEvent.click(confirmar())
    await waitFor(() => expect(grupos.applyGroupExisting).toHaveBeenCalledWith('v1', cuerpo('Tenis', '28'), 'huella-2'))
  })

  it('🔴 un 409 de vista previa vencida vuelve a pedirla con lo que se confirmó, no borra nada y deja seguir editando', async () => {
    let rechazar: (e: unknown) => void = () => {}
    grupos.applyGroupExisting.mockReturnValueOnce(new Promise((_, r) => (rechazar = r)))
    const { invalidar } = pintar()
    fireEvent.change(screen.getByLabelText('agrupar.nombre'), { target: { value: 'Tenis Pro' } })
    fireEvent.click(verCambios())
    await waitFor(() => expect(confirmar()).toBeEnabled())
    fireEvent.click(confirmar())
    await waitFor(() => expect(grupos.applyGroupExisting).toHaveBeenCalledTimes(1))
    grupos.previewGroupExisting.mockResolvedValue(vistaPrevia('huella-2'))
    expect(invalidar).not.toHaveBeenCalled()
    await act(async () => rechazar(stale))

    await waitFor(() => expect(grupos.previewGroupExisting).toHaveBeenCalledTimes(2))
    expect(invalidar).toHaveBeenCalledWith(LISTA) // el reintento automático de api.ts pudo haber aplicado el primer intento
    expect(grupos.previewGroupExisting).toHaveBeenLastCalledWith('v1', cuerpo('Tenis Pro'))
    expect(screen.getByLabelText('agrupar.nombre')).toHaveValue('Tenis Pro')
    expect(screen.getByLabelText('agrupar.nombre')).toBeEnabled() // ya no se está aplicando: se puede corregir
    expect(valor('Talla', 'Tenis - Talla 27')).toHaveValue('27')
    expect(screen.getByText('agrupar.stale')).toBeInTheDocument()
    expect(avisos.toast).not.toHaveBeenCalled()
    await waitFor(() => expect(confirmar()).toBeEnabled())
    fireEvent.click(confirmar())
    await waitFor(() => expect(grupos.applyGroupExisting).toHaveBeenLastCalledWith('v1', cuerpo('Tenis Pro'), 'huella-2'))
  })

  it('🔴 Codex C5: mientras se aplica, nada se edita (el éxito cierra y se perdería lo tecleado); en la vista previa sí', async () => {
    let resolver: (r: unknown) => void = () => {}
    grupos.applyGroupExisting.mockReturnValueOnce(new Promise(r => (resolver = r)))
    let previa: (r: unknown) => void = () => {}
    grupos.previewGroupExisting.mockReturnValueOnce(new Promise(r => (previa = r)))
    const { onDone } = pintar()
    fireEvent.click(verCambios())
    await waitFor(() => expect(grupos.previewGroupExisting).toHaveBeenCalledTimes(1))
    expect(screen.getByLabelText('agrupar.nombre')).toBeEnabled() // pidiendo la vista previa todavía se edita (como hoy)
    await act(async () => previa(vistaPrevia()))
    await waitFor(() => expect(confirmar()).toBeEnabled())
    fireEvent.click(confirmar())
    await waitFor(() => expect(grupos.applyGroupExisting).toHaveBeenCalledTimes(1))

    expect(screen.getByLabelText('agrupar.nombre')).toBeDisabled()
    expect(screen.getByLabelText('agrupar.categoria')).toBeDisabled()
    expect(screen.getByLabelText('agrupar.opcion:1')).toBeDisabled()
    expect(valor('Talla', 'Tenis - Talla 27')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'agrupar.agregarOpcion' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'agrupar.quitarProducto:Tenis - Talla 26' })).toBeDisabled()
    await act(async () => resolver({ groupId: 'g9', productIds: ['p1', 'p2'], categoryId: 'c1' }))
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('g9'))
  })

  it('un problema local (falta un valor) no llama al server y dice cuál', async () => {
    pintar({ ...inicial, members: [inicial.members[0], { ...inicial.members[1], values: [''] }] })
    fireEvent.click(verCambios())
    expect(await screen.findByText('agrupar.problema.valorVacio:Tenis - Talla 27')).toBeInTheDocument()
    expect(grupos.previewGroupExisting).not.toHaveBeenCalled()
  })

  it('dos clics a «Confirmar» en el mismo instante = una sola llamada', async () => {
    grupos.applyGroupExisting.mockReturnValue(new Promise(() => {}))
    pintar()
    fireEvent.click(verCambios())
    await waitFor(() => expect(confirmar()).toBeEnabled())
    const b = confirmar()
    act(() => {
      b.click()
      b.click()
    })
    await waitFor(() => expect(confirmar()).toBeDisabled())
    expect(grupos.applyGroupExisting).toHaveBeenCalledTimes(1)
  })

  it('🔴 con algo tecleado Esc no cierra y la X pregunta: «Seguir editando» conserva, «Descartar» cierra', async () => {
    const { onClose } = pintar()
    const nombre = screen.getByLabelText('agrupar.nombre')
    fireEvent.change(nombre, { target: { value: 'Tenis Pro' } })
    fireEvent.keyDown(nombre, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.queryByText('agrupar.descartar.titulo')).not.toBeInTheDocument() // Esc no hace nada; sólo la X pregunta

    fireEvent.click(screen.getByTestId('cerrar-agrupar'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'agrupar.descartar.seguir' }))
    await waitFor(() => expect(screen.queryByText('agrupar.descartar.titulo')).not.toBeInTheDocument())
    expect(screen.getByLabelText('agrupar.nombre')).toHaveValue('Tenis Pro')
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('cerrar-agrupar'))
    fireEvent.click(await screen.findByRole('button', { name: 'agrupar.descartar.si' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('sin nada tecleado Esc cierra de una; con un envío en curso, no', async () => {
    const primero = pintar()
    fireEvent.keyDown(screen.getByLabelText('agrupar.nombre'), { key: 'Escape' }) // control: la prueba sí ve un cierre por Esc
    expect(primero.onClose).toHaveBeenCalledTimes(1)
    cleanup()

    grupos.applyGroupExisting.mockReturnValue(new Promise(() => {}))
    const { onClose } = pintar()
    fireEvent.click(verCambios())
    await waitFor(() => expect(confirmar()).toBeEnabled())
    fireEvent.click(confirmar())
    await waitFor(() => expect(confirmar()).toBeDisabled())
    fireEvent.keyDown(screen.getByLabelText('agrupar.nombre'), { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.queryByText('agrupar.descartar.titulo')).not.toBeInTheDocument()
  })

  it('la categoría se busca como en el editor de familia: si la lista falla se reintenta, y «La del primer producto» la quita', async () => {
    menu.getMenuCategories.mockRejectedValueOnce(new Error('sin red')).mockResolvedValue([{ id: 'c1', name: 'Calzado' }, { id: 'c2', name: 'Ropa' }])
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: 'familia.reintentar' }))
    const categoria = await screen.findByLabelText('agrupar.categoria')
    expect(screen.queryByText('agrupar.errorCategorias')).not.toBeInTheDocument()
    expect(categoria).toHaveAttribute('placeholder', 'agrupar.categoriaPrimera')

    fireEvent.click(categoria)
    fireEvent.click(await screen.findByRole('option', { name: 'Calzado' }))
    expect(screen.getByLabelText('agrupar.categoria')).toHaveValue('Calzado')
    fireEvent.click(verCambios())
    await waitFor(() => expect(grupos.previewGroupExisting).toHaveBeenLastCalledWith('v1', { ...cuerpo(), categoryId: 'c1' }))

    fireEvent.click(screen.getByLabelText('agrupar.categoria'))
    fireEvent.click(await screen.findByRole('option', { name: 'agrupar.categoriaPrimera' }))
    expect(screen.getByLabelText('agrupar.categoria')).toHaveValue('')
    await waitFor(() => expect(verCambios()).toBeEnabled())
    fireEvent.click(verCambios())
    await waitFor(() => expect(grupos.previewGroupExisting).toHaveBeenLastCalledWith('v1', cuerpo()))
  })

  it('la vista previa resume el producto padre con nombres legibles (la categoría por su nombre, no su id)', async () => {
    pintar()
    fireEvent.click(verCambios())
    const categoria = (await screen.findByText('agrupar.resumen.categoria')).parentElement!
    await waitFor(() => expect(within(categoria).getByText('Calzado')).toBeInTheDocument())
    expect(categoria).not.toHaveTextContent('c1')
    expect(within(screen.getByText('agrupar.resumen.iva').parentElement!).getByText('menu:iva.opciones.IVA_16')).toBeInTheDocument()
    expect(screen.getByText('Cambia el IVA de 1 producto(s).')).toBeInTheDocument()
    expect(screen.getByText('Nombre: «Tenis - Talla 26» → «Tenis · 26»')).toBeInTheDocument()
  })
})
