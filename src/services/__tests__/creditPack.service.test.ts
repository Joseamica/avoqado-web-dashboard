import { beforeEach, describe, expect, it, vi } from 'vitest'

// El SERVIDOR manda los Decimal de Prisma como TEXTO («1450»). Si el formulario de editar los recibe así, los devuelve
// así al guardar y la validación del servidor (`price: z.number()`) contesta «Se esperaba un número y llegó texto»
// (Mindform BSF, 22-nov-2026). El servicio es la única puerta por la que entran los paquetes al panel.
const mockGet = vi.fn()
vi.mock('@/api', () => ({
  default: { get: (...args: unknown[]) => mockGet(...args) },
}))

import { creditPackService } from '@/services/creditPack.service'

const paqueteDelServidor = {
  id: 'cp1',
  name: '5',
  price: '1450',
  currency: 'MXN',
  validityDays: 15,
  maxPerCustomer: null,
  items: [{ id: 'i1', productId: 'p1', quantity: 4, product: { id: 'p1', name: '5 Sesiones', type: 'SERVICE', price: '290.5' } }],
}

describe('creditPackService: el precio llega como número', () => {
  beforeEach(() => mockGet.mockReset())

  it('getCreditPack convierte el precio del paquete y el de sus productos a número', async () => {
    mockGet.mockResolvedValue({ data: paqueteDelServidor })
    const pack = await creditPackService.getCreditPack('v1', 'cp1')
    expect(pack.price).toBe(1450)
    expect(pack.items[0].product.price).toBe(290.5)
  })

  it('getCreditPacks convierte el precio de cada paquete', async () => {
    mockGet.mockResolvedValue({ data: [paqueteDelServidor, { ...paqueteDelServidor, id: 'cp2', price: 99 }] })
    const packs = await creditPackService.getCreditPacks('v1')
    expect(packs.map(p => p.price)).toEqual([1450, 99])
  })

  it('no inventa campos ni toca el resto del paquete', async () => {
    mockGet.mockResolvedValue({ data: paqueteDelServidor })
    const pack = await creditPackService.getCreditPack('v1', 'cp1')
    expect(pack.validityDays).toBe(15)
    expect(pack.maxPerCustomer).toBeNull()
    expect(pack.items[0].quantity).toBe(4)
  })
})
