/**
 * D6 (12-nov): `src/api.ts` repetía SOLO cualquier petición que perdía la respuesta por un error de red, también un POST de
 * reembolso o de pago manual. Si el servidor ya lo había registrado (se perdió la respuesta, no la petición), la repetición lo
 * registraba otra vez: dos reembolsos o dos pagos.
 *
 * Ahora sólo se repiten solas las peticiones que no escriben (GET/HEAD/OPTIONS) y las escrituras que el servidor reconoce al
 * repetirse: llevan la llave de la operación (`Idempotency-Key`, o `idempotencyKey`/`operationKey` en el cuerpo) o el token de
 * edición (`expectedEditToken`, un 409 si la primera ya cambió el diseño). Usa la instancia de axios de verdad con un adaptador
 * falso: lo que se cuenta es cuántas veces sale la petición.
 */
import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import api from '@/api'

const adaptadorOriginal = api.defaults.adapter
afterEach(() => {
  api.defaults.adapter = adaptadorOriginal
})

const sinRed = (config: InternalAxiosRequestConfig) => new AxiosError('Network Error', AxiosError.ERR_NETWORK, config)
const ok = (config: InternalAxiosRequestConfig) => ({ status: 200, statusText: 'OK', headers: {}, config, data: { success: true } })

/** La primera petición se pierde por la red; la segunda (si la hay) contesta 200. Devuelve cuántas salieron y cómo terminó. */
async function cortarLaPrimera(hacer: () => Promise<unknown>) {
  let salidas = 0
  api.defaults.adapter = async config => {
    salidas += 1
    if (salidas === 1) throw sinRed(config)
    return ok(config)
  }
  try {
    await hacer()
    return { salidas, fallo: null as AxiosError | null }
  } catch (error) {
    return { salidas, fallo: error as AxiosError }
  }
}

const REEMBOLSO = '/api/v1/dashboard/venues/v1/payments/p1/refund'
const PAGO_MANUAL = '/api/v1/dashboard/venues/v1/payments/manual'

describe('D6 · el panel no repite solo un POST sin llave (crea algo: un reembolso, un pago, un registro)', () => {
  it('🔴 reembolso: si se corta la red, sale UNA vez y la persona ve el error (no dos reembolsos)', async () => {
    const r = await cortarLaPrimera(() => api.post(REEMBOLSO, { reason: 'OTHER', amount: 5000 }))
    expect(r.salidas).toBe(1)
    expect(r.fallo?.code).toBe(AxiosError.ERR_NETWORK)
    expect((r.fallo?.config as { _retry?: unknown } | undefined)?._retry).not.toBe(true)
  })

  it('🔴 pago manual: sale UNA vez', async () => {
    const r = await cortarLaPrimera(() => api.post(PAGO_MANUAL, { amount: '100.00', method: 'CASH', source: 'OTHER' }))
    expect(r.salidas).toBe(1)
    expect(r.fallo?.code).toBe(AxiosError.ERR_NETWORK)
  })

  it('un POST cualquiera sin llave (crear un producto) sale UNA vez', async () => {
    const r = await cortarLaPrimera(() => api.post('/api/v1/dashboard/venues/v1/products', { name: 'Café' }))
    expect(r.salidas).toBe(1)
  })

  it('una escritura marcada `repetible: false` sale UNA vez aunque sea PUT', async () => {
    const r = await cortarLaPrimera(() => api.put('/api/v1/dashboard/venues/v1/x/1', { a: 1 }, { repetible: false }))
    expect(r.salidas).toBe(1)
  })

  it('una llave vacía no cuenta como llave', async () => {
    const r = await cortarLaPrimera(() => api.post(REEMBOLSO, { reason: 'OTHER', amount: 5000, idempotencyKey: '' }))
    expect(r.salidas).toBe(1)
  })

  it('un formulario con archivo (FormData) sale UNA vez', async () => {
    const form = new FormData()
    form.append('file', new Blob(['x']), 'logo.png')
    const r = await cortarLaPrimera(() => api.post('/api/v1/dashboard/venues/v1/x/assets', form))
    expect(r.salidas).toBe(1)
  })
})

