import i18n from '@/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Los mocks de módulo son funciones planas y NO `vi.fn()`: la config de vitest tiene
// `mockReset: true`, que borraría la implementación de un `vi.fn()` antes de cada test y
// dejaría el stub inservible. Lo que se captura vive en un arreglo que el test vacía a mano.
const { createCalls } = vi.hoisted(() => ({ createCalls: [] as unknown[][] }))

vi.mock('@/services/menu.service', () => ({
  createModifier: (...args: unknown[]) => {
    createCalls.push(args)
    return Promise.resolve({ id: 'mod-new' })
  },
}))

// CreateModifier sólo lista materias primas con el switch de inventario encendido; aquí está
// apagado, pero el servicio se mockea igual para que ninguna prueba toque la red.
vi.mock('@/services/inventory.service', () => ({
  rawMaterialsApi: { getAll: () => Promise.resolve({ data: { data: [] } }) },
}))

import CreateModifier from '../createModifier'

const VENUE_ID = 'venue-1'
const GROUP_ID = 'group-1'

function renderCreate() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <CreateModifier venueId={VENUE_ID} modifierGroupId={GROUP_ID} onBack={() => {}} onSuccess={() => {}} />
    </QueryClientProvider>,
  )
}

describe('CreateModifier — SKU del extra (el código del OTRO POS, que sale impreso en el vale)', () => {
  // El público real es México: se fija el idioma para verificar el texto que el cliente
  // lee de verdad, no la detección de locale del entorno de pruebas.
  beforeAll(async () => {
    await i18n.changeLanguage('es')
  })

  beforeEach(() => {
    createCalls.length = 0
  })

  it('un SKU escrito con espacios llega recortado al servicio', async () => {
    const user = userEvent.setup()
    renderCreate()

    await user.type(screen.getByPlaceholderText('Ej: Sin sal, Con queso extra...'), 'Shot de espresso')
    await user.type(screen.getByLabelText('SKU'), '  P000672 ')
    await user.click(screen.getByRole('button', { name: 'Crear Modificador' }))

    await waitFor(() => expect(createCalls).toHaveLength(1))
    const [venueId, groupId, payload] = createCalls[0]
    expect([venueId, groupId]).toEqual([VENUE_ID, GROUP_ID])
    expect(payload).toMatchObject({ name: 'Shot de espresso' })
    expect(payload).toHaveProperty('sku', 'P000672')
  })

  it('con el SKU vacío no manda la llave `sku` — al crear no hay nada que borrar', async () => {
    const user = userEvent.setup()
    renderCreate()

    await user.type(screen.getByPlaceholderText('Ej: Sin sal, Con queso extra...'), 'Shot de espresso')
    await user.click(screen.getByRole('button', { name: 'Crear Modificador' }))

    await waitFor(() => expect(createCalls).toHaveLength(1))
    const [, , payload] = createCalls[0]
    expect(payload).toMatchObject({ name: 'Shot de espresso' })
    expect(payload).not.toHaveProperty('sku')
  })
})
