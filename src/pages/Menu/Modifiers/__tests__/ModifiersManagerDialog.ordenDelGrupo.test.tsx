// hz:960ee149:D1: al ligar el grupo a un producto nuevo, el diálogo no manda `displayOrder`. Mandaba la posición del PRODUCTO en
// la lista del grupo, que no tiene nada que ver con la posición del grupo dentro de ese producto.
import type { ReactNode } from 'react'

import i18n from '@/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Funciones planas, no `vi.fn()`: la config de vitest tiene `mockReset: true`.
const server = vi.hoisted(() => ({ assigns: [] as unknown[][] }))

vi.mock('@/services/menu.service', () => ({
  getModifierGroup: async () => ({
    id: 'group-1',
    name: 'Salsa',
    description: '',
    required: false,
    allowMultiple: false,
    allowRepeat: false,
    minSelections: 0,
    maxSelections: 1,
    modifiers: [],
  }),
  getProducts: async () => [
    { id: 'p1', name: 'Bebida', modifierGroups: [{ groupId: 'group-1' }] },
    { id: 'p2', name: 'Guarnición', modifierGroups: [] },
  ],
  updateModifierGroup: async () => ({}),
  archiveModifier: async () => {},
  assignModifierGroupToProduct: async (...args: unknown[]) => {
    server.assigns.push(args)
    return {}
  },
  removeModifierGroupFromProduct: async () => {},
  createModifier: async () => ({}),
  updateModifier: async () => ({}),
}))
vi.mock('@/services/inventory.service', () => ({
  rawMaterialsApi: { getAll: () => Promise.resolve({ data: { data: [] } }) },
}))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true, canAny: () => true, canAll: () => true }) }))
// El selector real es de arrastrar; aquí un botón agrega el producto que falta.
vi.mock('@/components/draggable-multi-select', async () => {
  const React = await import('react')
  type Opcion = { label: string; value: string }
  return {
    default: (props: { options: Opcion[]; value: Opcion[]; onChange: (v: Opcion[]) => void }) =>
      React.createElement(
        'button',
        { type: 'button', onClick: () => props.onChange([...props.value, props.options[1]]) },
        'agregar producto',
      ),
  }
})
vi.mock('@/components/ui/full-screen-modal', async () => {
  const React = await import('react')
  return {
    FullScreenModal: (props: { open: boolean; actions?: ReactNode; children?: ReactNode }) =>
      props.open ? React.createElement('div', null, props.actions, props.children) : null,
  }
})

import { ModifiersManagerDialog } from '../components/ModifiersManagerDialog'

describe('ModifiersManagerDialog — ligar el grupo a un producto (hz:960ee149:D1)', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('es')
  })
  beforeEach(() => {
    server.assigns.length = 0
  })

  it('manda sólo el grupo: el servidor lo pone al final de los grupos de ese producto', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <ModifiersManagerDialog venueId="venue-1" modifierGroupId="group-1" onClose={() => {}} />
      </QueryClientProvider>,
    )
    await user.click(await screen.findByRole('button', { name: 'agregar producto' }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(server.assigns).toHaveLength(1))
    expect(server.assigns[0]).toEqual(['venue-1', 'p2', { modifierGroupId: 'group-1' }])
  })
})
