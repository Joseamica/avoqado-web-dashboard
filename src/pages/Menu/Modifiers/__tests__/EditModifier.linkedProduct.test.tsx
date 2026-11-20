import type { ComponentProps } from 'react'

import i18n from '@/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// «Este extra es un platillo del menú» (encargo 27771e; founder 16-nov: como Fudo y Toast). Desde el 20-nov (founder «B» y «A»,
// Flautas): un platillo sin inventario también se liga (sólo cuenta en «Dentro de paquete») y el plan es Pro y Premium.
// Los mocks son funciones planas (la config de vitest tiene `mockReset: true`); lo capturado vive en `state`.
const state = vi.hoisted(() => ({
  updateCalls: [] as unknown[][],
  searchCalls: [] as unknown[][],
  gated: false,
  gateFeatures: [] as string[],
}))

vi.mock('@/services/menu.service', () => ({
  updateModifier: (...args: unknown[]) => {
    state.updateCalls.push(args)
    return Promise.resolve({ id: 'mod-1' })
  },
  searchLinkableProducts: (...args: unknown[]) => {
    state.searchCalls.push(args)
    return Promise.resolve({
      data: [
        {
          id: 'p-papas',
          name: 'Papas a la francesa',
          active: true,
          categoryName: 'Acompañantes',
          inventoryMethod: 'QUANTITY',
          linkable: true,
          blockedReason: null,
        },
        {
          id: 'p-agua',
          name: 'Agua',
          active: true,
          categoryName: 'Bebidas',
          inventoryMethod: null,
          linkable: true,
          blockedReason: null,
        },
        {
          id: 'p-queso',
          name: 'Queso a granel',
          active: true,
          categoryName: 'Cremería',
          inventoryMethod: 'QUANTITY',
          linkable: false,
          blockedReason: 'SOLD_BY_WEIGHT',
        },
      ],
      total: 3,
      hasMore: false,
      nextCursor: null,
    })
  },
}))
vi.mock('@/services/inventory.service', () => ({
  rawMaterialsApi: { getAll: () => Promise.resolve({ data: { data: [] } }) },
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))
// El candado de plan real necesita el enrutador y la sesión: aquí se simula con o sin el plan, y se anota qué función pidió.
vi.mock('@/components/billing/FeatureGate', () => ({
  FeatureGate: ({ children, feature }: { children: React.ReactNode; feature: string }) => {
    state.gateFeatures.push(feature)
    return state.gated ? <div data-testid="candado-plan">Plan</div> : <>{children}</>
  },
}))

import EditModifier from '../EditModifier'

const BASE = { name: 'Papas', price: 25, active: true, sku: null }
const LIGADO = {
  ...BASE,
  linkedProductId: 'p-papas',
  linkedProduct: {
    id: 'p-papas',
    name: 'Papas a la francesa',
    trackInventory: true,
    inventoryMethod: 'QUANTITY' as const,
    soldByWeight: false,
  },
}

function renderEdit(initialValues: ComponentProps<typeof EditModifier>['initialValues']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <EditModifier
        venueId="venue-1"
        modifierId="mod-1"
        modifierGroupId="group-1"
        onBack={() => {}}
        onSuccess={() => {}}
        initialValues={initialValues}
      />
    </QueryClientProvider>,
  )
}

