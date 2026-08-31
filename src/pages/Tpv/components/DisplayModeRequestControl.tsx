import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  cancelDisplayModeRequest,
  createDisplayModeRequest,
  type DisplayModeRequest,
  type DisplayModeRequestStatus,
  type DisplayModeResultCode,
  type EffectiveDeviceCapabilities,
} from '@/services/tpv.service'
import { useVenueDateTime } from '@/utils/datetime'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, MonitorSmartphone } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const STATUS_KEYS = {
  PENDING: 'displayMode.statuses.PENDING',
  APPLIED: 'displayMode.statuses.APPLIED',
  REJECTED: 'displayMode.statuses.REJECTED',
  SUPERSEDED: 'displayMode.statuses.SUPERSEDED',
  CANCELLED: 'displayMode.statuses.CANCELLED',
  EXPIRED: 'displayMode.statuses.EXPIRED',
} as const satisfies Record<DisplayModeRequestStatus, string>

const RESULT_CODE_KEYS = {
  DISPLAY_NOT_PRESENT: 'displayMode.resultCodes.DISPLAY_NOT_PRESENT',
  DISPLAY_NOT_INVERTIBLE: 'displayMode.resultCodes.DISPLAY_NOT_INVERTIBLE',
  APPLY_FAILED: 'displayMode.resultCodes.APPLY_FAILED',
  LOCAL_OVERRIDE: 'displayMode.resultCodes.LOCAL_OVERRIDE',
  CANCEL_TOO_LATE: 'displayMode.resultCodes.CANCEL_TOO_LATE',
  ACK_AFTER_EXPIRY: 'displayMode.resultCodes.ACK_AFTER_EXPIRY',
  DEVICE_RETIRED: 'displayMode.resultCodes.DEVICE_RETIRED',
} as const satisfies Record<DisplayModeResultCode, string>

type FeedbackKey =
  | 'displayMode.feedback.requestCreated'
  | 'displayMode.feedback.cancelled'
  | 'displayMode.feedback.cancelTooLate'
  | 'displayMode.feedback.createFailed'
  | 'displayMode.feedback.cancelFailed'

interface CancelTooLateDetails {
  customerDisplayInverted: boolean
  request: DisplayModeRequest
}

interface MutationIdentity {
  identity: string
  venueId: string
  terminalId: string
}

interface CreateMutationVariables extends MutationIdentity {
  desiredInverted: boolean
}

interface CancelMutationVariables extends MutationIdentity {
  requestId: string
}

interface DisplayModeRequestControlProps {
  venueId: string
  terminalId: string
  capabilities: EffectiveDeviceCapabilities
  customerDisplayInverted: boolean
  request?: DisplayModeRequest | null
  canUpdate: boolean
}

// Kept beside the control so the detail-page polling policy is independently testable.
// eslint-disable-next-line react-refresh/only-export-components
export function getDisplayModeRefetchInterval(request?: DisplayModeRequest | null): 5000 | false {
  return request?.status === 'PENDING' ? 5000 : false
}

function getCancelTooLateDetails(error: unknown): CancelTooLateDetails | null {
  const response = (error as { response?: { status?: number; data?: unknown } })?.response
  if (response?.status !== 409 || !response.data || typeof response.data !== 'object') return null

  const payload = response.data as { code?: unknown; details?: unknown }
  if (payload.code !== 'CANCEL_TOO_LATE' || !payload.details || typeof payload.details !== 'object') return null

  const details = payload.details as { customerDisplayInverted?: unknown; request?: unknown }
  if (typeof details.customerDisplayInverted !== 'boolean' || !isDisplayModeRequest(details.request)) return null

  return {
    customerDisplayInverted: details.customerDisplayInverted,
    request: details.request,
  }
}

function isDisplayModeRequest(value: unknown): value is DisplayModeRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const request = value as Record<string, unknown>
  if (
    typeof request.requestId !== 'string' ||
    typeof request.desiredInverted !== 'boolean' ||
    typeof request.status !== 'string' ||
    !Object.prototype.hasOwnProperty.call(STATUS_KEYS, request.status) ||
    typeof request.requestedAt !== 'string' ||
    typeof request.requestedBy !== 'string' ||
    typeof request.expiresAt !== 'string'
  ) {
    return false
  }
  if (request.resolvedAt !== undefined && typeof request.resolvedAt !== 'string') return false
  if (
    request.resultCode !== undefined &&
    (typeof request.resultCode !== 'string' || !Object.prototype.hasOwnProperty.call(RESULT_CODE_KEYS, request.resultCode))
  ) {
    return false
  }
  return true
}

