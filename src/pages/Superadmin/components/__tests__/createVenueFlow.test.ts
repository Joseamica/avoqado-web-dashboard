import { describe, expect, it, vi } from 'vitest'
import { runCreateVenueFlow, type CreatedVenue, type CreateVenueFlowDeps } from '../createVenueFlow'

type Pago = { paymentSkipped: boolean }

function deps(overrides: Partial<CreateVenueFlowDeps<Pago>> = {}): CreateVenueFlowDeps<Pago> {
  return {
    alreadyCreated: null as CreatedVenue | null,
    createVenue: vi.fn(async () => ({ venueId: 'cv1', venueName: 'Tienda' })),
    onVenueCreated: vi.fn(),
    applyFeatureGrants: vi.fn(async () => {}),
    setupPayments: vi.fn(async () => ({ paymentSkipped: false })),
    ...overrides,
  }
}

describe('runCreateVenueFlow', () => {
  it('primer intento: crea el negocio, lo avisa antes de cobros y configura cobros', async () => {
    const d = deps()
    const r = await runCreateVenueFlow(d)
    expect(d.createVenue).toHaveBeenCalledTimes(1)
    expect(d.onVenueCreated).toHaveBeenCalledWith({ venueId: 'cv1', venueName: 'Tienda' })
    expect(d.applyFeatureGrants).toHaveBeenCalledWith('cv1')
    expect(d.setupPayments).toHaveBeenCalledWith('cv1')
    expect(r).toEqual({ venueId: 'cv1', venueName: 'Tienda', reused: false, paymentSkipped: false })
  })

  it('si cobros falla, el negocio ya quedó recordado (onVenueCreated) y el error sube', async () => {
    const d = deps({ setupPayments: vi.fn(async (): Promise<{ paymentSkipped: boolean }> => Promise.reject(new Error('Blumon caído'))) })
    await expect(runCreateVenueFlow(d)).rejects.toThrow('Blumon caído')
    expect(d.onVenueCreated).toHaveBeenCalledWith({ venueId: 'cv1', venueName: 'Tienda' })
  })

  it('reintento tras fallo de cobros: NO crea un segundo negocio ni repite funciones', async () => {
    // Recorrido real del defecto: intento 1 falla en cobros, intento 2 con lo recordado.
    let recordado: CreatedVenue | null = null
    const createVenue = vi.fn(async () => ({ venueId: 'cv1', venueName: 'Tienda' }))
    const applyFeatureGrants = vi.fn(async () => {})
    const setupPayments = vi
      .fn<(venueId: string) => Promise<{ paymentSkipped: boolean }>>()
      .mockRejectedValueOnce(new Error('Blumon caído'))
      .mockResolvedValueOnce({ paymentSkipped: false })
    const onVenueCreated = (v: CreatedVenue) => {
      recordado = v
    }

    await expect(
      runCreateVenueFlow({ alreadyCreated: recordado, createVenue, onVenueCreated, applyFeatureGrants, setupPayments }),
    ).rejects.toThrow()
    const r = await runCreateVenueFlow({ alreadyCreated: recordado, createVenue, onVenueCreated, applyFeatureGrants, setupPayments })

    expect(createVenue).toHaveBeenCalledTimes(1)
    expect(applyFeatureGrants).toHaveBeenCalledTimes(1)
    expect(setupPayments).toHaveBeenCalledTimes(2)
    expect(setupPayments).toHaveBeenLastCalledWith('cv1')
    expect(r).toEqual({ venueId: 'cv1', venueName: 'Tienda', reused: true, paymentSkipped: false })
  })

  it('si crear el negocio falla, no se recuerda nada y el reintento vuelve a crear', async () => {
    const d = deps({ createVenue: vi.fn(async () => Promise.reject(new Error('400'))) })
    await expect(runCreateVenueFlow(d)).rejects.toThrow('400')
    expect(d.onVenueCreated).not.toHaveBeenCalled()
    expect(d.setupPayments).not.toHaveBeenCalled()
  })

  it('cancelar la confirmación de posiciones devuelve paymentSkipped sin crear otro venue', async () => {
    const d = deps({ setupPayments: vi.fn(async () => ({ paymentSkipped: true })) })
    const r = await runCreateVenueFlow(d)
    expect(d.createVenue).toHaveBeenCalledTimes(1)
    expect(r.paymentSkipped).toBe(true)
  })
})