describe('EditModifier — extra ligado a un platillo del menú', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('es')
  })
  beforeEach(() => {
    state.updateCalls.length = 0
    state.searchCalls.length = 0
    state.gated = false
    state.gateFeatures.length = 0
  })

  it('un extra ya ligado enseña su platillo y cómo descuenta', () => {
    renderEdit(LIGADO)
    expect(screen.getByRole('switch', { name: 'Este extra es un platillo del menú' })).toBeChecked()
    expect(screen.getByText('Papas a la francesa')).toBeInTheDocument()
    expect(screen.getByText('Por piezas')).toBeInTheDocument()
  })

  it('cambiar sólo el precio NO manda el ligado (no pide Premium otra vez)', async () => {
    const user = userEvent.setup()
    renderEdit(LIGADO)
    const precio = screen.getByLabelText('Precio')
    await user.clear(precio)
    await user.type(precio, '30')
    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }))
    await waitFor(() => expect(state.updateCalls).toHaveLength(1))
    expect(state.updateCalls[0][3]).not.toHaveProperty('linkedProductId')
  })

  it('quitar el platillo y apagar manda `linkedProductId: null`', async () => {
    const user = userEvent.setup()
    renderEdit(LIGADO)
    await user.click(screen.getByRole('switch', { name: 'Este extra es un platillo del menú' }))
    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }))
    await waitFor(() => expect(state.updateCalls).toHaveLength(1))
    expect(state.updateCalls[0][3]).toHaveProperty('linkedProductId', null)
  })

  it('prender, buscar en el servidor y elegir un platillo lo manda; uno por kilo sale en gris con su razón', async () => {
    const user = userEvent.setup()
    renderEdit(BASE)
    await user.click(screen.getByRole('switch', { name: 'Este extra es un platillo del menú' }))
    expect(await screen.findByText('Mostrando 3 de 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Queso a granel/ })).toBeDisabled()
    expect(screen.getByText(/Se vende por kilo/)).toBeInTheDocument()
    // Sin inventario ya NO sale en gris: se puede ligar y dice que sólo cuenta en el reporte.
    expect(screen.getByRole('button', { name: /Agua/ })).toBeEnabled()
    expect(screen.getByText('Sin inventario: sólo cuenta en el reporte')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Papas a la francesa/ }))
    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }))
    await waitFor(() => expect(state.updateCalls).toHaveLength(1))
    expect(state.updateCalls[0][3]).toHaveProperty('linkedProductId', 'p-papas')
    // El ingrediente queda apagado: un extra descuenta un ingrediente O un platillo.
    expect(state.updateCalls[0][3]).toHaveProperty('rawMaterialId', null)
  })

  it('founder «B» (20-nov): un platillo SIN inventario se liga y avisa que sólo cuenta en «Dentro de paquete»', async () => {
    const user = userEvent.setup()
    renderEdit(BASE)
    await user.click(screen.getByRole('switch', { name: 'Este extra es un platillo del menú' }))
    await user.click(await screen.findByRole('button', { name: /Agua/ }))
    expect(screen.getByRole('status')).toHaveTextContent('no lleva inventario')
    expect(screen.getByRole('status')).toHaveTextContent('Dentro de paquete')
    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }))
    await waitFor(() => expect(state.updateCalls).toHaveLength(1))
    expect(state.updateCalls[0][3]).toHaveProperty('linkedProductId', 'p-agua')
  })

  it('un platillo CON inventario no muestra el aviso de «sólo cuenta»', async () => {
    const user = userEvent.setup()
    renderEdit(BASE)
    await user.click(screen.getByRole('switch', { name: 'Este extra es un platillo del menú' }))
    await user.click(await screen.findByRole('button', { name: /Papas a la francesa/ }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('el buscador conserva el foco y busca en el servidor', async () => {
    const user = userEvent.setup()
    renderEdit(BASE)
    await user.click(screen.getByRole('switch', { name: 'Este extra es un platillo del menú' }))
    const buscador = await screen.findByLabelText('Buscar platillo…')
    await user.type(buscador, 'papa')
    await waitFor(() => expect(state.searchCalls.some(c => (c[1] as { search?: string }).search === 'papa')).toBe(true))
    expect(buscador).toHaveFocus()
    expect(buscador).toHaveValue('papa')
  })

  it('prendido y sin elegir platillo: no guarda y dice qué falta', async () => {
    const user = userEvent.setup()
    renderEdit(BASE)
    await user.click(screen.getByRole('switch', { name: 'Este extra es un platillo del menú' }))
    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }))
    expect(await screen.findByText(/Elige el platillo o apaga/)).toBeInTheDocument()
    expect(state.updateCalls).toHaveLength(0)
  })

  it('prender «Rastrear Inventario» apaga el platillo (son excluyentes)', async () => {
    const user = userEvent.setup()
    renderEdit(LIGADO)
    await user.click(screen.getByRole('switch', { name: 'Rastrear Inventario' }))
    expect(screen.getByRole('switch', { name: 'Este extra es un platillo del menú' })).not.toBeChecked()
  })

  it('sin el plan (Pro y Premium, el del reporte), al prenderlo sale el candado; uno ya ligado se ve y se puede quitar', async () => {
    const user = userEvent.setup()
    state.gated = true
    const { unmount } = renderEdit(BASE)
    await user.click(screen.getByRole('switch', { name: 'Este extra es un platillo del menú' }))
    expect(screen.getByTestId('candado-plan')).toBeInTheDocument()
    // founder «A» (20-nov): el candado es ADVANCED_REPORTS (Pro y Premium), ya no INVENTORY_TRACKING (sólo Premium).
    expect(state.gateFeatures).toContain('ADVANCED_REPORTS')
    expect(state.gateFeatures).not.toContain('INVENTORY_TRACKING')
    expect(screen.queryByLabelText('Buscar platillo…')).not.toBeInTheDocument()
    unmount()

    renderEdit(LIGADO)
    expect(screen.getByText('Papas a la francesa')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar platillo' })).toBeInTheDocument()
  })

  it('si al platillo ligado le apagaron el inventario, lo avisa', () => {
    renderEdit({ ...LIGADO, linkedProduct: { ...LIGADO.linkedProduct, trackInventory: false, inventoryMethod: null } })
    expect(screen.getByRole('status')).toHaveTextContent('no lleva inventario')
  })
})
