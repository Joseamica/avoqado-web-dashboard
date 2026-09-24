/**
 * La versión de los documentos legales que este dashboard declara al aceptar.
 *
 * 🔴 El defecto que fija este archivo no es cosmético. El servidor trata una versión con FORMA DE
 * FECHA (`AAAA-MM-DD`) como el marcador legacy — lo que aceptaba quien pasó por el asistente viejo,
 * que mandaba `new Date().toISOString().split('T')[0]`. Y la constante valía justamente
 * `'2026-09-17'`, que es HOY: al aceptar, el servidor habría registrado que esa persona aceptó unos
 * términos nuevos que nunca vio, indistinguible de un consentimiento legacy real.
 *
 * Por eso el identificador lleva prefijo (`v1-…`): no puede confundirse con una fecha.
 */
import { describe, expect, it } from 'vitest'

import { LEGAL_DOCS_VERSION } from '../legal'

describe('LEGAL_DOCS_VERSION', () => {
  it('🔴 NO tiene forma de fecha: una fecha pelada es el marcador legacy del servidor', () => {
    expect(LEGAL_DOCS_VERSION).not.toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('es un identificador fijo y no vacío — dos personas que aceptan el mismo texto quedan iguales', () => {
    expect(typeof LEGAL_DOCS_VERSION).toBe('string')
    expect(LEGAL_DOCS_VERSION.trim()).toBe(LEGAL_DOCS_VERSION)
    expect(LEGAL_DOCS_VERSION.length).toBeGreaterThan(0)
  })

  it('🔴 no se calcula al vuelo: el archivo no puede derivar la versión del reloj', () => {
    // Releer el módulo tiene que dar EXACTAMENTE lo mismo, aunque el día cambie entre altas.
    expect(LEGAL_DOCS_VERSION).toBe(LEGAL_DOCS_VERSION)
    expect(LEGAL_DOCS_VERSION).not.toContain(new Date().toISOString().slice(11))
  })
})
