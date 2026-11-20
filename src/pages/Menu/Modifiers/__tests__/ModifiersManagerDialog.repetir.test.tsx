// «Se puede repetir la misma opción» (encargo a508f4, Flautas Coyoacán): el interruptor del grupo y el tope por opción, en el
// DIÁLOGO real. Con máximo 1 no se puede prender; al guardar viaja `allowRepeat`; el tope sólo se ve si el grupo repite.
import type { ReactNode } from 'react'

import i18n from '@/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Funciones planas, no `vi.fn()`: la config de vitest tiene `mockReset: true`.
const server = vi.hoisted(() => ({
  group: null as Record<string, unknown> | null,
  groupUpdates: [] as unknown[][],
  modifierUpdates: [] as unknown[][],
}))

vi.mock('@/services/menu.service', () => ({
  getModifierGroup: async () => ({ ...server.group }),
  getProducts: async () => [],
  updateModifierGroup: async (...args: unknown[]) => {
    server.groupUpdates.push(args)
    server.group = { ...server.group, ...(args[2] as Record<string, unknown>) }
    return server.group
  },
  archiveModifier: async () => {},
  assignModifierGroupToProduct: async () => ({}),
  removeModifierGroupFromProduct: async () => {},
  createModifier: async () => ({}),
  updateModifier: async (...args: unknown[]) => {
    server.modifierUpdates.push(args)
    return {}
  },
}))
vi.mock('@/services/inventory.service', () => ({
  rawMaterialsApi: { getAll: () => Promise.resolve({ data: { data: [] } }) },
}))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true, canAny: () => true, canAll: () => true }) }))
vi.mock('@/components/draggable-multi-select', () => ({ default: () => null }))
vi.mock('@/components/ui/full-screen-modal', async () => {
  const React = await import('react')
  return {
    FullScreenModal: (props: { open: boolean; actions?: ReactNode; children?: ReactNode }) =>
      props.open ? React.createElement('div', null, props.actions, props.children) : null,
  }
})

import { ModifiersManagerDialog } from '../components/ModifiersManagerDialog'

const flautas = (extra: Record<string, unknown> = {}) => ({
  id: 'group-1',
  name: 'Flautas (hasta 3)',
  description: '',
  required: true,
  allowMultiple: true,
  allowRepeat: false,
  minSelections: 3,
  maxSelections: 3,
  modifiers: [{ id: 'mod-1', groupId: 'group-1', name: 'Flautas Cochinita', price: 0, active: true, sku: null, maxQuantity: null }],
  ...extra,
})

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ModifiersManagerDialog venueId="venue-1" modifierGroupId="group-1" onClose={() => {}} />
    </QueryClientProvider>,
  )
}

describe('ModifiersManagerDialog — repetir la misma opción', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('es')
  })
  beforeEach(() => {
    server.groupUpdates.length = 0
    server.modifierUpdates.length = 0
  })

  it('prenderlo y guardar manda allowRepeat: true junto con el máximo', async () => {
    server.group = flautas()
    const user = userEvent.setup()
    renderDialog()
    await waitFor(() => expect(screen.getByText('Se puede repetir la misma opción')).toBeInTheDocument())
    const sw = screen.getAllByRole('switch').find(el => el.closest('[data-tour="modifier-group-allow-repeat"]'))!
    expect(sw).not.toBeDisabled()
    await user.click(sw)
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(server.groupUpdates).toHaveLength(1))
    expect(server.groupUpdates[0][2]).toMatchObject({ allowRepeat: true, maxSelections: 3, allowMultiple: true })
  })

  it('con máximo 1 el interruptor está apagado y explica qué hacer', async () => {
    server.group = flautas({ allowMultiple: false, maxSelections: 1, minSelections: 1 })
    renderDialog()
    expect(await screen.findByText('Sube el máximo a más de 1 para poder repetir una opción.')).toBeInTheDocument()
    const sw = screen.getAllByRole('switch').find(el => el.closest('[data-tour="modifier-group-allow-repeat"]'))!
    expect(sw).toBeDisabled()
  })

  it('en un grupo que repite, la opción enseña «Veces que se puede elegir» y lo guarda', async () => {
    server.group = flautas({ allowRepeat: true })
    const user = userEvent.setup()
    renderDialog()
    await user.click(await screen.findByText('Flautas Cochinita'))
    const campo = await screen.findByLabelText('Veces que se puede elegir')
    await user.type(campo, '2')
    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }))
    await waitFor(() => expect(server.modifierUpdates).toHaveLength(1))
    expect(server.modifierUpdates[0][3]).toMatchObject({ maxQuantity: 2 })
  })

  it('regresión: en un grupo que no repite, la opción no enseña el tope ni lo manda', async () => {
    server.group = flautas()
    const user = userEvent.setup()
    renderDialog()
    await user.click(await screen.findByText('Flautas Cochinita'))
    await screen.findByRole('button', { name: 'Guardar Cambios' })
    expect(screen.queryByLabelText('Veces que se puede elegir')).not.toBeInTheDocument()
  })
})

describe('ModifiersManagerDialog — guardar otra cosa no pisa la repetición (Codex r2 #3)', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('es')
  })
  beforeEach(() => {
    server.groupUpdates.length = 0
    server.modifierUpdates.length = 0
  })

  it('cambiar sólo el nombre del grupo no manda allowRepeat', async () => {
    server.group = flautas()
    const user = userEvent.setup()
    renderDialog()
    const nombre = await screen.findByDisplayValue('Flautas (hasta 3)')
    await user.type(nombre, ' x')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(server.groupUpdates).toHaveLength(1))
    expect(server.groupUpdates[0][2]).not.toHaveProperty('allowRepeat')
  })

  it('cambiar otra cosa de la opción no manda su tope', async () => {
    server.group = flautas({
      allowRepeat: true,
      modifiers: [{ id: 'mod-1', groupId: 'group-1', name: 'Flautas Cochinita', price: 0, active: true, sku: null, maxQuantity: 2 }],
    })
    const user = userEvent.setup()
    renderDialog()
    await user.click(await screen.findByText('Flautas Cochinita'))
    expect(await screen.findByLabelText('Veces que se puede elegir')).toHaveValue(2)
    // Se cambia otra cosa (el nombre): sin cambios el botón no guarda.
    await user.type(screen.getByPlaceholderText('Nombre del modificador'), ' x')
    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }))
    await waitFor(() => expect(server.modifierUpdates).toHaveLength(1))
    expect(server.modifierUpdates[0][3]).not.toHaveProperty('maxQuantity')
  })
})
