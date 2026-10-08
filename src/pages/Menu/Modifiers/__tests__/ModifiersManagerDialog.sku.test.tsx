// Pruebas del DIÁLOGO real (con su EditModifier real y su `useToast` real) alrededor del SKU del extra.
// Cubren lo que las pruebas de EditModifier por sí solas no pueden ver:
//   1. el mapeo del extra de la lista a los valores del formulario (si el diálogo no pasa el SKU, cada
//      guardado de un extra con SKU mandaría `sku: null` y lo borraría);
//   2. que un guardado rechazado no borre lo que la persona tecleó (el diálogo se vuelve a renderizar con
//      CADA aviso, porque `useToast` lo suscribe a todos).
import type { ReactNode } from 'react'

import i18n from '@/i18n'
import { useToast } from '@/hooks/use-toast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Los mocks de módulo son funciones planas y NO `vi.fn()`: la config de vitest tiene `mockReset: true`,
// que borraría la implementación de un `vi.fn()` antes de cada test y dejaría el stub inservible.
// Lo que hace de «servidor» vive en este objeto, que cada test deja como lo necesita.
const server = vi.hoisted(() => ({
  /** El extra tal como lo tiene el «servidor»: es lo que el diálogo lee cada vez que carga el grupo. */
  modifier: null as Record<string, unknown> | null,
  updateCalls: [] as unknown[][],
  /** Distinto de null => `updateModifier` rechaza con esto (p. ej. un error de axios). */
  rejectWith: null as unknown,
}))

vi.mock('@/services/menu.service', () => ({
  getModifierGroup: async () => ({
    id: 'group-1',
    name: 'Extras',
    description: '',
    required: false,
    allowMultiple: false,
    minSelections: 0,
    maxSelections: 1,
    modifiers: [{ ...server.modifier }],
  }),
  getProducts: async () => [],
  updateModifierGroup: async () => ({}),
  deleteModifier: async () => {},
  assignModifierGroupToProduct: async () => ({}),
  removeModifierGroupFromProduct: async () => {},
  createModifier: async () => ({}),
  updateModifier: async (...args: unknown[]) => {
    server.updateCalls.push(args)
    if (server.rejectWith) throw server.rejectWith
    const payload = args[3] as Record<string, unknown>
    // El contrato del servidor ya entregado: `sku` ausente => no se toca, `null` => se borra, texto => se guarda.
    server.modifier = {
      ...server.modifier,
      name: payload.name,
      price: payload.price,
      ...(payload.sku !== undefined ? { sku: payload.sku } : {}),
    }
    for (const key of ['durationMin', 'rawMaterialId', 'quantityPerUnit', 'unit', 'inventoryMode']) {
      if (payload[key] !== undefined) server.modifier = { ...server.modifier, [key]: payload[key] }
    }
    return server.modifier
  },
}))

vi.mock('@/services/inventory.service', () => ({
  rawMaterialsApi: { getAll: () => Promise.resolve({ data: { data: [] } }) },
}))

// El `PermissionGate` real sólo necesita que `can` diga que sí (el caso sin permiso no es de este archivo).
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true, canAny: () => true, canAll: () => true }) }))

// Dos cascarones de maquetación que aquí no aportan nada: el modal de pantalla completa (Radix + portal)
// y el selector de productos con drag-and-drop. Todo lo demás del diálogo es el real.
vi.mock('@/components/draggable-multi-select', () => ({ default: () => null }))
vi.mock('@/components/ui/full-screen-modal', async () => {
  const React = await import('react')
  return {
    FullScreenModal: (props: { open: boolean; actions?: ReactNode; children?: ReactNode }) =>
      props.open ? React.createElement('div', null, props.actions, props.children) : null,
  }
})

import { ModifiersManagerDialog } from '../components/ModifiersManagerDialog'

const VENUE_ID = 'venue-1'
const GROUP_ID = 'group-1'
const MODIFIER_ID = 'mod-1'

