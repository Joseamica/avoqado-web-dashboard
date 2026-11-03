/**
 * La atribución que viaja de un anuncio al alta (§3.5 del spec de campañas ligeras).
 *
 * 🔴 Lo que esta prueba protege: el registro NUNCA se rompe por un dato de marketing. Un
 * `?oferta=` basura, un sessionStorage bloqueado o una caducidad vencida dejan el alta EXACTAMENTE
 * igual que si nadie hubiera hecho clic en un anuncio; lo único que se pierde es la atribución.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ACQUISITION_STORAGE_KEY, ACQUISITION_TTL_MS, capturarAtribucion, leerAtribucion, limpiarAtribucion, UTM_KEYS } from '../acquisition'

function almacenFalso() {
  const datos = new Map<string, string>()
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
    removeItem: (k: string) => void datos.delete(k),
    datos,
  }
}

let almacen: ReturnType<typeof almacenFalso>

beforeEach(() => {
  almacen = almacenFalso()
  Object.defineProperty(window, 'sessionStorage', { value: almacen, writable: true, configurable: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('UTM_KEYS', () => {
  it('es EXACTAMENTE la lista permitida del servidor — una llave de más se descarta allá y engaña aquí', () => {
    expect([...UTM_KEYS]).toEqual([
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'gclid',
      'gbraid',
      'wbraid',
      'fbclid',
      'msclkid',
    ])
  })
})

describe('capturarAtribucion', () => {
  it('guarda el valor de ?oferta y solo las UTMs de la lista', () => {
    const guardado = capturarAtribucion('?oferta=pos-22&utm_source=google&utm_medium=cpc&pepe=1&gclid=abc')
    expect(guardado?.offerParam).toBe('pos-22')
    expect(guardado?.utm).toEqual({ utm_source: 'google', utm_medium: 'cpc', gclid: 'abc' })
    expect(guardado?.utm).not.toHaveProperty('pepe')
  })

  it('sin oferta ni UTMs no escribe nada', () => {
    expect(capturarAtribucion('?foo=bar')).toBeNull()
    expect(almacen.datos.size).toBe(0)
  })

  it('un ?oferta= vacío no cuenta como atribución', () => {
    expect(capturarAtribucion('?oferta=%20%20')).toBeNull()
  })

  it('recorta valores larguísimos (el servidor corta a 200; mandar más es basura)', () => {
    const guardado = capturarAtribucion(`?utm_campaign=${'x'.repeat(500)}`)
    expect(guardado?.utm.utm_campaign).toHaveLength(200)
  })

  it('un sessionStorage que revienta (modo privado, cookies bloqueadas) NO tumba la captura', () => {
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: () => {
          throw new Error('bloqueado')
        },
        setItem: () => {
          throw new Error('bloqueado')
        },
        removeItem: () => {},
      },
      writable: true,
      configurable: true,
    })
    expect(() => capturarAtribucion('?oferta=pos-22')).not.toThrow()
    expect(capturarAtribucion('?oferta=pos-22')?.offerParam).toBe('pos-22')
  })

  it('el último toque gana: una visita nueva con otra oferta reemplaza a la anterior', () => {
    capturarAtribucion('?oferta=pos-22&utm_source=google')
    capturarAtribucion('?oferta=retail-99&utm_source=meta')
    expect(leerAtribucion()?.offerParam).toBe('retail-99')
    expect(leerAtribucion()?.utm.utm_source).toBe('meta')
  })

  it('una visita sin parámetros NO borra la atribución que ya se había capturado', () => {
    capturarAtribucion('?oferta=pos-22')
    capturarAtribucion('')
    expect(leerAtribucion()?.offerParam).toBe('pos-22')
  })
})

describe('capturarAtribucion — de qué sitio llegó (referrer)', () => {
  // jsdom sirve la página en http://localhost:3000 (host del dashboard en la prueba).
  it('guarda sólo el HOST de un referrer externo: https://avoqado.io/ → avoqado.io', () => {
    const guardado = capturarAtribucion('', 'https://Avoqado.io/precios?x=1#a')
    expect(guardado?.referrer).toBe('avoqado.io')
    expect(leerAtribucion()?.referrer).toBe('avoqado.io')
  })

  it('quita el puerto y la ruta', () => {
    expect(capturarAtribucion('', 'http://landing.avoqado.io:8080/alta')?.referrer).toBe('landing.avoqado.io')
  })

  it('un referrer del MISMO dashboard no cuenta (navegar dentro de la app no es llegar de fuera)', () => {
    expect(capturarAtribucion('', `${window.location.origin}/login`)).toBeNull()
    expect(almacen.datos.size).toBe(0)
  })

  it('vacío, inválido o con caracteres raros se ignora', () => {
    expect(capturarAtribucion('', '')).toBeNull()
    expect(capturarAtribucion('', 'no es una url')).toBeNull()
    expect(capturarAtribucion('', 'https://[::1]/')).toBeNull()
    expect(capturarAtribucion('', `https://${'a'.repeat(101)}.mx/`)).toBeNull()
    expect(almacen.datos.size).toBe(0)
  })

  it('viaja junto con la oferta y las UTMs en el mismo sobre', () => {
    const guardado = capturarAtribucion('?oferta=pos-22&utm_source=google', 'https://www.google.com/')
    expect(guardado).toMatchObject({ offerParam: 'pos-22', utm: { utm_source: 'google' }, referrer: 'www.google.com' })
  })

  it('una visita sin referrer NO borra el que ya estaba', () => {
    capturarAtribucion('', 'https://avoqado.io/')
    capturarAtribucion('?oferta=pos-22', '')
    expect(leerAtribucion()).toMatchObject({ offerParam: 'pos-22', referrer: 'avoqado.io' })
  })

  it('una visita con SÓLO referrer conserva la oferta y las UTMs que ya estaban', () => {
    capturarAtribucion('?oferta=pos-22&utm_source=meta', '')
    capturarAtribucion('', 'https://avoqado.io/')
    expect(leerAtribucion()).toMatchObject({ offerParam: 'pos-22', utm: { utm_source: 'meta' }, referrer: 'avoqado.io' })
  })

  it('🔴 una visita con sólo referrer NO alarga la vida de la oferta guardada (caduca a las 24 h de su captura)', () => {
    vi.useFakeTimers()
    const t0 = new Date('2026-10-28T10:00:00Z').getTime()
    vi.setSystemTime(t0)
    capturarAtribucion('?oferta=pos-22&utm_source=meta', '')

    vi.setSystemTime(t0 + 23 * 60 * 60 * 1000)
    capturarAtribucion('', 'https://avoqado.io/')
    expect(leerAtribucion()).toMatchObject({ offerParam: 'pos-22', referrer: 'avoqado.io' })

    vi.setSystemTime(t0 + 25 * 60 * 60 * 1000)
    expect(leerAtribucion()).toBeNull()
  })

  it('una visita con sólo referrer y sin nada vigente guardado se guarda con fecha nueva', () => {
    vi.useFakeTimers()
    const t0 = new Date('2026-10-28T10:00:00Z').getTime()
    vi.setSystemTime(t0)
    capturarAtribucion('?oferta=pos-22', '')

    vi.setSystemTime(t0 + 25 * 60 * 60 * 1000) // la oferta ya caducó
    capturarAtribucion('', 'https://avoqado.io/')
    expect(leerAtribucion()).toMatchObject({ offerParam: null, utm: {}, referrer: 'avoqado.io' })

    vi.setSystemTime(t0 + 48 * 60 * 60 * 1000) // 23 h después del referrer: sigue vigente
    expect(leerAtribucion()?.referrer).toBe('avoqado.io')
  })

  it('un referrer alterado en el almacenamiento no se lee', () => {
    almacen.datos.set(
      ACQUISITION_STORAGE_KEY,
      JSON.stringify({ offerParam: null, utm: {}, referrer: 'https://x.com/<script>', savedAt: new Date().toISOString() }),
    )
    expect(leerAtribucion()?.referrer).toBeNull()
  })
})

describe('leerAtribucion', () => {
  it('caduca a las 24 h', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-17T10:00:00Z'))
    capturarAtribucion('?oferta=pos-22')

    vi.setSystemTime(new Date('2026-09-17T10:00:00Z').getTime() + ACQUISITION_TTL_MS - 1000)
    expect(leerAtribucion()?.offerParam).toBe('pos-22')

    vi.setSystemTime(new Date('2026-09-17T10:00:00Z').getTime() + ACQUISITION_TTL_MS + 1000)
    expect(leerAtribucion()).toBeNull()
  })

  it('un JSON corrupto se lee como «no hay atribución», no como un error', () => {
    almacen.datos.set(ACQUISITION_STORAGE_KEY, '{{{')
    expect(leerAtribucion()).toBeNull()
  })

  it('una fecha ilegible se descarta en vez de dar por buena una atribución eterna', () => {
    almacen.datos.set(ACQUISITION_STORAGE_KEY, JSON.stringify({ offerParam: 'pos-22', utm: {}, savedAt: 'ayer' }))
    expect(leerAtribucion()).toBeNull()
  })

  it('limpiarAtribucion la borra', () => {
    capturarAtribucion('?oferta=pos-22')
    limpiarAtribucion()
    expect(leerAtribucion()).toBeNull()
  })
})
