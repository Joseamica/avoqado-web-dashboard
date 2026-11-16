import type { ComponentProps } from 'react'

import i18n from '@/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// «Este extra es un platillo del menú» (encargo 27771e; founder 16-nov: como Fudo y Toast, Premium).
// Los mocks son funciones planas (la config de vitest tiene `mockReset: true`); lo capturado vive en `state`.
const state = vi.hoisted(() => ({
  updateCalls: [] as unknown[][],
  searchCalls: [] as unknown[][],
  gated: false,
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
          linkable: false,
          blockedReason: 'NOT_INVENTORIED',
        },
      ],
      total: 2,
      hasMore: false,
      nextCursor: null,
    })
  },
}))
vi.mock('@/services/inventory.service', () => ({
  rawMaterialsApi: { getAll: () => Promise.resolve({ data: { data: [] } }) },
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))
// El candado de plan real necesita el enrutador y la sesión: aquí se simula con o sin Premium.
vi.mock('@/components/billing/FeatureGate', () => ({
  FeatureGate: ({ children }: { children: React.ReactNode }) =>
    state.gated ? <div data-testid="candado-premium">Premium</div> : <>{children}</>,
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

  it('prender, buscar en el servidor y elegir un platillo lo manda; uno sin inventario sale en gris con su razón', async () => {
    const user = userEvent.setup()
    renderEdit(BASE)
    await user.click(screen.getByRole('switch', { name: 'Este extra es un platillo del menú' }))
    expect(await screen.findByText('Mostrando 2 de 2')).toBeInTheDocument()
    const agua = screen.getByRole('button', { name: /Agua/ })
    expect(agua).toBeDisabled()
    expect(screen.getByText(/No lleva inventario: actívaselo en su ficha/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Papas a la francesa/ }))
    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }))
    await waitFor(() => expect(state.updateCalls).toHaveLength(1))
    expect(state.updateCalls[0][3]).toHaveProperty('linkedProductId', 'p-papas')
    // El ingrediente queda apagado: un extra descuenta un ingrediente O un platillo.
    expect(state.updateCalls[0][3]).toHaveProperty('rawMaterialId', null)
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

  it('sin Premium, al prenderlo sale el candado en vez del buscador; uno ya ligado se ve y se puede quitar', async () => {
    const user = userEvent.setup()
    state.gated = true
    const { unmount } = renderEdit(BASE)
    await user.click(screen.getByRole('switch', { name: 'Este extra es un platillo del menú' }))
    expect(screen.getByTestId('candado-premium')).toBeInTheDocument()
    expect(screen.queryByLabelText('Buscar platillo…')).not.toBeInTheDocument()
    unmount()

    renderEdit(LIGADO)
    expect(screen.getByText('Papas a la francesa')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar platillo' })).toBeInTheDocument()
  })

  it('si al platillo ligado le apagaron el inventario, lo avisa', () => {
    renderEdit({ ...LIGADO, linkedProduct: { ...LIGADO.linkedProduct, trackInventory: false, inventoryMethod: null } })
    expect(screen.getByRole('status')).toHaveTextContent('ya no lleva inventario')
  })
})