const extra = (sku: string | null) => ({
  id: MODIFIER_ID,
  groupId: GROUP_ID,
  name: 'Shot de espresso',
  price: 15,
  active: true,
  sku,
  rawMaterialId: null,
  rawMaterial: null,
  quantityPerUnit: null,
  unit: null,
  inventoryMode: null,
})

/** Pinta en pantalla lo que se pide mostrar como aviso: así la prueba espera el aviso sin dormir. */
function ToastProbe() {
  const { toasts } = useToast()
  return (
    <>
      {toasts.map(aviso => (
        <p key={aviso.id}>{aviso.description}</p>
      ))}
    </>
  )
}

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ModifiersManagerDialog venueId={VENUE_ID} modifierGroupId={GROUP_ID} onClose={() => {}} />
      <ToastProbe />
    </QueryClientProvider>,
  )
}

type User = ReturnType<typeof userEvent.setup>

/** Abre desde la lista el extra con ese nombre y devuelve su campo «SKU». */
async function abrirExtra(user: User, nombre = 'Shot de espresso') {
  await user.click(await screen.findByText(nombre))
  return screen.findByLabelText('SKU')
}

async function renombrar(user: User, nombre: string) {
  const campo = screen.getByPlaceholderText('Nombre del modificador')
  await user.clear(campo)
  await user.type(campo, nombre)
}

const guardar = (user: User) => user.click(screen.getByRole('button', { name: 'Guardar Cambios' }))

