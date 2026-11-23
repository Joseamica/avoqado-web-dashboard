/**
 * D679 · Paquete «Ilimitado» en el formulario del panel. El interruptor por renglón esconde la cantidad, la vigencia se vuelve
 * obligatoria, y CADA renglón manda la llave `unlimited` (true o false): así el SERVIDOR sabe que habla con un panel nuevo y
 * no aplica la regla del editor viejo (W4). Un renglón Ilimitado nunca enseña ni manda 99,999.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import en from '@/locales/en/creditPacks.json'
import es from '@/locales/es/creditPacks.json'

const estables = vi.hoisted(() => ({
  i18n: {
    // `t` pega los valores con «:» para poder buscar el texto y sus números en la pantalla.
    t: (k: string, o?: Record<string, unknown> | string) =>
      typeof o === 'object' ? [k, ...Object.entries(o).flatMap(([c, v]) => (c === 'defaultValue' ? [] : [String(v)]))].join(':') : k,
    i18n: { language: 'es' },
  },
}))
const paquetes = vi.hoisted(() => ({ getCreditPack: vi.fn(), createCreditPack: vi.fn(), updateCreditPack: vi.fn() }))
const red = vi.hoisted(() => ({ get: vi.fn() }))
const avisos = vi.hoisted(() => ({ toast: vi.fn() }))

vi.mock('react-i18next', () => ({ useTranslation: () => estables.i18n }))
vi.mock('@/services/creditPack.service', () => ({ default: paquetes }))
vi.mock('@/api', () => ({ default: red }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: avisos.toast }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
// El buscador real es un Popover de Radix + cmdk; aquí basta con poder elegir un producto.
vi.mock('@/components/search-combobox', () => ({
  SearchCombobox: ({ items, onSelect }: { items: { id: string; label: string }[]; onSelect: (i: { id: string }) => void }) => (
    <div>
      {items.map(i => (
        <button key={i.id} type="button" onClick={() => onSelect(i)}>
          elegir {i.label}
        </button>
      ))}
    </div>
  ),
}))

import CreditPackFormModal from '../CreditPackForm'

const PRODUCTOS = [
  { id: 'p1', name: 'Lagree', price: 0 },
  { id: 'p2', name: 'Shake', price: 80 },
]

function pintar(packId?: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const envoltura = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return render(<CreditPackFormModal open onClose={() => {}} packId={packId} onSuccess={() => {}} />, { wrapper: envoltura })
}

const guardar = () => fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))

async function llenarAlta() {
  fireEvent.click(await screen.findByRole('button', { name: 'elegir Lagree' }))
  fireEvent.change(screen.getByPlaceholderText('form.placeholders.name'), { target: { value: 'Ilimitado mensual' } })
  fireEvent.change(screen.getByPlaceholderText('form.placeholders.price'), { target: { value: '2500' } })
}

beforeEach(() => {
  red.get.mockResolvedValue({ data: { data: PRODUCTOS } })
  paquetes.createCreditPack.mockResolvedValue({ id: 'nuevo' })
  paquetes.updateCreditPack.mockResolvedValue({ id: 'pk1' })
})

describe('CreditPackForm · Ilimitado', () => {
  it('encender Ilimitado oculta Cantidad y manda unlimited:true sin quantity', async () => {
    pintar()
    await llenarAlta()
    expect(screen.getAllByLabelText('form.fields.quantity')).toHaveLength(1)

    fireEvent.click(screen.getByRole('switch', { name: 'form.fields.unlimited' }))
    expect(screen.queryByLabelText('form.fields.quantity')).not.toBeInTheDocument()
    expect(screen.getByText('form.unlimitedHelp')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('form.placeholders.validityDays'), { target: { value: '30' } })
    guardar()

    await waitFor(() => expect(paquetes.createCreditPack).toHaveBeenCalledTimes(1))
    const [, cuerpo] = paquetes.createCreditPack.mock.calls[0]
    expect(cuerpo.validityDays).toBe(30)
    expect(cuerpo.items).toEqual([{ productId: 'p1', unlimited: true }])
    expect(cuerpo.items[0]).not.toHaveProperty('quantity')
  })

  it('sin vigencia no deja guardar y enseña el texto', async () => {
    pintar()
    await llenarAlta()
    fireEvent.click(screen.getByRole('switch', { name: 'form.fields.unlimited' }))
    guardar()

    expect(await screen.findByText('form.validation.unlimitedNeedsValidity')).toBeInTheDocument()
    expect(paquetes.createCreditPack).not.toHaveBeenCalled()
  })

  it('un paquete normal se crea igual que hoy más unlimited:false', async () => {
    pintar()
    await llenarAlta()
    guardar()

    await waitFor(() => expect(paquetes.createCreditPack).toHaveBeenCalledTimes(1))
    const [, cuerpo] = paquetes.createCreditPack.mock.calls[0]
    expect(cuerpo.items).toEqual([{ productId: 'p1', quantity: 1, unlimited: false }])
    expect(cuerpo.validityDays).toBeUndefined()
  })

  it('al editar, cada renglón manda la llave unlimited y el Ilimitado no enseña 99999', async () => {
    paquetes.getCreditPack.mockResolvedValue({
      id: 'pk1',
      venueId: 'v1',
      name: 'Ilimitado + shakes',
      price: 2500,
      currency: 'MXN',
      validityDays: 30,
      active: true,
      displayOrder: 0,
      items: [
        { id: 'i1', productId: 'p1', quantity: 99999, unlimited: true, product: { id: 'p1', name: 'Lagree', type: 'CLASS', price: 0 } },
        { id: 'i2', productId: 'p2', quantity: 2, unlimited: false, product: { id: 'p2', name: 'Shake', type: 'FOOD', price: 80 } },
      ],
      createdAt: '',
      updatedAt: '',
    })
    const { container } = pintar('pk1')

    await screen.findByText('Shake')
    const interruptores = screen.getAllByRole('switch', { name: 'form.fields.unlimited' })
    expect(interruptores[0]).toHaveAttribute('aria-checked', 'true')
    expect(interruptores[1]).toHaveAttribute('aria-checked', 'false')
    // Sólo el renglón normal tiene cantidad, y ningún campo trae 99999.
    expect(screen.getAllByLabelText('form.fields.quantity')).toHaveLength(1)
    expect(container.innerHTML).not.toMatch(/99999|99,999|99998/)

    // Cambiar un renglón manda todos los renglones, cada uno con su llave.
    fireEvent.change(screen.getByLabelText('form.fields.quantity'), { target: { value: '3' } })
    guardar()
    await waitFor(() => expect(paquetes.updateCreditPack).toHaveBeenCalledTimes(1))
    const [, id, cuerpo] = paquetes.updateCreditPack.mock.calls[0]
    expect(id).toBe('pk1')
    expect(cuerpo.items).toEqual([
      { productId: 'p1', unlimited: true },
      { productId: 'p2', quantity: 3, unlimited: false },
    ])
  })

  // Codex pantallas r1 #5: con el formulario abierto, otra persona convirtió el Ilimitado en un paquete normal. Guardar sólo el
  // título con el formulario viejo no puede reenviar los renglones (volvería a prender el Ilimitado): no se manda `items`.
  it('al editar, guardar sólo el título no manda items', async () => {
    paquetes.getCreditPack.mockResolvedValue({
      id: 'pk1',
      venueId: 'v1',
      name: 'Ilimitado mensual',
      price: 2500,
      currency: 'MXN',
      validityDays: 30,
      active: true,
      displayOrder: 0,
      items: [
        { id: 'i1', productId: 'p1', quantity: 99999, unlimited: true, product: { id: 'p1', name: 'Lagree', type: 'CLASS', price: 0 } },
      ],
      createdAt: '',
      updatedAt: '',
    })
    pintar('pk1')

    await screen.findByText('Lagree')
    fireEvent.change(screen.getByPlaceholderText('form.placeholders.name'), { target: { value: 'Ilimitado de 30 días' } })
    guardar()

    await waitFor(() => expect(paquetes.updateCreditPack).toHaveBeenCalledTimes(1))
    const [, , cuerpo] = paquetes.updateCreditPack.mock.calls[0]
    expect(cuerpo.name).toBe('Ilimitado de 30 días')
    expect(cuerpo).not.toHaveProperty('items')
  })

  it('apagar el Ilimitado al editar pide una cantidad (no se queda con 99999)', async () => {
    paquetes.getCreditPack.mockResolvedValue({
      id: 'pk1',
      venueId: 'v1',
      name: 'Ilimitado',
      price: 2500,
      currency: 'MXN',
      validityDays: 30,
      active: true,
      displayOrder: 0,
      items: [
        { id: 'i1', productId: 'p1', quantity: 99999, unlimited: true, product: { id: 'p1', name: 'Lagree', type: 'CLASS', price: 0 } },
      ],
      createdAt: '',
      updatedAt: '',
    })
    pintar('pk1')

    await screen.findByText('Lagree')
    const interruptor = screen.getByRole('switch', { name: 'form.fields.unlimited' })
    expect(interruptor).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(interruptor)
    const cantidad = screen.getByLabelText('form.fields.quantity')
    expect(cantidad).toHaveValue(null)
    guardar()
    expect(await screen.findByText('form.validation.quantityRequired')).toBeInTheDocument()
    expect(paquetes.updateCreditPack).not.toHaveBeenCalled()
  })

  it('un rechazo del SERVIDOR se enseña con su texto', async () => {
    paquetes.createCreditPack.mockRejectedValue({
      response: { data: { message: 'Un paquete Ilimitado necesita días de vigencia.', code: 'CREDIT_UNLIMITED_NEEDS_VALIDITY' } },
    })
    pintar()
    await llenarAlta()
    guardar()
    await waitFor(() =>
      expect(avisos.toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Un paquete Ilimitado necesita días de vigencia.', variant: 'destructive' }),
      ),
    )
  })
})

describe('textos del Ilimitado', () => {
  it('es y en tienen las mismas llaves y el texto del plan', () => {
    expect(Object.keys(en.unlimited).sort()).toEqual(Object.keys(es.unlimited).sort())
    expect(es.form.fields.unlimited).toBe('Ilimitado')
    expect(es.form.unlimitedHelp).toBe('Personal: sólo a nombre de quien lo compra, un lugar por clase')
    expect(es.form.validation.unlimitedNeedsValidity).toBe('Un paquete Ilimitado necesita días de vigencia')
    expect(en.form.fields.unlimited).toBeTruthy()
    expect(en.form.unlimitedHelp).toBeTruthy()
    expect(en.form.validation.unlimitedNeedsValidity).toBeTruthy()
    for (const texto of [...Object.values(es.unlimited), ...Object.values(en.unlimited)]) {
      expect(texto).not.toMatch(/99\D?99/)
    }
  })
})
