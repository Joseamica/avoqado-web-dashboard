import { DateTime } from 'luxon'

type TipPayment = {
  createdAt?: string | null
  amount: number | string
  tips?: ReadonlyArray<{ amount: number | string }> | null
}

export function aggregateTipsOverTime(payments: readonly TipPayment[] | null | undefined, venueTimezone: string, localeCode: string) {
  const totalsByDate = new Map<string, { tips: number; revenue: number }>()

  for (const payment of payments ?? []) {
    if (!payment?.createdAt) continue
    const date = DateTime.fromISO(payment.createdAt, { zone: 'utc' }).setZone(venueTimezone).toISODate()
    if (!date) continue

    const totals = totalsByDate.get(date) ?? { tips: 0, revenue: 0 }
    totals.tips += payment.tips?.reduce((sum, tip) => sum + Number(tip.amount), 0) || 0
    totals.revenue += Number(payment.amount)
    totalsByDate.set(date, totals)
  }

  return Array.from(totalsByDate.entries())
    .map(([date, { tips, revenue }]) => {
      const tipPercentage = revenue > 0 ? (tips / revenue) * 100 : 0

      return {
        date,
        tips,
        tipPercentage: Number(tipPercentage.toFixed(2)),
        formattedDate: DateTime.fromISO(date, { zone: venueTimezone })
          .setLocale(localeCode)
          .toLocaleString({ month: 'short', day: 'numeric' }),
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}
