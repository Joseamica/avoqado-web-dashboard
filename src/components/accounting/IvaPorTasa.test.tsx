import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AvisoIvaPorTasa, IvaPorTasa, filasDeIva, soloAl16, tasasPresentes } from './IvaPorTasa'

// i18n autocontenido: devuelve la llave (+ valores), como el resto de las pruebas del repo.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key} ${Object.values(opts).join(' ')}` : key),
    i18n: { language: 'es' },
  }),
}))
const t = (key: string, opts?: Record<string, unknown>) => (opts ? `${key} ${Object.values(opts).join(' ')}` : key)

describe('IvaPorTasa (IVA por producto, bloque B4b)', () => {
  it('con todo al 16 % y sin aproximados no dibuja nada: la pantalla queda como antes', () => {
    const { container } = render(
      <IvaPorTasa
        desglose={{
          taxByRate: { '0.16': 1600 },
          tasa0BaseCents: 0,
          exentoBaseCents: 0,
          noObjetoBaseCents: 0,
          movimientosConIvaAproximado: 0,
        }}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('un servidor anterior (sin los campos nuevos) tampoco dibuja nada ni afirma nada', () => {
    const { container } = render(<IvaPorTasa desglose={{}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('🔴 con 16 % y 0 % muestra el IVA de cada tasa y la base a tasa 0', () => {
    render(<IvaPorTasa desglose={{ taxByRate: { '0.16': 1600 }, tasa0BaseCents: 10000 }} />)
    const caja = screen.getByTestId('iva-por-tasa')
    expect(caja).toHaveTextContent('ivaPorTasa.iva ivaPorTasa.tasa 16')
    expect(caja).toHaveTextContent('ivaPorTasa.baseTasa0')
    expect(caja).toHaveTextContent(/16\.00/)
    expect(caja).toHaveTextContent(/100\.00/)
    expect(screen.queryByTestId('iva-aproximado')).not.toBeInTheDocument()
  })

  it('🔴 avisa cuántos movimientos tienen IVA aproximado, aunque todo sea 16 %', () => {
    render(<IvaPorTasa desglose={{ taxByRate: { '0.16': 1600 }, movimientosConIvaAproximado: 2 }} />)
    expect(screen.getByTestId('iva-aproximado')).toHaveTextContent('ivaPorTasa.aproximado 2')
  })

  it('🔴 tasasPresentes: el subtítulo con las tasas del periodo, de mayor a menor', () => {
    expect(tasasPresentes({ taxByRate: { '0.08': 80, '0.16': 1600 }, tasa0BaseCents: 100, exentoBaseCents: 50 }, t)).toBe(
      'ivaPorTasa.tasa 16 · ivaPorTasa.tasa 8 · ivaPorTasa.tasa 0 · ivaPorTasa.exento',
    )
    expect(tasasPresentes({ taxByRate: { '0.16': 0 } }, t)).toBeUndefined()
  })

  it('🔴 soloAl16 y filasDeIva: sólo el 16 % puro queda como antes; un 8 % solo ya se muestra (Codex r2 N9)', () => {
    expect(soloAl16({ taxByRate: { '0.16': 1600 } })).toBe(true)
    expect(soloAl16({})).toBe(true)
    expect(soloAl16({ taxByRate: { '0.08': 800 } })).toBe(false)
    expect(soloAl16({ taxByRate: { '0.16': 1600, '0.08': 80 } })).toBe(false)
    expect(soloAl16({ taxByRate: { '0.16': 1600 }, tasa0BaseCents: 100 })).toBe(false)
    expect(filasDeIva({ taxByRate: { '0.16': 1600 }, exentoBaseCents: 3000 }, t)).toEqual([
      ['ivaPorTasa.iva ivaPorTasa.tasa 16', 1600],
      ['ivaPorTasa.baseExenta', 3000],
    ])
  })

  it('🔴 Codex r2 N9 · todo al 8 %: la caja dice «IVA 8 %» (con una sola tasa que no es 16 % no se esconde)', () => {
    render(<IvaPorTasa desglose={{ taxByRate: { '0.08': 800 }, movimientosConIvaAproximado: 0 }} />)
    expect(screen.getByTestId('iva-por-tasa')).toHaveTextContent('ivaPorTasa.iva ivaPorTasa.tasa 8')
  })
})

describe('AvisoIvaPorTasa (fallo 3 de la ronda 7; Codex r6 R6-3)', () => {
  it('🔴 la línea fija sale SIEMPRE, sin depender de que haya devoluciones', () => {
    render(<AvisoIvaPorTasa />)
    expect(screen.getByTestId('aviso-iva-por-tasa')).toHaveTextContent('ivaPorTasa.notaFacturas')
  })
})
