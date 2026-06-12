import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { DateTime } from 'luxon'
import { SettlementCalendarWeek, type SettlementCalendarEntry } from '@/pages/AvailableBalance/SettlementCalendarWeek'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))

// Radix Popover positions via floating-ui, which needs a working ResizeObserver.
// The global setup's vi.fn() mock loses its implementation under `mockReset: true`.
beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  global.ResizeObserver = RO as unknown as typeof ResizeObserver
})

const TZ = 'America/Mexico_City'
const fmt = (n: number) => `$${n.toFixed(2)}`

function isoFor(daysFromToday: number): string {
  return DateTime.now().setZone(TZ).startOf('day').plus({ days: daysFromToday, hours: 6 }).toUTC().toISO()!
}

function entry(daysFromToday: number, status: 'SETTLED' | 'PENDING', amount: number, cardType = 'CREDIT'): SettlementCalendarEntry {
  return {
    settlementDate: isoFor(daysFromToday),
    totalNetAmount: amount,
    transactionCount: 2,
    status,
    byCardType: [{ cardType, netAmount: amount, transactionCount: 2 }],
  }
}

function renderCalendar(entries: SettlementCalendarEntry[]) {
  return render(
    <SettlementCalendarWeek entries={entries} timezone={TZ} formatCurrency={fmt} cardTypeLabel={k => k} />,
  )
}

describe('SettlementCalendarWeek', () => {
  it('shows a "deposited" badge for settled days and "estimated" for pending days', () => {
    renderCalendar([entry(0, 'SETTLED', 1000), entry(2, 'PENDING', 500, 'AMEX')])
    // Desktop grid and mobile agenda both render in jsdom (CSS visibility classes don't apply)
    expect(screen.getAllByText('calendar.deposited').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('calendar.estimated').length).toBeGreaterThanOrEqual(1)
  })

  it('treats a day as estimated when any of its merged entries is still pending', () => {
    renderCalendar([entry(0, 'SETTLED', 1000), entry(0, 'PENDING', 200, 'AMEX')])
    expect(screen.getAllByText('calendar.estimated').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('calendar.deposited')).not.toBeInTheDocument()
  })

  it('explains that banks do not deposit on weekends instead of a bare empty state', () => {
    renderCalendar([entry(0, 'SETTLED', 1000)])
    // A 14-day window always contains at least one empty weekend day
    expect(screen.getAllByText('calendar.weekendNote').length).toBeGreaterThanOrEqual(1)
  })

  it('opens the day breakdown on click (works for touch and keyboard, unlike hover)', async () => {
    const user = userEvent.setup()
    renderCalendar([entry(0, 'SETTLED', 1000)])

    // Header totals also render "$1000.00" — pick a match that's inside a trigger button
    const trigger = screen
      .getAllByText('$1000.00')
      .map(el => el.closest('button'))
      .find(Boolean)
    expect(trigger).toBeTruthy()
    await user.click(trigger!)

    expect(await screen.findByText('calendar.netToDeposit')).toBeInTheDocument()
    expect(screen.getAllByText('CREDIT').length).toBeGreaterThanOrEqual(1)
  })

  it('renders the mobile agenda list with only the days that carry money', () => {
    renderCalendar([entry(0, 'SETTLED', 1000), entry(2, 'PENDING', 500, 'AMEX')])
    // Agenda rows + grid cells are buttons; 2 data days → 4 buttons (plus week toggles)
    const amounts = [...screen.getAllByText('$1000.00'), ...screen.getAllByText('$500.00')]
    expect(amounts.length).toBeGreaterThanOrEqual(4)
  })
})
