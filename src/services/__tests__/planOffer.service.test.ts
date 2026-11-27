import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.hoisted(() => vi.fn())
vi.mock('@/api', () => ({ default: {}, publicApi: { get } }))

import { planOfferService } from '../planOffer.service'

const precio = { netCents: 100, grossCents: 116 }
const plan = (over: Record<string, unknown> = {}) => ({
  displayName: 'Pro',
  onSale: true,
  requiresCard: true,
  trialDays: 5,
  monthly: precio,
  annual: precio,
  ...over,
})
const cuerpo = (data: Record<string, unknown> = {}, success: unknown = true) => ({
  success,
  data: { offerVersion: 2, FREE: { displayName: 'Gratis' }, PRO: plan(), PREMIUM: plan({ displayName: 'Premium' }), ...data },
})

describe('planOfferService.get valida el 200', () => {
  beforeEach(() => get.mockReset())

  it('un cuerpo válido pasa', async () => {
    get.mockResolvedValue({ data: cuerpo() })
    await expect(planOfferService.get()).resolves.toMatchObject({ offerVersion: 2 })
  })

  it('v1 (offerVersion null) acepta nombres vacíos', async () => {
    get.mockResolvedValue({ data: cuerpo({ offerVersion: null, PRO: plan({ displayName: '' }) }) })
    await expect(planOfferService.get()).resolves.toBeTruthy()
  })

  it.each([
    ['success distinto de true', cuerpo({}, 'ok')],
    ['netCents null', cuerpo({ PRO: plan({ monthly: { netCents: null, grossCents: 116 } }) })],
    ['monto negativo', cuerpo({ PRO: plan({ annual: { netCents: -5, grossCents: 116 } }) })],
    ['monto cero', cuerpo({ PREMIUM: plan({ monthly: { netCents: 100, grossCents: 0 } }) })],
    ['monto con decimales', cuerpo({ PRO: plan({ monthly: { netCents: 10.5, grossCents: 116 } }) })],
    ['onSale no booleano', cuerpo({ PRO: plan({ onSale: 'yes' }) })],
    ['trialDays negativo', cuerpo({ PRO: plan({ trialDays: -1 }) })],
    ['offerVersion de texto', cuerpo({ offerVersion: '2' })],
    ['FREE sin nombre', cuerpo({ FREE: {} })],
    ['v2 con nombre vacío', cuerpo({ PRO: plan({ displayName: '  ' }) })],
  ])('%s: lanza', async (_n, body) => {
    get.mockResolvedValue({ data: body })
    await expect(planOfferService.get()).rejects.toThrow()
  })
})
