/**
 * Variantes de producto, bloque 2 (Tarea 7): crecer una familia y renombrar un valor.
 * - «XL» nuevo + precio con «Aplicar a todas» ⇒ addVariants con newValues y la fila nueva.
 * - Sólo un eje nuevo («Material: Algodón» para todas) ⇒ newOptions y variants: [] (Codex A4).
 * - Crecer pide menu:create (no menu:update) (Codex A5). Dos clics en el mismo instante = una llamada.
 * - El 409 de una combinación archivada se ve tal cual y se relee el catálogo (el reintento de api.ts pudo aplicarlo).
 * Arnés de `ProductGroupDialog.test.tsx` (vi.hoisted + vi.mock; respuestas en beforeEach: vitest corre con mockReset). `t` devuelve la clave.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const grupos = vi.hoisted(() => ({
  getProductGroup: vi.fn(), updateProductGroup: vi.fn(), getArchivedVariants: vi.fn(), listOptionLibrary: vi.fn(),
  addVariants: vi.fn(), renameOptionValue: vi.fn(),
}))
const menu = vi.hoisted(() => ({ updateProduct: vi.fn(), deleteProduct: vi.fn(), getMenuCategories: vi.fn(), getModifierGroups: vi.fn() }))
const acceso = vi.hoisted(() => ({ hasAccess: true, sin: new Set<string>() }))
const avisos = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('@/services/productGroups.service', () => grupos)
vi.mock('@/services/menu.service', async o => ({ ...(await o<object>()), ...menu }))
vi.mock('@/hooks/use-tier-feature-access', () => ({
  useTierFeatureAccess: () => ({ hasAccess: acceso.hasAccess, isResolved: true, requiredTier: 'PRO', isLoading: false }),
}))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => !acceso.sin.has(p) }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: avisos.toast }) }))
vi.mock('@/features/master-catalog/use-master-catalog-error', () => ({ useMasterCatalogError: () => () => false }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('@/components/venue-tier-badge', () => ({ VenueTierBadge: () => <span>PRO</span> }))
vi.mock('@/components/PrintStationField', () => ({ PrintStationField: () => null }))
vi.mock('@/components/SatKeyPicker', () => ({ SatKeyPicker: () => null }))
vi.mock('@/hooks/use-image-uploader', () => ({
  useImageUploader: () => ({
    uploading: false, imageUrl: null, imageForCrop: null, crop: { x: 0, y: 0 }, zoom: 1,
    onCropComplete: () => undefined, handleFileUpload: () => undefined, handleCropConfirm: () => undefined,
    setImageForCrop: () => undefined, setCrop: () => undefined, setZoom: () => undefined,
  }),
}))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', venueSlug: 'mi-tienda', venue: { id: 'v1', organizationId: 'o1' }, fullBasePath: '/venues/mi-tienda' }),
}))

import type { ProductGroupDetail } from '@/types/productGroup'
import { GroupGrowSection, GroupOptionValues } from '../GroupGrowSection'
import { ProductGroupDialog } from '../ProductGroupDialog'

const variante = { id: 'p1', name: 'Playera · S', sku: 'PL-S', gtin: null, price: 199, cost: null, active: true, variantImageUrl: null, values: ['S'], stock: null }
const familia: ProductGroupDetail = {
  id: 'g1', name: 'Playera', description: null, imageUrl: null, categoryId: 'c1', type: 'REGULAR', ivaTratamiento: 'IVA_16',
  satProductKey: null, satUnitKey: null, printStationId: null, source: 'MANUAL', modifierGroupIds: [],
  options: [{ id: 'o1', name: 'Talla', position: 0, values: [{ id: 's', value: 'S', position: 0 }, { id: 'm', value: 'M', position: 1 }] }],
  variants: [variante, { ...variante, id: 'p2', name: 'Playera · M', sku: 'PL-M', values: ['M'] }],
  archivedCount: 0, archived: false, archivedAt: null,
}

function pintar(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidar = vi.spyOn(qc, 'invalidateQueries')
  render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
  return { invalidar }
}
const crecer = (f: ProductGroupDetail = familia, disabled = false) => pintar(<GroupGrowSection venueId="v1" familia={f} disabled={disabled} />)
const escribirValor = (label: string, valor: string) => {
  const input = screen.getByLabelText(label)
  fireEvent.change(input, { target: { value: valor } })
  fireEvent.keyDown(input, { key: 'Enter' })
}
const boton = (name: string) => screen.getByRole('button', { name })

beforeEach(() => {
  acceso.hasAccess = true
  acceso.sin = new Set()
  grupos.getProductGroup.mockResolvedValue(familia)
  grupos.addVariants.mockResolvedValue({ groupId: 'g1', productIds: ['p3'], categoryId: 'c1' })
  grupos.renameOptionValue.mockResolvedValue({ groupId: 'g1', productIds: ['p1'], categoryId: 'c1' })
  menu.getMenuCategories.mockResolvedValue([{ id: 'c1', name: 'Ropa' }])
  menu.getModifierGroups.mockResolvedValue([])
})

describe('GroupGrowSection — agregar valores u opciones', () => {
  it('«XL» nuevo con precio para todas ⇒ addVariants con el valor nuevo y su fila', async () => {
    crecer()
    escribirValor('crecer.valoresNuevos', 'XL')
    fireEvent.change(screen.getByLabelText('tabla.precioTodas'), { target: { value: '199' } })
    fireEvent.click(boton('tabla.aplicarTodas'))
    fireEvent.click(boton('crecer.agregar'))
    await waitFor(() =>
      expect(grupos.addVariants).toHaveBeenCalledWith('v1', 'g1', { newValues: [{ optionName: 'Talla', values: ['XL'] }], variants: [{ values: ['XL'], price: 199 }] }),
    )
    await waitFor(() => expect(avisos.toast).toHaveBeenCalledWith({ title: 'crecer.agregadas' }))
    // Se limpia: el valor tecleado ya no está y no queda tabla de combinaciones.
    await waitFor(() => expect(screen.queryByLabelText('tabla.precioTodas')).not.toBeInTheDocument())
    expect(screen.queryByText('XL')).not.toBeInTheDocument()
  })

  it('sólo un eje nuevo («Material: Algodón» para todas) manda newOptions y variants: []', async () => {
    crecer()
    fireEvent.click(boton('crecer.nuevaOpcion'))
    fireEvent.change(screen.getByLabelText('opciones.nombre'), { target: { value: 'Material' } })
    escribirValor('opciones.valores', 'Algodón')
    fireEvent.click(boton('crecer.agregar'))
    await waitFor(() =>
      expect(grupos.addVariants).toHaveBeenCalledWith('v1', 'g1', {
        newOptions: [{ name: 'Material', values: ['Algodón'], defaultValueForExisting: 'Algodón' }],
        variants: [],
      }),
    )
    await waitFor(() => expect(avisos.toast).toHaveBeenCalledWith({ title: 'crecer.guardado' }))
  })

  it('una fila marcada sin precio no se manda: avisa qué falta', () => {
    crecer()
    escribirValor('crecer.valoresNuevos', 'XL')
    fireEvent.click(boton('crecer.agregar'))
    expect(grupos.addVariants).not.toHaveBeenCalled()
    expect(avisos.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', title: 'validacion.sinPrecio' }))
  })

  it('dos clics en el mismo instante ⇒ una sola llamada', async () => {
    grupos.addVariants.mockReturnValue(new Promise(() => {}))
    crecer()
    fireEvent.click(boton('crecer.nuevaOpcion'))
    fireEvent.change(screen.getByLabelText('opciones.nombre'), { target: { value: 'Material' } })
    escribirValor('opciones.valores', 'Algodón')
    const b = boton('crecer.agregar')
    act(() => {
      b.click() // los dos clics antes de que React vuelva a pintar (el botón todavía no se apaga)
      b.click()
    })
    await waitFor(() => expect(boton('crecer.agregar')).toBeDisabled())
    expect(grupos.addVariants).toHaveBeenCalledTimes(1)
  })

  it('🔴 el 409 de una combinación archivada se ve tal cual y se relee el catálogo', async () => {
    const conColor: ProductGroupDetail = {
      ...familia,
      options: [familia.options[0], { id: 'o2', name: 'Color', position: 1, values: [{ id: 'az', value: 'Azul', position: 0 }] }],
      variants: [{ ...variante, values: ['S', 'Azul'] }],
    }
    const texto = 'La combinación «M · Azul» ya existe, archivada.'
    grupos.addVariants.mockRejectedValue({ response: { status: 409, data: { message: texto } } })
    const { invalidar } = crecer(conColor)
    // Sin nada nuevo no hay tabla ni nada que mandar; la combinación que falta se pide aparte y sale desmarcada.
    expect(screen.queryByLabelText('tabla.incluir')).not.toBeInTheDocument()
    expect(boton('crecer.agregar')).toBeDisabled()
    fireEvent.click(screen.getByRole('switch', { name: 'crecer.verFaltantes' }))
    const incluir = screen.getByLabelText('tabla.incluir')
    expect(incluir).not.toBeChecked()
    fireEvent.click(incluir)
    fireEvent.change(screen.getByLabelText('tabla.precio'), { target: { value: '199' } })
    fireEvent.click(boton('crecer.agregar'))
    await waitFor(() => expect(avisos.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', description: texto })))
    expect(grupos.addVariants).toHaveBeenCalledWith('v1', 'g1', { variants: [{ values: ['M', 'Azul'], price: 199 }] })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['products', 'v1'] })
    expect(boton('crecer.agregar')).not.toBeDisabled() // lo tecleado sigue para corregir
  })

  it('existencias iniciales sólo si la familia lleva inventario', async () => {
    crecer({ ...familia, variants: familia.variants.map(v => ({ ...v, stock: 3 })) })
    escribirValor('crecer.valoresNuevos', 'XL')
    fireEvent.change(screen.getByLabelText('tabla.precio'), { target: { value: '199' } })
    fireEvent.change(screen.getByLabelText('tabla.existencias'), { target: { value: '5' } })
    fireEvent.click(boton('crecer.agregar'))
    await waitFor(() => expect(grupos.addVariants).toHaveBeenCalledWith('v1', 'g1', expect.objectContaining({ variants: [{ values: ['XL'], price: 199, initialStock: 5 }] })))
  })

  it('teclear «s» cuando ya existe «S» no manda nada: el botón queda apagado', () => {
    crecer()
    escribirValor('crecer.valoresNuevos', 's')
    expect(boton('crecer.agregar')).toBeDisabled()
    fireEvent.click(boton('crecer.agregar'))
    expect(grupos.addVariants).not.toHaveBeenCalled()
  })

  it('🔴 familia rala (5×50, 30 vivas) + 7 colores: 35 nuevas marcadas; las 220 viejas que faltan no caben y lo dice', () => {
    const tallas = ['T0', 'T1', 'T2', 'T3', 'T4']
    const rala: ProductGroupDetail = {
      ...familia,
      options: [
        { id: 'o1', name: 'Talla', position: 0, values: tallas.map((value, j) => ({ id: value, value, position: j })) },
        { id: 'o2', name: 'Color', position: 1, values: Array.from({ length: 50 }, (_, j) => ({ id: `C${j}`, value: `C${j}`, position: j })) },
      ],
      variants: Array.from({ length: 30 }, (_, i) => ({ ...variante, id: `p${i}`, values: [`T${i % 5}`, `C${Math.floor(i / 5)}`] })),
    }
    crecer(rala)
    const color = screen.getAllByLabelText('crecer.valoresNuevos')[1]
    fireEvent.change(color, { target: { value: 'N0, N1, N2, N3, N4, N5, N6,' } })
    expect(screen.getAllByLabelText('tabla.incluir')).toHaveLength(35)
    expect(screen.getAllByLabelText('tabla.incluir').every(x => x.getAttribute('data-state') === 'checked')).toBe(true)
    fireEvent.click(screen.getByRole('switch', { name: 'crecer.verFaltantes' }))
    expect(screen.getByText('crecer.faltantesDemasiadas')).toBeInTheDocument()
    expect(screen.getAllByLabelText('tabla.incluir')).toHaveLength(35)
  })

  it('🔴 Codex C2: con inventario MIXTO no se piden existencias iniciales (el server tomaría UNA hermana cualquiera); se dice por qué', async () => {
    crecer({ ...familia, variants: [{ ...variante, stock: 3 }, { ...familia.variants[1], stock: null }] })
    escribirValor('crecer.valoresNuevos', 'XL')
    expect(screen.queryByLabelText('tabla.existencias')).not.toBeInTheDocument()
    expect(screen.getByText('crecer.existenciasDespues')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('tabla.precio'), { target: { value: '199' } })
    fireEvent.click(boton('crecer.agregar'))
    await waitFor(() => expect(grupos.addVariants).toHaveBeenCalledWith('v1', 'g1', expect.objectContaining({ variants: [{ values: ['XL'], price: 199 }] })))
  })

  it('🔴 QA MEDIO-1 (ronda 2): 240 vivas + «XXL» en 12 colores: la tabla se ve, con 12 marcadas no deja agregar; al desmarcar 2, sí', async () => {
    const tallas = Array.from({ length: 20 }, (_, i) => `T${i}`)
    const colores = Array.from({ length: 12 }, (_, i) => `C${i}`)
    const llena: ProductGroupDetail = {
      ...familia,
      options: [
        { id: 'o1', name: 'Talla', position: 0, values: tallas.map((value, j) => ({ id: value, value, position: j })) },
        { id: 'o2', name: 'Color', position: 1, values: colores.map((value, j) => ({ id: value, value, position: j })) },
      ],
      variants: tallas.flatMap((t, i) => colores.map((c, j) => ({ ...variante, id: `p${i}-${j}`, values: [t, c] }))),
    }
    crecer(llena)
    const talla = screen.getAllByLabelText('crecer.valoresNuevos')[0]
    fireEvent.change(talla, { target: { value: 'XXL' } })
    fireEvent.keyDown(talla, { key: 'Enter' })
    const incluir = () => screen.getAllByLabelText('tabla.incluir')
    expect(incluir()).toHaveLength(12)
    expect(screen.getByText('crecer.marcadasDeMas')).toHaveClass('text-destructive')
    fireEvent.change(screen.getByLabelText('tabla.precioTodas'), { target: { value: '199' } })
    fireEvent.click(boton('tabla.aplicarTodas'))
    expect(boton('crecer.agregar')).toBeDisabled()

    fireEvent.click(incluir()[0])
    fireEvent.click(incluir()[1])
    expect(screen.queryByText('crecer.marcadasDeMas')).not.toBeInTheDocument()
    expect(boton('crecer.agregar')).toBeEnabled()
    fireEvent.click(boton('crecer.agregar'))
    await waitFor(() => expect(grupos.addVariants).toHaveBeenCalledTimes(1))
    const body = grupos.addVariants.mock.calls[0][2]
    expect(body.variants).toHaveLength(10)
    expect(body.variants.map((v: { values: string[] }) => v.values[1])).toEqual(colores.slice(2))
  })

  it('sin inventario no se piden existencias', () => {
    crecer()
    escribirValor('crecer.valoresNuevos', 'XL')
    expect(screen.queryByLabelText('tabla.existencias')).not.toBeInTheDocument()
  })
})

describe('GroupOptionValues — renombrar un valor', () => {
  it('Enter confirma ⇒ renameOptionValue; el 409 «Mediana ya existe en Talla» se ve tal cual', async () => {
    grupos.renameOptionValue.mockRejectedValueOnce({ response: { status: 409, data: { message: '«Mediana» ya existe en Talla.' } } })
    pintar(<GroupOptionValues venueId="v1" familia={familia} disabled={false} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'valores.renombrar' })[1])
    const input = screen.getByRole('textbox', { name: 'valores.renombrar' })
    fireEvent.change(input, { target: { value: ' Mediana ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.keyDown(input, { key: 'Enter' }) // segundo Enter mientras guarda: no repite
    await waitFor(() => expect(avisos.toast).toHaveBeenCalledWith(expect.objectContaining({ description: '«Mediana» ya existe en Talla.' })))
    expect(grupos.renameOptionValue).toHaveBeenCalledTimes(1)
    expect(grupos.renameOptionValue).toHaveBeenCalledWith('v1', 'g1', 'm', 'Mediana')
    expect(screen.getByRole('textbox', { name: 'valores.renombrar' })).toHaveValue(' Mediana ') // sigue editando para corregir
  })

  it('Esc cancela sin llamar al server', () => {
    pintar(<GroupOptionValues venueId="v1" familia={familia} disabled={false} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'valores.renombrar' })[0])
    const input = screen.getByRole('textbox', { name: 'valores.renombrar' })
    fireEvent.change(input, { target: { value: 'Chica' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('textbox', { name: 'valores.renombrar' })).not.toBeInTheDocument()
    expect(grupos.renameOptionValue).not.toHaveBeenCalled()
  })
})

describe('permisos en el diálogo', () => {
  const dialogo = (onClose = () => {}) => pintar(<ProductGroupDialog open onClose={onClose} venueId="v1" groupId="g1" />)

  it('🔴 sin menu:update pero con menu:create, crecer sigue habilitado (renombrar no)', async () => {
    acceso.sin = new Set(['menu:update'])
    dialogo()
    expect(await screen.findByLabelText('crecer.valoresNuevos')).not.toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'valores.renombrar' })[0]).toBeDisabled()
  })

  it('sin menu:create, crecer sale deshabilitado', async () => {
    acceso.sin = new Set(['menu:create'])
    dialogo()
    expect(await screen.findByLabelText('crecer.valoresNuevos')).toBeDisabled()
  })

  it('una familia archivada no ofrece agregar variantes', async () => {
    grupos.getProductGroup.mockResolvedValue({ ...familia, archived: true, archivedAt: '2026-10-14T00:00:00.000Z' })
    dialogo()
    expect(await screen.findByText('familia.archivada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'crecer.agregar' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('crecer.valoresNuevos')).not.toBeInTheDocument()
  })

  it('🔴 Esc al renombrar (en el campo o en ✓/✗) cancela el renombre y NO cierra el diálogo; Esc en otro campo sí lo cierra', async () => {
    const onClose = vi.fn()
    dialogo(onClose)
    fireEvent.click((await screen.findAllByRole('button', { name: 'valores.renombrar' }))[0])
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'valores.renombrar' }), { key: 'Escape' })
    expect(screen.queryByRole('textbox', { name: 'valores.renombrar' })).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'valores.renombrar' })[0])
    fireEvent.keyDown(screen.getByRole('button', { name: 'valores.guardar' }), { key: 'Escape' })
    expect(screen.queryByRole('textbox', { name: 'valores.renombrar' })).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    expect(grupos.renameOptionValue).not.toHaveBeenCalled()
    fireEvent.keyDown(screen.getByLabelText('padre.nombre'), { key: 'Escape' }) // control: la prueba sí ve un cierre
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
