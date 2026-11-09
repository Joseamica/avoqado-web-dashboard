// D14: quitar un extra lo ARCHIVA (`active: false`), nunca lo borra: borrarlo le cambiaba el precio a las ligas ya
// enviadas, le quitaba el extra al reporte y rechazaba las ventas sin red que lo traían.
// Se simula sólo `@/api`, para comprobar el verbo HTTP real que sale del diálogo y del servicio.
import type { ReactNode } from 'react'

import i18n from '@/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Funciones planas y no `vi.fn()`: la config de vitest trae `mockReset: true`.
const server = vi.hoisted(() => ({
  modifiers: [] as Array<Record<string, unknown>>,
  calls: [] as Array<{ method: string; url: string; body?: unknown }>,
  permissions: null as string[] | null,
  group: { required: false, minSelections: 0 as number | null },
}))

vi.mock('@/api', () => {
  const groupOf = (url: string) => ({
    id: 'group-1',
    name: 'Extras',
    description: '',
    ...server.group,
    allowMultiple: false,
    maxSelections: 1,
    modifiers: server.modifiers.map(m => ({ ...m })),
    url,
  })
  const write = (method: string) => async (url: string, body?: unknown) => {
    server.calls.push({ method, url, body })
    const id = url.split('/').pop()
    server.modifiers = server.modifiers.map(m => (m.id === id ? { ...m, ...(body as object) } : m))
    return { data: {} }
  }
  return {
    default: {
      get: async (url: string) => {
        if (url.endsWith('/modifier-groups')) return { data: [groupOf(url)] }
        if (url.endsWith('/modifier-groups/group-1')) return { data: groupOf(url) }
        return { data: [] }
      },
      put: write('PUT'),
      patch: write('PATCH'),
      delete: write('DELETE'),
      post: write('POST'),
    },
  }
})

vi.mock('@/hooks/use-access', () => ({
  useAccess: () => {
    const can = (permission: string) => server.permissions === null || server.permissions.includes(permission)
    return { can, canAny: can, canAll: can }
  },
}))

vi.mock('@/components/draggable-multi-select', () => ({ default: () => null }))
vi.mock('@/components/ui/full-screen-modal', async () => {
  const React = await import('react')
  return {
    FullScreenModal: (props: { open: boolean; actions?: ReactNode; children?: ReactNode }) =>
      props.open ? React.createElement('div', null, props.actions, props.children) : null,
  }
})

import { getModifierGroup, getModifierGroups } from '@/services/menu.service'
import { ModifiersManagerDialog } from '../components/ModifiersManagerDialog'

const extra = (id: string, name: string, active: boolean) => ({
  id,
  groupId: 'group-1',
  name,
  price: 20,
  active,
  sku: null,
  rawMaterialId: null,
  rawMaterial: null,
  quantityPerUnit: null,
  unit: null,
  inventoryMode: null,
})

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ModifiersManagerDialog venueId="venue-1" modifierGroupId="group-1" onClose={() => {}} />
    </QueryClientProvider>,
  )
}

const fila = async (nombre: string) => (await screen.findByText(nombre)).closest('[role="button"]') as HTMLElement

describe('Quitar un modificador lo archiva', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('es')
  })

  beforeEach(() => {
    server.modifiers = []
    server.calls.length = 0
    server.permissions = null
    server.group = { required: false, minSelections: 0 }
  })

  it('un grupo obligatorio no se queda con menos opciones de las que pide', async () => {
    server.group = { required: true, minSelections: 2 }
    server.modifiers = [extra('mod-1', 'Queso', true), extra('mod-2', 'Tocino', true)]
    const user = userEvent.setup()
    renderDialog()

    await user.click(within(await fila('Queso')).getByRole('button', { name: 'Eliminar' }))

    const confirmacion = await screen.findByRole('alertdialog')
    expect(confirmacion).toHaveTextContent('pide al menos 2 opciones activas')
    expect(within(confirmacion).getByRole('button', { name: 'Eliminar' })).toBeDisabled()
    expect(server.calls).toHaveLength(0)
  })

  it('un grupo obligatorio deja quitar mientras queden las que pide', async () => {
    server.group = { required: true, minSelections: 1 }
    server.modifiers = [extra('mod-1', 'Queso', true), extra('mod-2', 'Tocino', true)]
    const user = userEvent.setup()
    renderDialog()

    await user.click(within(await fila('Queso')).getByRole('button', { name: 'Eliminar' }))

    expect(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Eliminar' })).toBeEnabled()
  })

  it('confirmar manda sólo PATCH {active:false}, nunca DELETE, y avisa que se puede reactivar', async () => {
    server.modifiers = [extra('mod-1', 'Queso', true)]
    const user = userEvent.setup()
    renderDialog()

    await user.click(within(await fila('Queso')).getByRole('button', { name: 'Eliminar' }))

    const confirmacion = await screen.findByRole('alertdialog')
    expect(confirmacion).toHaveTextContent('ya no se ofrecerá al vender')
    expect(confirmacion).toHaveTextContent('Las ventas y los reportes anteriores no cambian')
    expect(confirmacion).toHaveTextContent('volver a activarlo')
    expect(confirmacion).not.toHaveTextContent('no se puede deshacer')

    await user.click(within(confirmacion).getByRole('button', { name: 'Eliminar' }))

    await waitFor(() => expect(server.calls).toHaveLength(1))
    expect(server.calls[0]).toEqual({
      method: 'PATCH',
      url: '/api/v1/dashboard/venues/venue-1/modifier-groups/group-1/modifiers/mod-1',
      body: { active: false },
    })
  })

  it('ya archivado sigue en el editor como «Inactivo» y sin el botón de quitar', async () => {
    server.modifiers = [extra('mod-1', 'Queso', true)]
    const user = userEvent.setup()
    renderDialog()

    await user.click(within(await fila('Queso')).getByRole('button', { name: 'Eliminar' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Eliminar' }))

    await waitFor(async () => expect(within(await fila('Queso')).getByText('Inactivo')).toBeInTheDocument())
    expect(within(await fila('Queso')).queryByRole('button', { name: 'Eliminar' })).toBeNull()
  })

  it('un archivado se reactiva con el interruptor «Activo» de su detalle', async () => {
    server.modifiers = [extra('mod-1', 'Queso', false)]
    const user = userEvent.setup()
    renderDialog()

    await user.click(await screen.findByText('Queso'))
    const interruptores = await screen.findAllByRole('switch')
    expect(interruptores[0]).not.toBeChecked()
    await user.click(interruptores[0])
    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }))

    await waitFor(() => expect(server.calls).toHaveLength(1))
    expect(server.calls[0].method).toBe('PUT')
    expect(server.calls[0].body).toMatchObject({ active: true })
  })

  it('quitar pide «menu:update», que es lo que el SERVIDOR exige para archivar', async () => {
    server.modifiers = [extra('mod-1', 'Queso', true)]
    server.permissions = ['menu:read', 'menu:delete']
    renderDialog()
    expect(within(await fila('Queso')).queryByRole('button', { name: 'Eliminar' })).toBeNull()
  })

  it('el listado de grupos (selectores, conteos, exportar) no ofrece archivados; el editor del grupo sí los trae', async () => {
    server.modifiers = [extra('mod-1', 'Queso', true), extra('mod-2', 'Tocino', false)]

    const [grupo] = await getModifierGroups('venue-1')
    expect(grupo.modifiers?.map(m => m.name)).toEqual(['Queso'])

    const editor = await getModifierGroup('venue-1', 'group-1')
    expect(editor.modifiers?.map(m => m.name)).toEqual(['Queso', 'Tocino'])
  })
})
