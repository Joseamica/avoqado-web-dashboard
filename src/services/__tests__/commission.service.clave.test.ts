// ft-graves, D-D1: lo que crea algo en Comisiones manda `Idempotency-Key` cuando la pantalla le da una clave; sin clave, la
// petición es la de siempre (un servidor viejo no la necesita y un cliente viejo no la manda).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { commissionService } from '../commission.service'

const m = vi.hoisted(() => ({ post: vi.fn(async (..._args: unknown[]) => ({ data: { id: 'x' } })) }))
vi.mock('@/api', () => ({ default: { post: m.post } }))

const cabecera = (llamada = 0) => (m.post.mock.calls[llamada]?.[2] as { headers?: Record<string, string> } | undefined)?.headers

beforeEach(() => vi.clearAllMocks())

describe('commissionService: Idempotency-Key al crear', () => {
  it.each([
    ['createConfig', () => commissionService.createConfig('v1', { name: 'a' } as never, 'k1')],
    ['createOrgConfig', () => commissionService.createOrgConfig('v1', { name: 'a' } as never, 'k1')],
    ['createTier', () => commissionService.createTier('v1', 'c1', { tierLevel: 1 } as never, 'k1')],
    ['createTiersBatch', () => commissionService.createTiersBatch('v1', 'c1', [], 'k1')],
    ['createOverride', () => commissionService.createOverride('v1', 'c1', { staffId: 's1' } as never, 'k1')],
    ['createSalesGoal', () => commissionService.createSalesGoal('v1', { goal: 1 } as never, 'k1')],
  ])('🔴 %s manda la clave en la cabecera', async (_nombre, llamar) => {
    await llamar()
    expect(cabecera()).toEqual({ 'Idempotency-Key': 'k1' })
  })

  it('sin clave, no manda cabecera (la petición de siempre)', async () => {
    await commissionService.createConfig('v1', { name: 'a' } as never)
    expect(m.post.mock.calls[0][2]).toBeUndefined()
  })
})
