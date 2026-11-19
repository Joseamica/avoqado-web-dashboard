import { afterEach, expect, it, vi } from 'vitest'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import api from '@/api'
import {
  getSupportStatus,
  requestSupportCode,
  verifySupportCode,
  unlinkSupportPhone,
  grantSupportDataAccess,
} from '../supportWhatsapp.service'

const originalAdapter = api.defaults.adapter
afterEach(() => {
  api.defaults.adapter = originalAdapter
  vi.useRealTimers()
})
// Verify is NOT in this list: see the test below. Unlink is: unlinking twice changes nothing on the server.
it.each(['status', 'challenge', 'unlink'])('keeps the original actor through api.ts network retry for %s', async action => {
  vi.useFakeTimers()
  const actors: string[] = []
  let cookieActor = 'person-A'
  const effects: string[] = []
  api.defaults.adapter = async config => {
    const expectedActor = AxiosHeaders.from(config.headers).get('X-Support-Staff-Id') as string
    actors.push(expectedActor)
    if (actors.length === 1) {
      cookieActor = 'person-B'
      throw new AxiosError('Network Error', 'ERR_NETWORK', config)
    }
    const response: AxiosResponse = {
      config,
      status: 403,
      statusText: 'Forbidden',
      headers: {},
      data: { code: 'SUPPORT_IDENTITY_CHANGED' },
    }
    if (expectedActor !== cookieActor) throw new AxiosError('Identity changed', 'ERR_BAD_REQUEST', config, undefined, response)
    effects.push(cookieActor)
    return { ...response, status: 200, data: { linked: false } }
  }
  const request =
    action === 'status'
      ? getSupportStatus('person-A')
      : action === 'challenge'
        ? requestSupportCode('person-A', { phone: '+525511112222', operationKey: 'stable-operation', personalPhone: true })
        : unlinkSupportPhone('person-A')
  const outcome = request.catch(error => error)
  await vi.advanceTimersByTimeAsync(1001)
  expect((await outcome).response.data.code).toBe('SUPPORT_IDENTITY_CHANGED')
  expect(actors).toEqual(['person-A', 'person-A'])
  expect(effects).toEqual([])
})
// The server counts every wrong code (5 and the code dies). If it saved the attempt and only the RESPONSE was lost,
// repeating the POST alone would spend a second attempt the person never made: three attempts would become five.
it('sends verify once when the response is lost, and hands the network error to the caller', async () => {
  vi.useFakeTimers()
  let attemptsOnServer = 3
  const sent: string[] = []
  api.defaults.adapter = async config => {
    sent.push(`${config.method} ${config.url}`)
    attemptsOnServer += 1
    throw new AxiosError('Network Error', 'ERR_NETWORK', config)
  }
  const outcome = verifySupportCode('person-A', { challengeId: 'c123456789012345678901234', code: '000000' }).catch(error => error)
  await vi.advanceTimersByTimeAsync(5000)
  const error = await outcome
  expect(sent).toEqual(['post /api/v1/me/support-whatsapp/verify'])
  expect(attemptsOnServer).toBe(4)
  expect(error.code).toBe('ERR_NETWORK')
  expect(error.response).toBeUndefined()
})

// The server dates every permission POST with its own clock (T-B29): a lost response repeated on its own a second after
// midnight would authorize the next day without a tap. Both tests fail if the POST is marked `repetible` or gains a key.
const grant = () => grantSupportDataAccess('person-A', { venueId: 'v1', noticeHash: 'a'.repeat(64), language: 'es', acceptNotice: true })

it('the permission POST goes out exactly once when its response is lost, and the error reaches the caller (T-B29)', async () => {
  vi.useFakeTimers()
  const sent: string[] = []
  api.defaults.adapter = async config => {
    sent.push(`${config.method} ${config.url}`)
    throw new AxiosError('Network Error', 'ERR_NETWORK', config)
  }
  const outcome = grant().catch(error => error)
  await vi.advanceTimersByTimeAsync(10_000) // de sobra para cualquier reintento de api.ts
  const error = await outcome
  expect(error).toBeInstanceOf(AxiosError)
  expect(error.code).toBe('ERR_NETWORK')
  expect(sent).toEqual(['post /api/v1/me/support-whatsapp/data-access'])
})
it('response lost just before midnight: no second POST goes out on its own, so no unlock is born for the next day (T-B29)', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-13T05:59:59.500Z')) // 23:59:59.5 del jueves 12-nov-2026 en Ciudad de México
  const daysAuthorized: string[] = [] // lo que haría el servidor: un desbloqueo por cada día en que le LLEGA un POST
  api.defaults.adapter = async config => {
    if (config.method === 'post') daysAuthorized.push(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }))
    throw new AxiosError('Network Error', 'ERR_NETWORK', config) // el servidor sí lo guardó; la respuesta se perdió
  }
  const outcome = grant().catch(error => error)
  await vi.advanceTimersByTimeAsync(10_000) // ya es viernes 13 en la sucursal
  expect((await outcome).code).toBe('ERR_NETWORK')
  expect(daysAuthorized).toEqual(['2026-11-12']) // con la repetición automática habría sido ['2026-11-12', '2026-11-13']
})
// T-B37: «Aceptar» in the dialog sends acceptNotice: true; the one tap outside it sends false, and with false the server never
// records an acceptance. The body carries exactly these four fields.
it.each([true, false])('the permission POST sends venue, notice hash, language and acceptNotice: %s', async acceptNotice => {
  const bodies: unknown[] = []
  api.defaults.adapter = async config => {
    bodies.push(JSON.parse(config.data))
    const data = { accepted: true, unlocked: true, venueName: 'Norte', notice: { text: 'AVISO', hash: 'a'.repeat(64) } }
    return { config, status: 200, statusText: 'OK', headers: {}, data }
  }
  await grantSupportDataAccess('person-A', { venueId: 'v1', noticeHash: 'a'.repeat(64), language: 'es', acceptNotice })
  expect(bodies).toEqual([{ venueId: 'v1', noticeHash: 'a'.repeat(64), language: 'es', acceptNotice }])
})
