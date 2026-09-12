import { describe, expect, it } from 'vitest'
import { formatearDiferencia, formatearCantidad, etiquetaDeUnidad, diferenciasComoTexto, colorDeDiferencia } from './resumen'

// t de prueba: conoce dos abreviaturas y devuelve la llave para el resto (como react-i18next).
const t = ((key: string) =>
  ({ 'units.GRAM_abbr': 'g', 'units.KILOGRAM_abbr': 'kg', 'stockCounts.notCounted': 'Sin contar' })[key] ?? key) as never

describe('formatearDiferencia', () => {
  it('lleva signo explícito salvo en cero y no imprime flotantes crudos', () => {
    expect(formatearDiferencia(-6968054.083999999, 'es')).toMatch(/^[−-]6,968,054\.084$/)
    expect(formatearDiferencia(3, 'es')).toBe('+3')
    expect(formatearDiferencia(0, 'es')).toBe('0')
  })
  it('máximo 3 decimales: redondea al milésimo y conserva el signo', () => {
    // Exacto, no una expresión regular: en `/^[−-]?0\.001|^0$/` la alternancia parte el
    // patrón en dos y la primera mitad NO lleva ancla final, así que le bastaba con
    // EMPEZAR por «0.001» — medido: `0.0012345678` y `0.001abc` la satisfacían, o sea
    // que un flotante crudo pasaba. Se fija la salida real de `Intl` en es-MX.
    expect(formatearDiferencia(-0.0005, 'es')).toBe('-0.001')
    expect(formatearDiferencia(-0.0004, 'es')).toBe('0')
  })
})

describe('formatearCantidad', () => {
  it('separa miles y máximo 3 decimales, sin signo', () => {
    expect(formatearCantidad(6729329, 'es')).toBe('6,729,329')
    expect(formatearCantidad(0.5, 'es')).toBe('0.5')
  })
})

describe('etiquetaDeUnidad', () => {
  it('usa la abreviatura traducida cuando existe', () => {
    expect(etiquetaDeUnidad(t, 'GRAM')).toBe('g')
  })
  it('cae al nombre en minúsculas cuando no hay traducción', () => {
    expect(etiquetaDeUnidad(t, 'PIECE')).toBe('piece')
  })
})

describe('diferenciasComoTexto', () => {
  it('«Sin contar» cuando nadie ha capturado nada, aunque haya 138 líneas', () => {
    expect(
      diferenciasComoTexto({ itemCount: 138, countedCount: 0, matchedCount: 0, mismatchedCount: 0, differenceByUnit: [] }, t, 'es'),
    ).toBe('Sin contar')
  })
  it('una entrada por unidad, separadas por ·', () => {
    const s = diferenciasComoTexto(
      {
        itemCount: 3,
        countedCount: 3,
        matchedCount: 1,
        mismatchedCount: 2,
        differenceByUnit: [
          { unit: 'GRAM', difference: -150 },
          { unit: 'PIECE', difference: -2 },
        ],
      },
      t,
      'es',
    )
    expect(s).toMatch(/^[−-]150 g · [−-]2 piece$/)
  })
})

describe('colorDeDiferencia', () => {
  it('rojo al faltar, verde al sobrar, apagado en cero', () => {
    expect(colorDeDiferencia(-1)).toContain('text-red-700')
    expect(colorDeDiferencia(1)).toContain('text-green-700')
    expect(colorDeDiferencia(0)).toBe('text-muted-foreground')
  })
})
