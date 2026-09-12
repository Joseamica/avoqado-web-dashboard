/**
 * El espejo del saneado del servidor. Los caracteres se construyen con `fromCharCode` a
 * propósito: un escape `\uXXXX` dentro del literal puede acabar como byte CRUDO e invisible en
 * el archivo, y entonces la prueba pasaría sin ejercitar lo que dice ejercitar.
 */
import { describe, expect, it } from 'vitest'

import { MAX_CARACTERES, MAX_RENGLONES, revisarTexto } from '../textoImprimible'

const ESC = String.fromCharCode(0x1b)
const GS = String.fromCharCode(0x1d)
const NUL = String.fromCharCode(0x00)
const RLO = String.fromCharCode(0x202e)
const ZWSP = String.fromCharCode(0x200b)

describe('revisarTexto', () => {
  it('acepta español con acentos, ñ y signos ¿¡', () => {
    expect(revisarTexto('¡Gracias por tu compra, Ñoño! ¿Vuelves?')).toEqual({ ok: true })
  })

  it('🔴 caza ESC y GS: son comandos de impresora, no texto', () => {
    expect(revisarTexto(`hola${ESC}m`)).toMatchObject({ ok: false, motivo: 'control' })
    expect(revisarTexto(`hola${GS}V${NUL}`)).toMatchObject({ ok: false, motivo: 'control' })
    expect(revisarTexto('a\tb')).toMatchObject({ ok: false, motivo: 'control' })
  })

  it('caza bidi y ancho cero', () => {
    expect(revisarTexto(`a${RLO}b`)).toMatchObject({ ok: false, motivo: 'bidi' })
    expect(revisarTexto(`a${ZWSP}b`)).toMatchObject({ ok: false, motivo: 'zeroWidth' })
  })

  it('🔴 caza lo que el papel NO imprime, y DICE cuál es', () => {
    // Sin el carácter concreto, el aviso es «algo está mal» y el dueño no sabe qué borrar.
    expect(revisarTexto('Gracias 🙏')).toEqual({ ok: false, motivo: 'nonLatin1', offending: '🙏' })
    expect(revisarTexto('謝謝')).toMatchObject({ ok: false, motivo: 'nonLatin1' })
  })

  it('normaliza a NFC antes de juzgar: la e + tilde combinada es un solo carácter válido', () => {
    // Sin normalizar, la tilde combinada (U+0301) es Latin-1 ajeno y «café» saldría rechazado.
    expect(revisarTexto('café')).toEqual({ ok: true })
  })

  it('los topes coinciden con los del servidor: 48 caracteres y 6 renglones', () => {
    expect(MAX_CARACTERES).toBe(48)
    expect(MAX_RENGLONES).toBe(6)
  })
})
