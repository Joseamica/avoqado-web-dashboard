/**
 * Impersonation error code constants + a small event bus so the axios
 * interceptor (non-React) can notify React components about impersonation
 * errors in a single place.
 *
 * Kept intentionally minimal — no EventEmitter / RxJS — just a `Set` of
 * listeners. React components subscribe in `ImpersonationErrorListener`.
 */

export const IMPERSONATION_ERROR_CODES = {
  EXPIRED: 'IMPERSONATION_EXPIRED',
  READ_ONLY: 'IMPERSONATION_READ_ONLY',
  BLOCKED_ROUTE: 'IMPERSONATION_BLOCKED_ROUTE',
  TARGET_INVALID: 'IMPERSONATION_TARGET_INVALID',
} as const

export type ImpersonationErrorCode = (typeof IMPERSONATION_ERROR_CODES)[keyof typeof IMPERSONATION_ERROR_CODES]

export interface ImpersonationErrorEvent {
  code: ImpersonationErrorCode
  message?: string
  /** Request URL that triggered the error — useful for diagnostics. */
  url?: string
}

type Listener = (event: ImpersonationErrorEvent) => void
const listeners = new Set<Listener>()

export function emitImpersonationError(event: ImpersonationErrorEvent): void {
  listeners.forEach(fn => {
    try {
      fn(event)
    } catch (err) {
      console.error('[impersonation-errors] listener error', err)
    }
  })
}

export function subscribeToImpersonationErrors(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Given an axios error, returns a typed impersonation error code if the response
 * carries one, otherwise null.
 */
export function extractImpersonationErrorCode(error: any): ImpersonationErrorCode | null {
  const code = error?.response?.data?.code
  if (!code) return null
  const values: string[] = Object.values(IMPERSONATION_ERROR_CODES)
  return values.includes(code) ? (code as ImpersonationErrorCode) : null
}
