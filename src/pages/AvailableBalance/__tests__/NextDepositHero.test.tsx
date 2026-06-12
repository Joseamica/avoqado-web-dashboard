import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DateTime } from 'luxon'
import { NextDepositHero } from '@/pages/AvailableBalance/NextDepositHero'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))

const TZ = 'America/Mexico_City'
const fmt = (n: number) => `$${n.toFixed(2)}`

/** UTC ISO for a settlement landing N days from today in the venue timezone */
function isoFor(daysFromToday: number): string {
  return DateTime.now().setZone(TZ).startOf('day').plus({ days: daysFromToday, hours: 6 }).toUTC().toISO()!
}

function renderHero(overrides: Partial<Parameters<typeof NextDepositHero>[0]> = {}) {
  return render(
    <NextDepositHero
      nextDate={isoFor(1)}
      nextAmount={1002.32}
      pendingAmount={4861.14}
      pendingCount={6}
      timezone={TZ}
      formatCurrency={fmt}
      {...overrides}
    />,
  )
}

describe('NextDepositHero', () => {
  it('shows the next deposit amount with "today" when it lands today', () => {
    renderHero({ nextDate: isoFor(0), nextAmount: 500 })
    expect(screen.getByText('$500.00')).toBeInTheDocument()
    expect(screen.getByText(/hero\.today/)).toBeInTheDocument()
    expect(screen.getByText('hero.estimated')).toBeInTheDocument()
  })

  it('shows "tomorrow" when the deposit lands tomorrow', () => {
    renderHero({ nextDate: isoFor(1) })
    expect(screen.getByText(/hero\.tomorrow/)).toBeInTheDocument()
  })

  it('shows only the localized date when the deposit is further out', () => {
    renderHero({ nextDate: isoFor(3) })
    expect(screen.queryByText(/hero\.today/)).not.toBeInTheDocument()
    expect(screen.queryByText(/hero\.tomorrow/)).not.toBeInTheDocument()
    expect(screen.getByText('$1002.32')).toBeInTheDocument()
  })

  it('shows the in-transit line when money is pending', () => {
    renderHero()
    expect(screen.getByText(/hero\.inTransit/)).toBeInTheDocument()
    expect(screen.getByText(/hero\.inTransitCount/)).toBeInTheDocument()
  })

  it('teaches instead of reporting emptiness when nothing is scheduled', () => {
    renderHero({ nextDate: null, pendingAmount: 0, pendingCount: 0 })
    expect(screen.getByText('hero.noUpcoming')).toBeInTheDocument()
    expect(screen.getByText('hero.noUpcomingHint')).toBeInTheDocument()
  })

  it('still reports in-transit money when no next date is known', () => {
    renderHero({ nextDate: null, pendingAmount: 1200, pendingCount: 0 })
    expect(screen.getByText('hero.noUpcoming')).toBeInTheDocument()
    expect(screen.getByText(/hero\.inTransit/)).toBeInTheDocument()
    expect(screen.queryByText('hero.noUpcomingHint')).not.toBeInTheDocument()
  })
})
