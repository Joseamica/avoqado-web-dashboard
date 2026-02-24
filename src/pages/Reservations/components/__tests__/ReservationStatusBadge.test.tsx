import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReservationStatus } from '@/types/reservation'
import { ReservationStatusBadge } from '../ReservationStatusBadge'

// Mock react-i18next to return the key as-is
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}))

describe('ReservationStatusBadge', () => {
  const testCases: { status: ReservationStatus; expectedKey: string }[] = [
    { status: 'PENDING', expectedKey: 'status.PENDING' },
    { status: 'CONFIRMED', expectedKey: 'status.CONFIRMED' },
    { status: 'CHECKED_IN', expectedKey: 'status.CHECKED_IN' },
    { status: 'COMPLETED', expectedKey: 'status.COMPLETED' },
    { status: 'CANCELLED', expectedKey: 'status.CANCELLED' },
    { status: 'NO_SHOW', expectedKey: 'status.NO_SHOW' },
  ]

  for (const { status, expectedKey } of testCases) {
    it(`should render ${status} with correct i18n key`, () => {
      render(<ReservationStatusBadge status={status} />)
      expect(screen.getByText(expectedKey)).toBeDefined()
    })
  }

  it('should pass className prop through', () => {
    const { container } = render(
      <ReservationStatusBadge status="PENDING" className="custom-class" />,
    )
    const badge = container.querySelector('.custom-class')
    expect(badge).toBeDefined()
  })
})
