import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { formatCountdown, useCountdown } from './use-countdown'

describe('formatCountdown', () => {
  it('m:ss por debajo de una hora, h:mm:ss arriba, 0:00 al vencer', () => {
    expect(formatCountdown(83_000)).toBe('1:23')
    expect(formatCountdown(5_025_000)).toBe('1:23:45')
    expect(formatCountdown(0)).toBe('0:00')
    expect(formatCountdown(-5_000)).toBe('0:00')
  })
})

describe('useCountdown', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  // Al llegar a cero, `expired` se prende sin recargar.
  it('cuenta hacia atrás cada segundo y marca expired al llegar a cero', () => {
    vi.setSystemTime(new Date('2030-01-10T12:00:00Z'))
    const { result } = renderHook(() => useCountdown('2030-01-10T12:00:03Z'))
    expect(result.current).toMatchObject({ expired: false, label: '0:03' })
    act(() => vi.advanceTimersByTime(2_000))
    expect(result.current.label).toBe('0:01')
    act(() => vi.advanceTimersByTime(2_000))
    expect(result.current).toMatchObject({ expired: true, label: '0:00' })
  })

  it('sin plazo no cuenta nada', () => {
    const { result } = renderHook(() => useCountdown(null))
    expect(result.current).toEqual({ msLeft: 0, expired: true, label: '0:00' })
  })
})