function publishConfirmedDetail(
  queryClient: ReturnType<typeof useQueryClient>,
  identity: Pick<MutationIdentity, 'venueId' | 'terminalId'>,
  confirmed: { request: DisplayModeRequest | null; customerDisplayInverted?: boolean },
) {
  queryClient.setQueryData<unknown>(['tpv', identity.venueId, identity.terminalId], current => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return current
    return {
      ...current,
      customerDisplayRequest: confirmed.request,
      ...(confirmed.customerDisplayInverted === undefined ? {} : { customerDisplayInverted: confirmed.customerDisplayInverted }),
    }
  })
}

function formatConfirmedRequestDate(
  value: string | null | undefined,
  formatDateTime: (date: string | Date | null | undefined) => string,
  notAvailable: string,
): string {
  if (!value || Number.isNaN(Date.parse(value))) return notAvailable
  return formatDateTime(value)
}

export function DisplayModeRequestControl({
  venueId,
  terminalId,
  capabilities,
  customerDisplayInverted,
  request,
  canUpdate,
}: DisplayModeRequestControlProps) {
  const { t } = useTranslation('tpv')
  const { formatDateTime } = useVenueDateTime()
  const queryClient = useQueryClient()
  const identity = `${venueId}:${terminalId}`
  const currentIdentityRef = useRef(identity)
  const previousIdentityRef = useRef(identity)
  currentIdentityRef.current = identity
  const [visibleRequest, setVisibleRequest] = useState<DisplayModeRequest | null>(request ?? null)
  const [confirmedPhysicalInverted, setConfirmedPhysicalInverted] = useState(customerDisplayInverted)
  const [feedbackKey, setFeedbackKey] = useState<FeedbackKey | null>(null)

  useEffect(() => {
    setVisibleRequest(request ?? null)
  }, [identity, request])

  useEffect(() => {
    setConfirmedPhysicalInverted(customerDisplayInverted)
  }, [customerDisplayInverted, identity])

  useEffect(() => {
    if (previousIdentityRef.current !== identity) {
      previousIdentityRef.current = identity
      setVisibleRequest(request ?? null)
      setConfirmedPhysicalInverted(customerDisplayInverted)
      setFeedbackKey(null)
    }
  }, [customerDisplayInverted, identity, request])

  const invalidateCanonicalProjection = async (captured: MutationIdentity) => {
    await Promise.allSettled([
      Promise.resolve().then(() => queryClient.invalidateQueries({ queryKey: ['tpv', captured.venueId, captured.terminalId] })),
      Promise.resolve().then(() => queryClient.invalidateQueries({ queryKey: ['tpvs', captured.venueId] })),
    ])
  }

  const createMutation = useMutation({
    mutationFn: (variables: CreateMutationVariables) =>
      createDisplayModeRequest(variables.venueId, variables.terminalId, variables.desiredInverted),
    onSuccess: (response, variables) => {
      publishConfirmedDetail(queryClient, variables, { request: response.data.request })
      if (currentIdentityRef.current === variables.identity) {
        setVisibleRequest(response.data.request)
        setFeedbackKey('displayMode.feedback.requestCreated')
      }
    },
    onError: (_error, variables) => {
      if (currentIdentityRef.current === variables.identity) {
        setFeedbackKey('displayMode.feedback.createFailed')
      }
    },
    onSettled: (_data, _error, variables) => invalidateCanonicalProjection(variables),
  })

  const cancelMutation = useMutation({
    mutationFn: (variables: CancelMutationVariables) =>
      cancelDisplayModeRequest(variables.venueId, variables.terminalId, variables.requestId),
    onSuccess: (response, variables) => {
      publishConfirmedDetail(queryClient, variables, { request: response.data.request })
      if (currentIdentityRef.current === variables.identity) {
        setVisibleRequest(response.data.request)
        setFeedbackKey('displayMode.feedback.cancelled')
      }
    },
    onError: (error, variables) => {
      const tooLate = getCancelTooLateDetails(error)
      if (tooLate) {
        publishConfirmedDetail(queryClient, variables, {
          request: tooLate.request,
          customerDisplayInverted: tooLate.customerDisplayInverted,
        })
        if (currentIdentityRef.current === variables.identity) {
          setConfirmedPhysicalInverted(tooLate.customerDisplayInverted)
          setVisibleRequest(tooLate.request)
          setFeedbackKey('displayMode.feedback.cancelTooLate')
        }
        return
      }
      if (currentIdentityRef.current === variables.identity) {
        setFeedbackKey('displayMode.feedback.cancelFailed')
      }
    },
    onSettled: (_data, _error, variables) => invalidateCanonicalProjection(variables),
  })

  const display = capabilities.customerDisplay
  if (display.presence === 'UNSUPPORTED' || display.invertibility === 'UNSUPPORTED') return null

  const awaitingReport = display.stale || display.presence === 'UNKNOWN' || display.invertibility === 'UNKNOWN'
  const requestPending = visibleRequest?.status === 'PENDING'
  const createPendingForIdentity = createMutation.isPending && createMutation.variables?.identity === identity
  const cancelPendingForIdentity = cancelMutation.isPending && cancelMutation.variables?.identity === identity
  const mutationPending = createPendingForIdentity || cancelPendingForIdentity
  const canCreate = !awaitingReport && display.canRequestInversion && canUpdate && !requestPending && !mutationPending
  const desiredInverted =
    visibleRequest?.status === 'REJECTED' || visibleRequest?.status === 'EXPIRED'
      ? visibleRequest.desiredInverted
      : !confirmedPhysicalInverted
  const retrying = visibleRequest?.status === 'REJECTED' || visibleRequest?.status === 'EXPIRED'
  const actionKey = retrying
    ? desiredInverted
      ? 'displayMode.actions.retryInverted'
      : 'displayMode.actions.retryStandard'
    : desiredInverted
      ? 'displayMode.actions.requestInverted'
      : 'displayMode.actions.requestStandard'

  return (
    <div data-testid="display-mode-request-control" className="space-y-3 rounded-lg bg-muted p-3">
      <div className="flex items-start gap-3">
        <MonitorSmartphone className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-foreground">{t('displayMode.title')}</p>
          <p className="text-xs text-muted-foreground">{t('displayMode.description')}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground">{t('displayMode.physical.label')}</span>
            <Badge data-testid="physical-display-state" variant="outline">
              {t(confirmedPhysicalInverted ? 'displayMode.physical.inverted' : 'displayMode.physical.standard')}
            </Badge>
          </div>
        </div>
      </div>

      {visibleRequest && (
        <div className="space-y-1 rounded-md border border-border bg-background/60 p-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">{t('displayMode.requested.label')}</span>
            <Badge data-testid="requested-display-state" variant="secondary">
              {t(visibleRequest.desiredInverted ? 'displayMode.physical.inverted' : 'displayMode.physical.standard')}
            </Badge>
            <Badge variant="outline">{t(STATUS_KEYS[visibleRequest.status])}</Badge>
          </div>
          <p className="text-muted-foreground">
            {t('displayMode.requested.requestedAt')}:{' '}
            <span className="text-foreground">
              {formatConfirmedRequestDate(visibleRequest.requestedAt, formatDateTime, t('displayMode.requested.notAvailable'))}
            </span>
          </p>
          <p className="text-muted-foreground">
            {t('displayMode.requested.expiresAt')}:{' '}
            <span className="text-foreground">
              {formatConfirmedRequestDate(visibleRequest.expiresAt, formatDateTime, t('displayMode.requested.notAvailable'))}
            </span>
          </p>
          {visibleRequest.resultCode && <p className="text-muted-foreground">{t(RESULT_CODE_KEYS[visibleRequest.resultCode])}</p>}
        </div>
      )}

      {awaitingReport && <p className="text-xs text-muted-foreground">{t('displayMode.explanations.awaitingReport')}</p>}
      {!awaitingReport && !display.canRequestInversion && (
        <p className="text-xs text-muted-foreground">{t('displayMode.explanations.actionUnavailable')}</p>
      )}
      {!canUpdate && <p className="text-xs text-muted-foreground">{t('displayMode.explanations.missingPermission')}</p>}
      {feedbackKey && (
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {t(feedbackKey)}
        </p>
      )}

      {requestPending ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-tour="device-display-mode-cancel"
          onClick={() =>
            cancelMutation.mutate({
              identity,
              venueId,
              terminalId,
              requestId: visibleRequest.requestId,
            })
          }
          disabled={!canUpdate || mutationPending}
        >
          {cancelPendingForIdentity && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {t(cancelPendingForIdentity ? 'displayMode.actions.cancelling' : 'displayMode.actions.cancel')}
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          data-tour="device-display-mode-request"
          onClick={() =>
            createMutation.mutate({
              identity,
              venueId,
              terminalId,
              desiredInverted,
            })
          }
          disabled={!canCreate}
        >
          {createPendingForIdentity && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {t(createPendingForIdentity ? 'displayMode.actions.submitting' : actionKey)}
        </Button>
      )}
    </div>
  )
}
