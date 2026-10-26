import type { TFunction } from 'i18next'

const statusKeys: Record<string, string> = {
  COMPLETED: 'exchange.status.completed',
  COMPLETED_PENDING_CARD_REFUND: 'exchange.status.completed',
  PENDING_PAYMENT: 'exchange.status.pendingPayment',
  NEEDS_REVIEW: 'exchange.status.needsReview',
  CANCELLED: 'exchange.status.cancelled',
}
const reasonKeys: Record<string, string> = {
  CHARGE_AMOUNT_MISMATCH: 'exchange.reviewReasons.chargeAmountMismatch',
  LATE_CHARGE_AFTER_RELEASE: 'exchange.reviewReasons.lateChargeAfterRelease',
  ORIGINAL_CHANGED_WHILE_PENDING: 'exchange.reviewReasons.originalChangedWhilePending',
}

export function exchangeStatusLabel(status: string, t: TFunction<'payment'>): string {
  return statusKeys[status] ? t(statusKeys[status]) : status
}

export function exchangeReviewReasonLabel(reason: string, t: TFunction<'payment'>): string {
  return reasonKeys[reason] ? t(reasonKeys[reason]) : reason
}
