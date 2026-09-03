import { DateTime } from 'luxon'

const bucketByWeekday = (payments: any[], timezone: string): number[] => {
  const buckets = new Array(7).fill(0)
  for (const payment of payments) {
    if (!payment?.createdAt) continue
    const dt = DateTime.fromISO(String(payment.createdAt), { zone: 'utc' }).setZone(timezone)
    if (!dt.isValid) continue
    const idx = dt.weekday % 7 // luxon: 1=Mon..7=Sun → idx: Sun=0..Sat=6
    buckets[idx] += Number(payment.amount || 0)
  }
  return buckets
}

export const resolveWeekdayBuckets = (serverBuckets: number[] | undefined, payments: any[], timezone: string): number[] => {
  if (serverBuckets?.length === 7) return serverBuckets.map(value => Number(value) || 0)
  return bucketByWeekday(payments, timezone)
}
