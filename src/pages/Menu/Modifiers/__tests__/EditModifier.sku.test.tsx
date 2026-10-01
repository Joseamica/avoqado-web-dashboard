import i18n from '@/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

type CapturedToast = { title?: string; description?: string; variant?: string }

// Los mocks de módulo son funciones planas y NO `vi.fn()`: la config de vitest tiene
// `mockReset: true`, que borraría la implementación de un `vi.fn()` antes de cada test y
// dejaría el stub inservible. Lo que se captura vive en este objeto, que cada test vacía a mano.
const state = vi.hoisted(() => ({
  updateCalls: [] as unknown[][],
  toasts: [] as CapturedToast[],
  /** Distinto de null => `updateModifier` rechaza con esto (p. ej. un error de axios). */
  rejectWith: null as unknown,
}))

vi.mock('@/services/menu.service', () => ({
  updateModifier: (...args: unknown[]) => {
    state.updateCalls.push(args)
    return state.rejectWith ? Promise.reject(state.rejectWith) : Promise.resolve({ id: 'mod-1' })
  },
}))

// EditModifier sólo lista materias primas con el switch de inventario encendido; aquí está
// apagado, pero el servicio se mockea igual para que ninguna prueba toque la red.
vi.mock('@/services/inventory.service', () => ({
  rawMaterialsApi: { getAll: () => Promise.resolve({ data: { data: [] } }) },
}))

// El aviso (toast) no se monta en el árbol de prueba: se captura lo que el componente pide mostrar.
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: (aviso: CapturedToast) => state.toasts.push(aviso) }),
}))

import EditModifier from '../EditModifier'

const VENUE_ID = 'venue-1'
const GROUP_ID = 'group-1'
const MODIFIER_ID = 'mod-1'

// Un solo objeto, fuera del render: EditModifier reinicia el formulario cada vez que
// `initialValues` cambia de identidad, y un literal nuevo en cada render borraría lo tecleado.
const INITIAL_VALUES = { name: 'Shot de espresso', price: 15, active: true, sku: 'P000672' }

function renderEdit() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <EditModifier
        venueId={VENUE_ID}
        modifierId={MODIFIER_ID}
        modifierGroupId={GROUP_ID}
        onBack={() => {}}
        onSuccess={() => {}}
        initialValues={INITIAL_VALUES}
      />
    </QueryClientProvider>,
  )
}

describe('EditModifier — SKU del extra (el código del OTRO POS, que sale impreso en el vale)', () => {
  // El público real es México: se fija el idioma para verificar el texto que el cliente
  // lee de verdad, no la detección de locale del entorno de pruebas.
  beforeAll(async () => {
    await i18n.changeLanguage('es')
  })

  beforeEach(() => {
    state.updateCalls.length = 0
    state.toasts.length = 0
    state.rejectWith = null
  })

  it('muestra el campo «SKU» con el código que el extra ya tiene', () => {
    renderEdit()

    expect(screen.getByLabelText('SKU')).toHaveValue('P000672')
  })

  it('borrar el SKU y guardar manda `sku: null` — así se quita en el servidor', async () => {
    const user = userEvent.setup()
    renderEdit()

    await user.clear(screen.getByLabelText('SKU'))
    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }))

    await waitFor(() => expect(state.updateCalls).toHaveLength(1))
    const [venueId, groupId, modifierId, payload] = state.updateCalls[0]
    expect([venueId, groupId, modifierId]).toEqual([VENUE_ID, GROUP_ID, MODIFIER_ID])
    expect(payload).toMatchObject({ name: 'Shot de espresso' })
    // `null` explícito, no ausente: un `sku` ausente le dice al servidor «déjalo como está».
    expect(payload).toHaveProperty('sku', null)
  })

  it('un SKU escrito con espacios se manda recortado', async () => {
    const user = userEvent.setup()
    renderEdit()

    const sku = screen.getByLabelText('SKU')
    await user.clear(sku)
    await user.type(sku, '  P000673 ')
    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }))

    await waitFor(() => expect(state.updateCalls).toHaveLength(1))
    expect(state.updateCalls[0][3]).toHaveProperty('sku', 'P000673')
  })

  it('un SKU que el servidor rechaza se lee en el aviso, dentro de la frase en español', async () => {
    const user = userEvent.setup()
    // La forma de un error de axios ante un 400: el motivo viaja en `response.data.message`.
    state.rejectWith = Object.assign(new Error('Request failed with status code 400'), {
      response: { data: { message: 'Error de validación: sku: El SKU sólo admite letras, números, guion y guion bajo' } },
    })
    renderEdit()

    const sku = screen.getByLabelText('SKU')
    await user.clear(sku)
    await user.type(sku, 'P 1')
    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }))

    await waitFor(() => expect(state.toasts).toHaveLength(1))
    const [aviso] = state.toasts
    expect(aviso.variant).toBe('destructive')
    // El motivo del servidor, no el genérico de axios…
    expect(aviso.description).toContain('El SKU sólo admite letras')
    expect(aviso.description).not.toContain('Request failed with status code 400')
    // …dentro de la frase en español de siempre, para que ninguna falla pierda su contexto.
    expect(aviso.description).toMatch(/^Hubo un problema al actualizar el modificador: /)
  })

  it('guardar sin tocar el SKU manda el que ya tenía — cambiar otro campo no lo borra', async () => {
    const user = userEvent.setup()
    renderEdit()

    // Sólo cambia el precio; el SKU queda como llegó.
    const precio = screen.getByLabelText('Precio')
    await user.clear(precio)
    await user.type(precio, '20')
    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }))

    await waitFor(() => expect(state.updateCalls).toHaveLength(1))
    const payload = state.updateCalls[0][3]
    expect(payload).toMatchObject({ name: 'Shot de espresso', price: 20 })
    // El valor de siempre, no `null`: un `null` aquí borraría en el servidor un SKU que nadie tocó.
    expect(payload).toHaveProperty('sku', 'P000672')
  })
})
