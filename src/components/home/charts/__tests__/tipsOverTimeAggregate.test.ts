import { describe, expect, it } from 'vitest'
import { aggregateTipsOverTime } from '../tipsOverTimeAggregate'

const mexicoCity = 'America/Mexico_City'
const locale = 'es-MX'

describe('aggregateTipsOverTime', () => {
  it('etiqueta un cobro del mediodía de CDMX con su día local', () => {
    const payments = [{ createdAt: '2026-11-11T18:00:00Z', amount: 100, tips: [{ amount: 10 }] }]

    expect(aggregateTipsOverTime(payments, mexicoCity, locale)).toEqual([
      { date: '2026-11-11', tips: 10, tipPercentage: 10, formattedDate: '11 nov' },
    ])
  })

  it('separa los cobros a ambos lados de la medianoche local y calcula sus propinas diarias', () => {
    const payments = [
      { createdAt: '2026-11-12T06:10:00Z', amount: 100, tips: [{ amount: 6 }] },
      { createdAt: '2026-11-12T05:50:00Z', amount: '200', tips: [{ amount: '20' }] },
      { createdAt: '2026-11-11T18:00:00Z', amount: 100, tips: [{ amount: 12 }, { amount: 3 }] },
      { createdAt: '2026-11-12T07:00:00Z', amount: 50 },
    ]

    expect(aggregateTipsOverTime(payments, mexicoCity, locale)).toEqual([
      { date: '2026-11-11', tips: 35, tipPercentage: 11.67, formattedDate: '11 nov' },
      { date: '2026-11-12', tips: 6, tipPercentage: 4, formattedDate: '12 nov' },
    ])
  })

  it('usa el día de Tijuana para un cobro que en CDMX ya es del día siguiente', () => {
    const payments = [{ createdAt: '2026-11-12T06:10:00Z', amount: 100, tips: [{ amount: 10 }] }]

    expect(aggregateTipsOverTime(payments, 'America/Tijuana', locale)).toEqual([
      { date: '2026-11-11', tips: 10, tipPercentage: 10, formattedDate: '11 nov' },
    ])
  })

  it.each(['', 'ilegible'])('omite un cobro con fecha %j sin perder los cobros válidos', createdAt => {
    const payments = [
      { createdAt, amount: 500, tips: [{ amount: 50 }] },
      { createdAt: '2026-11-11T18:00:00Z', amount: 100, tips: [{ amount: 10 }] },
    ]

    expect(aggregateTipsOverTime(payments, mexicoCity, locale)).toEqual([
      { date: '2026-11-11', tips: 10, tipPercentage: 10, formattedDate: '11 nov' },
    ])
  })
})
