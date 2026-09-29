import { describe, expect, it } from 'vitest'
import { cabeEnCentavos, propinaMarcadaPorDefecto, propinaQueCabe, restanteTotal, saldosPorDevolver } from '../refundTip'

describe('casilla «Incluir propina» del reembolso por artículos', () => {
  it('lo que queda cuenta sólo reembolsos COMPLETED, como el servidor', () => {
    const refunds = [
      { status: 'COMPLETED', saleAmount: -80, tipAmount: 0 },
      { status: 'COMPLETED', saleAmount: 0, tipAmount: -5 },
      { status: 'FAILED', saleAmount: -65, tipAmount: -9.5 },
    ]
    expect(saldosPorDevolver(145, 14.5, refunds)).toEqual({ venta: 65, propina: 9.5 })
  })

  it('sin reembolsos queda todo', () => {
    expect(saldosPorDevolver(145, 14.5, [])).toEqual({ venta: 145, propina: 14.5 })
  })

  it('arranca marcada al devolver toda la venta que queda', () => {
    expect(propinaMarcadaPorDefecto(145, 145)).toBe(true)
  })

  it('arranca desmarcada al devolver una parte', () => {
    expect(propinaMarcadaPorDefecto(65, 145)).toBe(false)
  })

  it('uno o dos centavos de redondeo del reparto de unidades no la desmarcan', () => {
    expect(propinaMarcadaPorDefecto(144.99, 145)).toBe(true)
    expect(propinaMarcadaPorDefecto(144.98, 145)).toBe(true)
  })

  it('tres centavos ya no son redondeo', () => {
    expect(propinaMarcadaPorDefecto(144.97, 145)).toBe(false)
  })

  it('sin artículos elegidos no arranca marcada', () => {
    expect(propinaMarcadaPorDefecto(0, 0)).toBe(false)
  })
})

// Los topes cuentan EXACTAMENTE como `issueRefund` del servidor (Codex, 29-sep): sólo COMPLETED, el MÁXIMO contra el
// acumulado histórico `processorData.refundedAmountCents`, y todo en centavos enteros.
describe('restanteTotal: lo que queda por devolver, contado como el servidor', () => {
  const hecho = (venta: number, propina = 0) => ({ status: 'COMPLETED', saleAmount: -venta, tipAmount: -propina })

  it('B2: un reembolso FAILED no se resta — no movió dinero', () => {
    const fallido = { status: 'FAILED', saleAmount: -200, tipAmount: -20 }
    expect(restanteTotal(220, [fallido], null)).toBe(220)
  })

  it('cuenta venta + propina de los COMPLETED, y sólo ésos', () => {
    const otros = ['PENDING', 'CANCELLED', 'FAILED'].map(status => ({ status, saleAmount: -100, tipAmount: 0 }))
    expect(restanteTotal(220, [hecho(50, 5), ...otros], null)).toBe(165)
  })

  it('B4: acumulado histórico SIN filas — baja el saldo', () => {
    expect(restanteTotal(220, [], { refundedAmountCents: 6000 })).toBe(160)
  })

  it('gana el MÁXIMO entre las filas y el acumulado (ninguna evidencia afloja a la otra)', () => {
    expect(restanteTotal(220, [hecho(50, 5)], { refundedAmountCents: 1000 })).toBe(165) // filas mayores
    expect(restanteTotal(220, [hecho(50, 5)], { refundedAmountCents: 6000 })).toBe(160) // acumulado mayor
  })

  it('acumulado en pesos (formato viejo) y como cadena, igual que el servidor', () => {
    expect(restanteTotal(220, [], { refundedAmount: 60 })).toBe(160)
    expect(restanteTotal(220, [], { refundedAmountCents: '6000' })).toBe(160)
  })

  it('un acumulado negativo, ilegible o ausente no agranda el saldo', () => {
    expect(restanteTotal(220, [], { refundedAmountCents: -500 })).toBe(220)
    expect(restanteTotal(220, [], { refundedAmountCents: 'vaya' })).toBe(220)
    expect(restanteTotal(220, [], undefined)).toBe(220)
    expect(restanteTotal(220, [], [])).toBe(220)
  })

  it('nunca negativo', () => {
    expect(restanteTotal(220, [hecho(200, 20), hecho(10)], null)).toBe(0)
  })

  it('B3: centavos enteros — $1.00 − $0.67 es exactamente 0.33, no 0.32999999999999996', () => {
    expect(restanteTotal(1, [hecho(0.67)], null)).toBe(0.33)
  })
})

describe('cabeEnCentavos: comparar dinero sin dobles', () => {
  it('B3: 0.33 cabe en 1 − 0.67 (en dobles 0.33 <= 0.32999999999999996 es falso)', () => {
    expect(0.33 <= 1 - 0.67).toBe(false) // el defecto
    expect(cabeEnCentavos(0.33, 1 - 0.67)).toBe(true)
  })

  it('un centavo de más ya no cabe', () => {
    expect(cabeEnCentavos(0.34, 1 - 0.67)).toBe(false)
    expect(cabeEnCentavos(160.01, 160)).toBe(false)
  })

  it('igual cabe; menos cabe', () => {
    expect(cabeEnCentavos(160, 160)).toBe(true)
    expect(cabeEnCentavos(0, 160)).toBe(true)
  })
})

describe('saldosPorDevolver con el tope del total restante', () => {
  it('B4: cada componente se topa con lo que queda del total (un acumulado sin filas baja el total, no el reparto)', () => {
    expect(saldosPorDevolver(200, 20, [], 160)).toEqual({ venta: 160, propina: 20 })
    expect(saldosPorDevolver(200, 20, [], 10)).toEqual({ venta: 10, propina: 10 })
  })

  it('sin tope se comporta como antes', () => {
    expect(saldosPorDevolver(200, 20, [])).toEqual({ venta: 200, propina: 20 })
  })
})

describe('propinaQueCabe: la propina que se suma a los artículos sin pasar del total restante', () => {
  it('cabe entera cuando sobra total', () => {
    expect(propinaQueCabe(14.5, 159.5, 145)).toBe(14.5)
  })

  it('se topa con lo que queda del total tras los artículos', () => {
    expect(propinaQueCabe(14.5, 150, 145)).toBe(5)
  })

  it('cero cuando los artículos ya agotan el total, y nunca negativa', () => {
    expect(propinaQueCabe(14.5, 145, 145)).toBe(0)
    expect(propinaQueCabe(14.5, 100, 145)).toBe(0)
    expect(propinaQueCabe(0, 159.5, 145)).toBe(0)
  })

  it('en centavos enteros: nada de 0.30000000000000004', () => {
    expect(propinaQueCabe(0.3, 0.3, 0)).toBe(0.3)
    expect(propinaQueCabe(1, 0.3, 0.1 + 0.2 - 0.3)).toBe(0.3)
  })
})