describe('ModifiersManagerDialog — el SKU del extra, de la lista al formulario y de vuelta', () => {
  // El público real es México: se fija el idioma para verificar el texto que el cliente
  // lee de verdad, no la detección de locale del entorno de pruebas.
  beforeAll(async () => {
    await i18n.changeLanguage('es')
  })

  beforeEach(() => {
    server.modifier = null
    server.updateCalls.length = 0
    server.rejectWith = null
  })

  it('guardar un extra cambiando sólo el nombre manda el SKU que ya tenía — no lo borra', async () => {
    server.modifier = extra('P000672')
    const user = userEvent.setup()
    renderDialog()

    expect(await abrirExtra(user)).toHaveValue('P000672')
    await renombrar(user, 'Shot doble')
    await guardar(user)

    await waitFor(() => expect(server.updateCalls).toHaveLength(1))
    expect(server.updateCalls[0].slice(0, 3)).toEqual([VENUE_ID, GROUP_ID, MODIFIER_ID])
    expect(server.updateCalls[0][3]).toMatchObject({ name: 'Shot doble' })
    // El SKU de siempre, no `null`: un `null` aquí lo borraría en el servidor sin que nadie lo pidiera.
    expect(server.updateCalls[0][3]).toHaveProperty('sku', 'P000672')
    expect(server.modifier?.sku).toBe('P000672')
  })

  it('poner un SKU, guardar y volver a abrir el extra muestra el SKU guardado', async () => {
    server.modifier = extra(null)
    const user = userEvent.setup()
    renderDialog()

    const sku = await abrirExtra(user)
    expect(sku).toHaveValue('')
    await user.type(sku, '  P000673 ')
    // Se renombra de paso: el nombre nuevo es lo que avisa, sin dormir, que la lista ya recargó lo guardado.
    await renombrar(user, 'Shot doble')
    await guardar(user)

    await waitFor(() => expect(server.updateCalls).toHaveLength(1))
    expect(server.updateCalls[0][3]).toHaveProperty('sku', 'P000673')
    expect(await abrirExtra(user, 'Shot doble')).toHaveValue('P000673')
  })

  it('borrar el SKU, guardar y volver a abrir el extra lo muestra vacío — el viejo no resucita', async () => {
    server.modifier = extra('P000672')
    const user = userEvent.setup()
    renderDialog()

    await user.clear(await abrirExtra(user))
    // Se renombra de paso: el nombre nuevo es lo que avisa, sin dormir, que la lista ya recargó lo guardado.
    await renombrar(user, 'Shot doble')
    await guardar(user)

    await waitFor(() => expect(server.updateCalls).toHaveLength(1))
    expect(server.updateCalls[0][3]).toHaveProperty('sku', null)
    expect(await abrirExtra(user, 'Shot doble')).toHaveValue('')
  })

  it('un SKU que el servidor rechaza no borra lo que la persona tecleó: sale el aviso y el campo queda como estaba', async () => {
    server.modifier = {
      ...extra('P000672'),
      price: 5,
      durationMin: 5,
      rawMaterialId: 'rm-1',
      rawMaterial: { id: 'rm-1', name: 'Ingrediente extra', unit: 'UNIT', currentStock: 100 },
      quantityPerUnit: 0.25,
      unit: 'UNIT',
      inventoryMode: 'ADDITION',
    }
    // La forma de un error de axios ante un 400: el motivo viaja en `response.data.message`.
    server.rejectWith = Object.assign(new Error('Request failed with status code 400'), {
      response: { data: { message: 'Error de validación: sku: El SKU sólo admite letras, números, guion y guion bajo' } },
    })
    const user = userEvent.setup()
    renderDialog()

    const sku = await abrirExtra(user)
    await user.clear(sku)
    await user.type(sku, 'P 1')
    await guardar(user)

    // El aviso ya salió. El diálogo está suscrito a TODOS los avisos y se vuelve a renderizar con él…
    await screen.findByText(/El SKU sólo admite letras/)
    // …se vacían los efectos pendientes de ese render (aquí es donde el formulario se reiniciaba)…
    await act(async () => {})
    // …y lo tecleado sigue ahí para corregirlo, con «Guardar Cambios» disponible para reintentar.
    expect(screen.getByLabelText('SKU')).toHaveValue('P 1')
    expect(screen.getByLabelText('Precio')).toHaveValue(5)
    expect(screen.getByPlaceholderText('0')).toHaveAttribute('name', 'durationMin')
    expect(screen.getByPlaceholderText('0')).toHaveValue(5)
    expect(screen.getByLabelText('Cantidad por modificador')).toHaveValue(0.25)
    const stock = screen.getByText(/^Stock Actual:/)
    expect(stock.textContent).toContain('100.00 Unidad')
    expect(stock.textContent).not.toContain('$')
    expect(screen.getByRole('button', { name: 'Guardar Cambios' })).toBeEnabled()
  })

  it('el extra parcial conserva inventario y duración al guardar/reabrir sin costo inventado', async () => {
    server.modifier = {
      ...extra('P000672'),
      price: 5,
      durationMin: 5,
      rawMaterialId: 'rm-1',
      rawMaterial: { id: 'rm-1', name: 'Ingrediente extra', unit: 'UNIT', currentStock: 100 },
      quantityPerUnit: 0.25,
      unit: 'UNIT',
      inventoryMode: 'ADDITION',
    }
    const user = userEvent.setup()
    renderDialog()
    await abrirExtra(user)
    expect((await screen.findByText(/^Stock Actual:/)).textContent).not.toContain('$')
    await renombrar(user, 'Shot doble')
    await guardar(user)
    await waitFor(() => expect(server.updateCalls).toHaveLength(1))
    expect(server.updateCalls[0][3]).toMatchObject({
      price: 5,
      durationMin: 5,
      rawMaterialId: 'rm-1',
      quantityPerUnit: 0.25,
      unit: 'UNIT',
      inventoryMode: 'ADDITION',
    })
    await abrirExtra(user, 'Shot doble')
    expect(screen.getByLabelText('Precio')).toHaveValue(5)
    expect(screen.getByPlaceholderText('0')).toHaveAttribute('name', 'durationMin')
    expect(screen.getByPlaceholderText('0')).toHaveValue(5)
    expect(screen.getByLabelText('Cantidad por modificador')).toHaveValue(0.25)
    const stock = await screen.findByText(/^Stock Actual:/)
    expect(stock.textContent).toContain('100.00 Unidad')
    expect(stock.textContent).not.toContain('$')
  })
})
