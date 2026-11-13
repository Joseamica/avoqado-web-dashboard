import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enviosSinConfirmar, llaveNueva, olvidar, olvidarTodo, quedoSinConfirmar, reservar, resolver } from '../llaveDeEnvio'

/** D1: la llave de un envío se anota ANTES de mandarlo y sólo SU respuesta definitiva la borra. */
describe('llave de envío anotada antes de mandar (D1, Codex r2)', () => {
  // `src/test/setup.ts` deja `localStorage` como funciones vacías: aquí se le pone uno que sí guarda, como el del navegador.
  let guardado: Record<string, string> = {}
  beforeEach(() => {
    guardado = {}
    vi.mocked(localStorage.getItem).mockImplementation((k: string) => guardado[k] ?? null)
    vi.mocked(localStorage.setItem).mockImplementation((k: string, v: string) => {
      guardado[k] = v
    })
    olvidarTodo()
  })
  afterEach(() => olvidarTodo())

  const contador = () => {
    let n = 0
    return () => `llave-${++n}`
  }

  it('se anota ANTES de mandar: recargar o salir a media petición no la pierde (Codex r2 #3)', () => {
    reservar('pago-manual:v1', 'A', 100, contador())
    const enDisco = JSON.parse(guardado['avq-envios-sin-confirmar:v2'] ?? '{}')
    expect(enDisco['pago-manual:v1'].A.llave).toBe('llave-1')
  })

  it('🔴 el mismo contenido reusa su llave (en duda o todavía en vuelo)', () => {
    const nueva = contador()
    expect(reservar('pago-manual:v1', 'A', 100, nueva)).toEqual({ llave: 'llave-1', reusada: false })
    expect(reservar('pago-manual:v1', 'A', 100, nueva)).toEqual({ llave: 'llave-1', reusada: true })
  })

  it('🔴 otro envío no borra la anotación de A (Codex r2 #2: A en duda, B confirmado, reintentar A no duplica)', () => {
    const nueva = contador()
    reservar('pago-manual:v1', 'A', 100, nueva)
    quedoSinConfirmar('pago-manual:v1', 'A')
    reservar('pago-manual:v1', 'B', 120, nueva)
    resolver('pago-manual:v1', 'B')

    expect(reservar('pago-manual:v1', 'A', 100, nueva)).toEqual({ llave: 'llave-1', reusada: true })
  })

  it('la respuesta definitiva borra SÓLO su anotación; «Es otro» igual', () => {
    const nueva = contador()
    reservar('pago-manual:v1', 'A', 100, nueva)
    reservar('pago-manual:v1', 'B', 120, nueva)
    resolver('pago-manual:v1', 'A')
    expect(enviosSinConfirmar('pago-manual:v1').map(e => e.huella)).toEqual(['B'])
    olvidar('pago-manual:v1', 'B')
    expect(enviosSinConfirmar('pago-manual:v1')).toEqual([])
    expect(reservar('pago-manual:v1', 'B', 120, nueva).reusada).toBe(false)
  })

  it('otro ámbito (otro negocio u otro pago) no ve la anotación', () => {
    reservar('reembolso:v1:p1', 'A', 50, contador())
    expect(enviosSinConfirmar('reembolso:v1:p2')).toEqual([])
    expect(enviosSinConfirmar('reembolso:v2:p1')).toEqual([])
  })

  it('🔴 lo que anota OTRA pestaña también cuenta (Codex r2 #4): se lee de localStorage al llegar su evento', () => {
    guardado['avq-envios-sin-confirmar:v2'] = JSON.stringify({
      'pago-manual:v1': { A: { llave: 'de-otra-pestana', monto: 100, desde: Date.now() } },
    })
    window.dispatchEvent(new StorageEvent('storage', { key: 'avq-envios-sin-confirmar:v2' }))

    expect(reservar('pago-manual:v1', 'A', 100, contador())).toEqual({ llave: 'de-otra-pestana', reusada: true })
  })

  it('a las 24 h vence', () => {
    const hace25h = Date.now() - 25 * 60 * 60 * 1000
    reservar('pago-manual:v1', 'A', 100, contador(), hace25h)
    expect(enviosSinConfirmar('pago-manual:v1')).toEqual([])
    expect(reservar('pago-manual:v1', 'A', 100, () => 'nueva').reusada).toBe(false)
  })

  it('la llave real cabe en lo que acepta el servidor', () => {
    expect(llaveNueva()).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
  })
})
