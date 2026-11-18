/**
 * Tarjeta `hz:nube0000:na1d52b5` (17-nov-2026), Codex r3 #7: la recomendación del asistente «Nuevo producto» lleva tiempo límite. Sin él,
 * una petición colgada dejaba la sección en «Cargando…» sin fin (el cliente HTTP no tiene un tiempo límite general).
 */
import { describe, expect, it, vi } from 'vitest'

const http = vi.hoisted(() => ({ get: vi.fn().mockResolvedValue({ data: { data: {} } }) }))
vi.mock('@/api', () => ({ default: http }))

import { productWizardApi } from '@/services/inventory.service'

describe('productWizardApi.shouldUseInventory', () => {
  it('pide la recomendación con un tiempo límite de 15 s', async () => {
    await productWizardApi.shouldUseInventory('v1')
    expect(http.get).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/inventory/should-use-inventory', { timeout: 15_000 })
  })
})
