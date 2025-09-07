/**
 * Receipt-related constants and utilities
 */

// Receipt URL paths
export const RECEIPT_PATHS = {
  PUBLIC: '/receipts/public',
  DASHBOARD: '/receipts'
} as const

// Receipt URL utilities
export const ReceiptUrls = {
  /**
   * Generate public receipt URL
   * @param accessKey Receipt access key
   * @param baseUrl Base URL (defaults to current origin)
   * @returns Full public receipt URL
   */
  public: (accessKey: string, baseUrl?: string): string => {
    const base = baseUrl || window.location.origin
    return `${base}${RECEIPT_PATHS.PUBLIC}/${accessKey}`
  },

  /**
   * Generate dashboard receipt URL
   * @param receiptId Receipt ID
   * @param baseUrl Base URL (defaults to current origin)
   * @returns Full dashboard receipt URL
   */
  dashboard: (receiptId: string, baseUrl?: string): string => {
    const base = baseUrl || window.location.origin
    return `${base}${RECEIPT_PATHS.DASHBOARD}/${receiptId}`
  },

  /**
   * Check if current path is a public receipt view
   * @param pathname Current pathname
   * @returns True if viewing public receipt
   */
  isPublicView: (pathname: string = window.location.pathname): boolean => {
    return pathname.includes(RECEIPT_PATHS.PUBLIC)
  }
} as const

// Receipt status types for consistent handling
export const RECEIPT_STATUS = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  VIEWED: 'VIEWED',
  ERROR: 'ERROR'
} as const

export type ReceiptStatus = typeof RECEIPT_STATUS[keyof typeof RECEIPT_STATUS]