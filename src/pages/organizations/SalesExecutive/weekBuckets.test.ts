import { describe, it, expect } from 'vitest'
import { weekBucketsAsc } from './weekBuckets'

describe('weekBucketsAsc', () => {
  it('sorts ascending and labels a same-month week as "d–d MMM"', () => {
    const out = weekBucketsAsc(['2026-W26', '2026-W25'])
    expect(out.map(b => b.key)).toEqual(['2026-W25', '2026-W26'])
    // 2026-W26 = Mon 2026-06-22 .. Sun 2026-06-28
    expect(out[1].label).toBe('22–28 jun')
  })
  it('orders across a year boundary', () => {
    const out = weekBucketsAsc(['2026-W01', '2025-W52'])
    expect(out.map(b => b.key)).toEqual(['2025-W52', '2026-W01'])
  })
  it('labels a cross-month week with both months', () => {
    // 2026-W27 = Mon 2026-06-29 .. Sun 2026-07-05
    expect(weekBucketsAsc(['2026-W27'])[0].label).toBe('29 jun–5 jul')
  })
})
