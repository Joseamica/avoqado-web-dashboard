/**
 * Variantes, bloque 5 (V8): lo que el import hizo con las familias se ve al terminar (no sólo «se importó»). `t` pega los valores con «:».
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import en from '@/locales/en/menuImport.json'
import es from '@/locales/es/menuImport.json'

const estables = vi.hoisted(() => ({
  i18n: {
    // El diálogo también llama `t(clave, 'texto por defecto')`: un texto suelto no se pega a la clave.
    t: (k: string, o?: Record<string, unknown> | string) =>
      typeof o === 'object'
        ? [k, ...Object.entries(o).flatMap(([c, v]) => (c === 'defaultValue' ? [] : [String(v)]))].join(':')
        : k,
    i18n: { language: 'es' },
  },
}))
const importar = vi.hoisted(() => ({ previewCSV: vi.fn(), parseRawCSV: vi.fn(), importMenu: vi.fn() }))
const menu = vi.hoisted(() => ({ getMenuCategories: vi.fn(), getProducts: vi.fn(), getModifierGroups: vi.fn() }))
const avisos = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => estables.i18n }))
vi.mock('@/services/menuImport.service', async o => ({ ...(await o<object>()), ...importar }))
vi.mock('@/services/menu.service', async o => ({ ...(await o<object>()), ...menu }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: avisos.toast }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', venue: { id: 'v1', organizationId: 'o1' } }) }))
vi.mock('@/features/master-catalog/use-master-catalog-error', () => ({ useMasterCatalogError: () => () => false }))

import { tieneFamilias } from '@/services/menuImport.service'
import { MenuImportDialog, ResumenDeFamilias } from '../MenuImportDialog'

describe('ResumenDeFamilias', () => {
  it('el resumen del import muestra familias creadas y filas rechazadas', () => {
    const stats = {
      categories: 1,
      products: 4,
      modifierGroups: 0,
      modifiers: 0,
      familiasCreadas: 2,
      tallasEnFamilias: 5,
      filasConFamiliaSinPlan: 0,
      sueltosQueYaExistian: 1,
      variantesDeFamiliaReemplazada: 0,
      filasDeFamiliaRechazadas: {
        total: 60,
        ejemplos: [{ sku: 'P-M', name: 'Playera M', motivo: 'Le falta el valor de «Color».' }],
      },
    }
    expect(tieneFamilias(stats)).toBe(true)
    render(<ResumenDeFamilias stats={stats} />)
    expect(screen.getByText('resumen.familiasCreadas:2')).toBeInTheDocument()
    expect(screen.getByText('resumen.tallasEnFamilias:5')).toBeInTheDocument()
    expect(screen.getByText('resumen.sueltosQueYaExistian:1')).toBeInTheDocument()
    expect(screen.queryByText(/resumen\.filasConFamiliaSinPlan/)).not.toBeInTheDocument()
    expect(screen.getByText('resumen.rechazadas:60')).toBeInTheDocument()
    expect(screen.getByText('P-M · Playera M')).toBeInTheDocument()
    expect(screen.getByText('Le falta el valor de «Color».')).toBeInTheDocument()
    // el server manda hasta 50 ejemplos: lo que no vino se dice, no se esconde
    expect(screen.getByText('resumen.rechazadasOcultas:59')).toBeInTheDocument()
  })

  it('un import sin familias no cambia: no hay resumen que mostrar', () => {
    expect(tieneFamilias({ categories: 1, products: 2, modifierGroups: 0, modifiers: 0 })).toBe(false)
    expect(tieneFamilias(undefined)).toBe(false)
  })

  it('es y en tienen los mismos textos del resumen y de los campos nuevos', () => {
    expect(Object.keys(en.resumen).sort()).toEqual(Object.keys(es.resumen).sort())
    for (const k of ['family', 'option1Name', 'option1Value', 'option2Name', 'option2Value', 'option3Name', 'option3Value'] as const) {
      expect(es.mapping.fields[k].label).toBeTruthy()
      expect(en.mapping.fields[k].label).toBeTruthy()
    }
  })
})

describe('MenuImportDialog — familias de punta a punta', () => {
  const HEADERS = ['name', 'sku', 'price', 'category', 'Familia', 'Opción 1', 'Valor 1']
  const filas = [
    { name: 'Playera S', sku: 'P-S', price: '199', category: 'Ropa', Familia: 'Playera', 'Opción 1': 'Talla', 'Valor 1': 'S' },
    { name: 'Playera M', sku: 'P-M', price: '199', category: 'Ropa', Familia: 'Playera', 'Opción 1': 'Talla', 'Valor 1': '' },
  ]
  beforeEach(() => {
    importar.previewCSV.mockResolvedValue({ headers: HEADERS, data: filas })
    importar.parseRawCSV.mockResolvedValue(filas)
    menu.getMenuCategories.mockResolvedValue([])
    menu.getProducts.mockResolvedValue([])
    menu.getModifierGroups.mockResolvedValue([])
  })
  async function hastaVistaPrevia() {
    const onOpenChange = vi.fn()
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MenuImportDialog open onOpenChange={onOpenChange} />
      </QueryClientProvider>,
    )
    fireEvent.change(document.getElementById('csv-upload')!, { target: { files: [new File(['x'], 'menu.csv', { type: 'text/csv' })] } })
    fireEvent.click(await screen.findByRole('button', { name: 'actions.next' }))
    await screen.findByText('validation.valid')
    return { onOpenChange }
  }
  const botonImportar = () => screen.queryByRole('button', { name: 'actions.import' })

  it('«reemplazar» con filas de familia malas (400): lista cada fila con su motivo, quita «Importar» y el diálogo no se cierra', async () => {
    importar.importMenu.mockRejectedValue({
      response: {
        status: 400,
        data: {
          code: 'MENU_IMPORT_FAMILY_ROWS_REJECTED',
          message: 'Algunas filas de familia no se pueden importar; corrígelas y vuelve a intentar. El menú no se reemplazó.',
          details: { filasDeFamiliaRechazadas: { total: 1, ejemplos: [{ sku: 'P-M', name: 'Playera M', motivo: 'Le falta el valor de «Talla».' }] } },
        },
      },
    })
    const { onOpenChange } = await hastaVistaPrevia()
    fireEvent.click(screen.getByRole('switch'))
    fireEvent.click(botonImportar()!)
    expect(await screen.findByText('errors.familyRowsRejected')).toBeInTheDocument()
    expect(screen.getByText('P-M · Playera M: Le falta el valor de «Talla».')).toBeInTheDocument()
    expect(botonImportar()).not.toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
    // viajó en modo reemplazar, con la familia de cada fila (la de valor vacío también: la rechaza el server, no entra suelta)
    const [venueId, categorias, modo] = importar.importMenu.mock.calls[0]
    expect([venueId, modo]).toEqual(['v1', 'replace'])
    expect(categorias[0].products.map((x: { family?: unknown }) => x.family)).toEqual([
      { name: 'Playera', options: [{ name: 'Talla', value: 'S' }] },
      { name: 'Playera', options: [{ name: 'Talla', value: '' }] },
    ])
  })

  it('un import que creó familias se queda abierto con el resumen y «Listo» lo cierra', async () => {
    importar.importMenu.mockResolvedValue({
      success: true,
      message: 'ok',
      stats: { categories: 1, products: 2, modifierGroups: 0, modifiers: 0, familiasCreadas: 1, tallasEnFamilias: 2, filasDeFamiliaRechazadas: { total: 0, ejemplos: [] } },
    })
    const { onOpenChange } = await hastaVistaPrevia()
    fireEvent.click(botonImportar()!)
    expect(await screen.findByText('resumen.familiasCreadas:1')).toBeInTheDocument()
    expect(screen.getByText('resumen.tallasEnFamilias:2')).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'resumen.cerrar' }))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })
})
