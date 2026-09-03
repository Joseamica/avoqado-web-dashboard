import { describe, expect, it } from 'vitest'

import { resolveWeekdayBuckets } from './performanceChartData'

describe('resolveWeekdayBuckets', () => {
  it('prefers the complete server aggregate over a compatibility row sample', () => {
    const sample = [{ amount: 10, createdAt: '2026-08-03T12:00:00.000Z' }]

    expect(resolveWeekdayBuckets([100, 200, 300, 400, 500, 600, 700], sample, 'UTC')).toEqual([
      100, 200, 300, 400, 500, 600, 700,
    ])
  })

  it('keeps the row-based fallback for an older server', () => {
    const rows = [
      { amount: 25, createdAt: '2026-08-02T12:00:00.000Z' },
      { amount: 40, createdAt: '2026-08-03T12:00:00.000Z' },
    ]

    expect(resolveWeekdayBuckets(undefined, rows, 'UTC')).toEqual([25, 40, 0, 0, 0, 0, 0])
  })
})
