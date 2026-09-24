import { beforeEach, describe, expect, it } from 'vitest'
import {
  GOOGLE_SIGNUP_INTENT_KEY,
  GOOGLE_SIGNUP_INTENT_TTL_MS,
  guardarIntentoDeAltaGoogle,
  tomarIntentoDeAltaGoogle,
} from '../googleSignupIntent'

function almacenFalso() {
  const datos = new Map<string, string>()
  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: (k: string) => datos.get(k) ?? null,
      setItem: (k: string, v: string) => void datos.set(k, v),
      removeItem: (k: string) => void datos.delete(k),
    },
    writable: true,
    configurable: true,
  })
  return datos
}

describe('intento de alta con Google', () => {
  let datos: Map<string, string>
  beforeEach(() => {
    datos = almacenFalso()
  })

  it('lo que se guarda antes de ir a Google vuelve igual al regresar', () => {
    guardarIntentoDeAltaGoogle({ legalVersion: 'v1', launchCampaignCode: 'POS22MX', utm: { utm_source: 'google' } }, 1000)
    expect(tomarIntentoDeAltaGoogle(2000)).toEqual({ legalVersion: 'v1', launchCampaignCode: 'POS22MX', utm: { utm_source: 'google' } })
  })

  it('🔴 se consume UNA vez: un intento viejo no convierte en alta un inicio de sesión posterior', () => {
    guardarIntentoDeAltaGoogle({ legalVersion: 'v1' }, 1000)
    expect(tomarIntentoDeAltaGoogle(2000)).not.toBeNull()
    expect(tomarIntentoDeAltaGoogle(3000)).toBeNull()
  })

  it('🔴 caduca: pasado el plazo ya no es un alta', () => {
    guardarIntentoDeAltaGoogle({ legalVersion: 'v1' }, 0)
    expect(tomarIntentoDeAltaGoogle(GOOGLE_SIGNUP_INTENT_TTL_MS + 1)).toBeNull()
  })

  it('sin versión legal no hay intento (sin casilla no hay alta)', () => {
    datos.set(GOOGLE_SIGNUP_INTENT_KEY, JSON.stringify({ savedAt: 1000, launchCampaignCode: 'X' }))
    expect(tomarIntentoDeAltaGoogle(2000)).toBeNull()
  })

  it('un valor corrupto no revienta: simplemente no hay intento', () => {
    datos.set(GOOGLE_SIGNUP_INTENT_KEY, '{no es json')
    expect(tomarIntentoDeAltaGoogle(2000)).toBeNull()
  })

  it('un sessionStorage bloqueado no revienta ni al guardar ni al leer', () => {
    Object.defineProperty(window, 'sessionStorage', {
      get() {
        throw new Error('bloqueado')
      },
      configurable: true,
    })
    expect(() => guardarIntentoDeAltaGoogle({ legalVersion: 'v1' })).not.toThrow()
    expect(tomarIntentoDeAltaGoogle()).toBeNull()
  })
})