describe('D6 · lo que sí se sigue repitiendo solo (como antes de D6)', () => {
  // Rediseño tras Codex r2-r5 (13-nov): PUT/PATCH/DELETE se repiten como antes. Quitarles el reenvío cambiaba 337 pantallas que
  // contaban con él y decían «error» cuando sí se había guardado (r3 pago de clase, r5 Configuración de la terminal).
  it.each(['put', 'patch', 'delete'] as const)('%s sin llave se repite, como antes de D6', async metodo => {
    const r = await cortarLaPrimera(() =>
      metodo === 'delete' ? api.delete('/api/v1/dashboard/venues/v1/x/1') : api[metodo]('/api/v1/dashboard/venues/v1/x/1', { a: 1 }),
    )
    expect(r.salidas).toBe(2)
    expect(r.fallo).toBeNull()
  }, 10_000)

  it('una lectura (GET) se repite y la persona ni se entera', async () => {
    const r = await cortarLaPrimera(() => api.get('/api/v1/dashboard/venues/v1/payments'))
    expect(r.salidas).toBe(2)
    expect(r.fallo).toBeNull()
  }, 10_000)

  it.each([
    ['operationKey en el cuerpo (tarjetas de regalo)', { operationKey: 'op-123456789' }],
    ['idempotencyKey en el cuerpo (merma, SPEI)', { idempotencyKey: 'k-123456789' }],
    ['expectedEditToken en el cuerpo (pantalla del cliente)', { expectedEditToken: 'd1:1', design: {} }],
    ['clientKey en el cuerpo (pago de una clase, ajuste manual, compra de plan; Codex r3)', { clientKey: 'k-123456789', amount: 1 }],
    ['solicitudId en el cuerpo (liquidar una diferencia de pago al personal)', { solicitudId: 's-123456789', huellaEsperada: 'h' }],
    ['saveId en el cuerpo (plano de mesas)', { saveId: 'save-1' }],
  ])('una escritura con %s se repite', async (_nombre, cuerpo) => {
    const r = await cortarLaPrimera(() => api.post('/api/v1/dashboard/venues/v1/x', cuerpo))
    expect(r.salidas).toBe(2)
    expect(r.fallo).toBeNull()
  }, 10_000)

  it('una escritura marcada `repetible` (el servidor la aguanta repetida, p. ej. liberar la terminal) se repite', async () => {
    const r = await cortarLaPrimera(() =>
      api.post('/api/v1/dashboard/superadmin/terminals/payment-requests/r1/release', { venueId: 'v1', reason: 'x' }, { repetible: true }),
    )
    expect(r.salidas).toBe(2)
    expect(r.fallo).toBeNull()
  }, 10_000)

  it('el plano de mesas (PUT con `saveId`, marcado `repetible`) se repite con el MISMO cuerpo (Codex r2)', async () => {
    const { publishFloorPlan } = await import('@/services/floorPlan.service')
    const cuerpos: unknown[] = []
    let salidas = 0
    api.defaults.adapter = async config => {
      salidas += 1
      cuerpos.push(JSON.parse(config.data as string))
      if (salidas === 1) throw sinRed(config)
      return { ...ok(config), data: { success: true, data: { saved: true } } }
    }
    await publishFloorPlan('v1', { saveId: 'save-1' } as never)
    expect(salidas).toBe(2)
    expect(cuerpos[1]).toEqual(cuerpos[0])
  }, 10_000)

  it('confirmar una visita de pases (el servidor la aguanta repetida) se repite', async () => {
    const { confirmPassVisit } = await import('@/services/passes.service')
    let salidas = 0
    api.defaults.adapter = async config => {
      salidas += 1
      if (salidas === 1) throw sinRed(config)
      return { ...ok(config), data: { success: true, data: { id: 'visita-1', status: 'ALREADY_CONFIRMED' } } }
    }
    await confirmPassVisit('v1', 'visita-1')
    expect(salidas).toBe(2)
  }, 10_000)

  it('los ajustes de una terminal (PUT) se repiten: la Configuración y los pasos del cobro cuentan con eso (Codex r5)', async () => {
    const { tpvSettingsService } = await import('@/services/tpv-settings.service')
    const r = await cortarLaPrimera(() => tpvSettingsService.updateSettings('tpv-1', { showReviewScreen: false }))
    expect(r.salidas).toBe(2)
    expect(r.fallo).toBeNull()
  }, 10_000)

  it('una escritura con el encabezado Idempotency-Key se repite', async () => {
    const r = await cortarLaPrimera(() =>
      api.post('/api/v1/dashboard/venues/v1/orders/o1/card-refund', { amount: '10.00' }, { headers: { 'Idempotency-Key': 'k-1' } }),
    )
    expect(r.salidas).toBe(2)
    expect(r.fallo).toBeNull()
  }, 10_000)
})
