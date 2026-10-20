/**
 * Variantes de producto, bloque 2 (Tarea 7): acciones que REDUCEN (sin candado de plan).
 * - Familia: «Deshacer» (menu:update) y «Archivar» (menu:delete), cada una con confirmación; al terminar cierra el diálogo.
 * - Variante: «Separar» (menu:update) y «Archivar» (menu:delete, el DELETE de producto de siempre). Sin «Ajustar existencias» (P15).
 * Arnés de `ProductGroupDialog.test.tsx`. `t` devuelve la clave. El menú de Radix se abre con Enter (jsdom no trae pointer events).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const grupos = vi.hoisted(() => ({ ungroupProductGroup: vi.fn(), archiveProductGroup: vi.fn(), detachVariant: vi.fn(), setVariantImage: vi.fn() }))
const menu = vi.hoisted(() => ({ deleteProduct: vi.fn() }))
const acceso = vi.hoisted(() => ({ hasAccess: true, sin: new Set<string>() }))
const avisos = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('@/services/productGroups.service', () => grupos)
vi.mock('@/services/menu.service', () => menu)
vi.mock('@/hooks/use-tier-feature-access', () => ({
  useTierFeatureAccess: () => ({ hasAccess: acceso.hasAccess, isResolved: true, requiredTier: 'PRO', isLoading: false }),
}))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => !acceso.sin.has(p) }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: avisos.toast }) }))
vi.mock('@/features/master-catalog/use-master-catalog-error', () => ({ useMasterCatalogError: () => () => false }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
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
import { FamilyActions } from '../FamilyActions'
import { VariantRowActions } from '../VariantRowActions'

const variante = { id: 'p1', name: 'Playera · S', sku: 'PL-S', gtin: null, price: 199, cost: null, active: true, variantImageUrl: null, values: ['S'], stock: null }
const familia: ProductGroupDetail = {
  id: 'g1', name: 'Playera', description: null, imageUrl: null, categoryId: 'c1', type: 'REGULAR', ivaTratamiento: 'IVA_16',
  satProductKey: null, satUnitKey: null, printStationId: null, source: 'MANUAL', modifierGroupIds: [],
  options: [{ id: 'o1', name: 'Talla', position: 0, values: [{ id: 's', value: 'S', position: 0 }] }],
  variants: [variante], archivedCount: 0, archived: false, archivedAt: null,
}

function pintar(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}
const abrirMenu = (name: string) => fireEvent.keyDown(screen.getByRole('button', { name }), { key: 'Enter' })
const elegir = (name: string) => fireEvent.click(screen.getByRole('menuitem', { name }))

beforeEach(() => {
  acceso.hasAccess = true
  acceso.sin = new Set()
  const ok = { groupId: 'g1', productIds: ['p1'], categoryId: 'c1' }
  grupos.ungroupProductGroup.mockResolvedValue(ok)
  grupos.archiveProductGroup.mockResolvedValue(ok)
  grupos.detachVariant.mockResolvedValue(ok)
  menu.deleteProduct.mockResolvedValue(undefined)
})

describe('FamilyActions', () => {
  it('«Deshacer» pide confirmación y al confirmar llama ungroupProductGroup y cierra', async () => {
    const onDone = vi.fn()
    pintar(<FamilyActions venueId="v1" familia={familia} onDone={onDone} />)
    abrirMenu('accionesFamilia.mas')
    elegir('accionesFamilia.deshacer')
    expect(await screen.findByText('accionesFamilia.deshacerConfirmar')).toBeInTheDocument()
    expect(grupos.ungroupProductGroup).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'accionesVariante.confirmar' }))
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    expect(grupos.ungroupProductGroup).toHaveBeenCalledWith('v1', 'g1')
    expect(grupos.archiveProductGroup).not.toHaveBeenCalled()
  })

  it('cancelar no llama nada', async () => {
    const onDone = vi.fn()
    pintar(<FamilyActions venueId="v1" familia={familia} onDone={onDone} />)
    abrirMenu('accionesFamilia.mas')
    elegir('accionesFamilia.archivar')
    fireEvent.click(await screen.findByRole('button', { name: 'accionesVariante.cancelar' }))
    await waitFor(() => expect(screen.queryByText('accionesFamilia.archivarConfirmar')).not.toBeInTheDocument())
    expect(grupos.archiveProductGroup).not.toHaveBeenCalled()
    expect(grupos.ungroupProductGroup).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
  })

  it('sin menu:delete no aparece «Archivar»', () => {
    acceso.sin = new Set(['menu:delete'])
    pintar(<FamilyActions venueId="v1" familia={familia} onDone={() => {}} />)
    abrirMenu('accionesFamilia.mas')
    expect(screen.getByRole('menuitem', { name: 'accionesFamilia.deshacer' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'accionesFamilia.archivar' })).not.toBeInTheDocument()
  })

  it('en Gratis se puede deshacer (reducir no lleva candado); un error no cierra el diálogo', async () => {
    acceso.hasAccess = false
    grupos.ungroupProductGroup.mockRejectedValue({ response: { status: 500, data: { message: 'Ocurrió un error inesperado en el servidor.' } } })
    const onDone = vi.fn()
    pintar(<FamilyActions venueId="v1" familia={familia} onDone={onDone} />)
    abrirMenu('accionesFamilia.mas')
    elegir('accionesFamilia.deshacer')
    fireEvent.click(await screen.findByRole('button', { name: 'accionesVariante.confirmar' }))
    await waitFor(() => expect(avisos.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', description: 'Ocurrió un error inesperado en el servidor.' })))
    expect(onDone).not.toHaveBeenCalled()
  })
})

describe('VariantRowActions', () => {
  const fila = () => pintar(<VariantRowActions venueId="v1" familia={familia} variante={variante} disabled={false} />)

  it('«Separar» confirma y llama detachVariant; sin «Ajustar existencias»', async () => {
    fila()
    abrirMenu('accionesVariante.abrir')
    expect(screen.queryByRole('menuitem', { name: /existencias|stock/i })).not.toBeInTheDocument()
    elegir('accionesVariante.separar')
    expect(await screen.findByText('accionesVariante.separarConfirmar')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'accionesVariante.confirmar' }))
    await waitFor(() => expect(grupos.detachVariant).toHaveBeenCalledWith('v1', 'g1', 'p1'))
  })

  it('«Archivar» usa el DELETE de producto de siempre; sin menu:delete no aparece', async () => {
    fila()
    abrirMenu('accionesVariante.abrir')
    elegir('accionesVariante.archivar')
    fireEvent.click(await screen.findByRole('button', { name: 'accionesVariante.confirmar' }))
    await waitFor(() => expect(menu.deleteProduct).toHaveBeenCalledWith('v1', 'p1'))
  })

  it('sin menu:delete no aparece «Archivar»; en Gratis la foto se apaga pero separar sigue', () => {
    acceso.sin = new Set(['menu:delete'])
    acceso.hasAccess = false
    fila()
    abrirMenu('accionesVariante.abrir')
    expect(screen.queryByRole('menuitem', { name: 'accionesVariante.archivar' })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'accionesVariante.foto' })).toHaveAttribute('data-disabled')
    expect(screen.getByRole('menuitem', { name: 'accionesVariante.separar' })).not.toHaveAttribute('data-disabled')
  })
})
