import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ItemPreview } from '../ItemPreview'

// La vista previa promete ser lo que ve la clienta (D6, guía de la liga por prenda). Con una prenda, la página de pago
// enseña «Desde $299.00» y los botones de cada talla y color; nunca «$0.00 · 0 artículos» ni un «Cómo obtenerlo»
// que no existe en ninguna liga.
const mocks = vi.hoisted(() => ({ group: vi.fn() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'venue-a', venue: { name: 'Boutique Luna' } }),
}))
vi.mock('@/services/productGroups.service', () => ({ getProductGroup: mocks.group }))

const variante = (values: string[], price: number, active = true) => ({ id: values.join('-'), values, price, active })
const playera = {
  id: 'g1',
  name: 'Playera básica',
  options: [
    {
      id: 'o2',
      name: 'Color',
      position: 1,
      values: [
        { id: 'v5', value: 'Negro', position: 0 },
        { id: 'v6', value: 'Blanco', position: 1 },
      ],
    },
    {
      id: 'o1',
      name: 'Talla',
      position: 0,
      values: [
        { id: 'v1', value: 'S', position: 0 },
        { id: 'v2', value: 'M', position: 1 },
        { id: 'v4', value: 'XL', position: 3 },
        { id: 'v3', value: 'L', position: 2 },
      ],
    },
  ],
  variants: [variante(['S', 'Negro'], 299), variante(['XL', 'Negro'], 329), variante(['M', 'Blanco'], 199, false)],
}

const pintar = (groupId?: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ItemPreview items={[]} groupId={groupId} groupName={groupId ? 'Playera básica' : undefined} redirectEnabled={false} redirectUrl="" />
    </QueryClientProvider>,
  )

afterEach(() => {
  cleanup()
  mocks.group.mockReset()
})

describe('vista previa de una liga por prenda', () => {
  it('enseña «Desde» el precio más bajo de las tallas activas y las tallas y colores en su orden', async () => {
    mocks.group.mockResolvedValue(playera)
    pintar('g1')

    expect(await screen.findByText('$299.00')).toBeTruthy()
    expect(screen.getByText('itemPreview.from')).toBeTruthy()
    expect(mocks.group).toHaveBeenCalledWith('venue-a', 'g1')
    const ejes = screen.getAllByRole('group').map(g => g.getAttribute('aria-label'))
    expect(ejes).toEqual(['Talla', 'Color'])
    expect(screen.getAllByRole('group')[0].textContent).toBe('TallaSMLXL')
    expect(screen.queryByText('$0.00')).toBeNull()
    expect(screen.queryByText('itemPreview.subtotal')).toBeNull()
  })

  it('sin «Desde» si todas las tallas cuestan lo mismo', async () => {
    mocks.group.mockResolvedValue({ ...playera, variants: [variante(['S', 'Negro'], 299), variante(['M', 'Negro'], 299)] })
    pintar('g1')

    expect(await screen.findByText('$299.00')).toBeTruthy()
    expect(screen.queryByText('itemPreview.from')).toBeNull()
  })

  it('al pagar, el total es el de la talla más barata, no $0.00', async () => {
    mocks.group.mockResolvedValue(playera)
    pintar('g1')
    await screen.findByText('$299.00')

    fireEvent.click(screen.getByRole('button', { name: 'itemPreview.paymentProcess' }))
    expect(screen.getByRole('button', { name: /itemPreview\.pay \$299\.00/ })).toBeTruthy()
    expect(screen.queryByText('$0.00')).toBeNull()
  })

  it('ninguna liga de artículos enseña «Cómo obtenerlo»: la página de pago no lo tiene', () => {
    pintar()

    expect(screen.queryByText('itemPreview.fulfillment')).toBeNull()
    expect(screen.queryByText('itemPreview.pickup')).toBeNull()
    expect(mocks.group).not.toHaveBeenCalled()
  })
})
