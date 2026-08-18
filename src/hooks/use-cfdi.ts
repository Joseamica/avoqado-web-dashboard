/**
 * TanStack Query hooks for Facturación (CFDI).
 *
 * Query keys:
 *   ['fiscal-config', venueId]        — emisores + merchant configs
 *   ['cfdis', venueId, filters]       — issued invoices list
 *
 * Mutations toast on success/error (i18n) and invalidate the relevant keys.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useCurrentVenue } from './use-current-venue'
import { useToast } from './use-toast'
import cfdiService, {
  type CancelCfdiRequest,
  type CfdiListFilters,
  type CfdiReceptor,
  type GlobalCfdiResult,
  type IssueCfdiResponse,
  type UpsertEmisorRequest,
  type UpsertMerchantConfigRequest,
  type UploadCsdRequest,
} from '@/services/cfdi.service'

export const fiscalConfigQueryKey = (venueId: string | null) => ['fiscal-config', venueId]
export const cfdisQueryKey = (venueId: string | null, filters: CfdiListFilters) => ['cfdis', venueId, filters]

/**
 * Emisores + merchant configs for the active venue.
 *
 * Pass `enabled: false` to skip the request entirely — used by the visible
 * teaser (paywall) so we don't hit the feature-gated backend when the venue
 * lacks the CFDI feature.
 */
export function useFiscalConfig(options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()
  const enabled = options?.enabled ?? true

  return useQuery({
    queryKey: fiscalConfigQueryKey(venueId),
    queryFn: () => cfdiService.getFiscalConfig(venueId!),
    enabled: !!venueId && enabled,
    staleTime: 60 * 1000,
  })
}

/** Create or update an emisor. Pass `emisorId` to update, omit to create. */
export function useUpsertEmisor() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('cfdi')

  return useMutation({
    mutationFn: ({ emisorId, data }: { emisorId?: string; data: UpsertEmisorRequest }) =>
      emisorId ? cfdiService.updateEmisor(venueId!, emisorId, data) : cfdiService.createEmisor(venueId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fiscalConfigQueryKey(venueId) })
      toast({ title: t('toast.emisorSaved') })
    },
    onError: (err: any) => {
      toast({ title: t('toast.emisorSaveError'), description: err?.response?.data?.message ?? err?.message ?? '', variant: 'destructive' })
    },
  })
}

/** Connect an emisor to the PAC (facturapi org). */
export function useProvisionEmisor() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('cfdi')

  return useMutation({
    mutationFn: (emisorId: string) => cfdiService.provisionEmisor(venueId!, emisorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fiscalConfigQueryKey(venueId) })
      toast({ title: t('toast.provisioned') })
    },
    onError: (err: any) => {
      toast({ title: t('toast.provisionError'), description: err?.response?.data?.message ?? err?.message ?? '', variant: 'destructive' })
    },
  })
}

/** Upload the CSD (.cer + .key + password) for an emisor. */
export function useUploadCsd() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('cfdi')

  return useMutation({
    mutationFn: ({ emisorId, data }: { emisorId: string; data: UploadCsdRequest }) =>
      cfdiService.uploadCsd(venueId!, emisorId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fiscalConfigQueryKey(venueId) })
      toast({ title: t('toast.csdUploaded') })
    },
    onError: (err: any) => {
      toast({ title: t('toast.csdError'), description: err?.response?.data?.message ?? err?.message ?? '', variant: 'destructive' })
    },
  })
}

/** Save the facturación toggles + emisor link for a merchant. */
export function useUpsertMerchantConfig() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('cfdi')

  return useMutation({
    mutationFn: (data: UpsertMerchantConfigRequest) => cfdiService.upsertMerchantConfig(venueId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fiscalConfigQueryKey(venueId) })
      toast({ title: t('toast.merchantSaved') })
    },
    onError: (err: any) => {
      toast({ title: t('toast.merchantSaveError'), description: err?.response?.data?.message ?? err?.message ?? '', variant: 'destructive' })
    },
  })
}

/**
 * Paginated + filtered list of issued CFDIs.
 *
 * Pass `enabled: false` to skip the request — used by the visible teaser so we
 * don't hit the feature-gated backend when the venue lacks the CFDI feature.
 */
export function useCfdis(filters: CfdiListFilters, options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()
  const enabled = options?.enabled ?? true

  return useQuery({
    queryKey: cfdisQueryKey(venueId, filters),
    queryFn: () => cfdiService.getCfdis(venueId!, filters),
    enabled: !!venueId && enabled,
    placeholderData: prev => prev,
  })
}

/**
 * Emit a CFDI for an order — Flow B "Facturar una cuenta".
 *
 * On success (201) we toast the serie-folio + UUID and invalidate the CFDI list
 * so the new invoice shows up. We deliberately do NOT toast on error here: the
 * caller (IssueCfdiDialog) branches on `err.response.status` to render the 422
 * `reasons[]` inline and surface 502/409/403/404 with the right message, since
 * each status needs distinct UX (keep modal open vs. close).
 */
export function useIssueCfdi() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('cfdi')

  return useMutation<IssueCfdiResponse, any, { orderId: string; receptor: CfdiReceptor }>({
    mutationFn: ({ orderId, receptor }) => cfdiService.issueCfdiForOrder(venueId!, orderId, receptor),
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['cfdis', venueId] })
      const cfdi = data?.cfdi
      const folio = cfdi ? `${cfdi.serie}-${cfdi.folio}` : ''
      toast({
        title: t('issueDialog.toast.success'),
        description: cfdi ? t('issueDialog.toast.successDetail', { folio, uuid: cfdi.uuid }) : undefined,
      })
    },
    // Error handling is intentionally left to the caller (status-specific UX).
  })
}

/**
 * Flow C — manually stamp the period's global CFDI for an emisor.
 *
 * On success we invalidate the CFDI list so a freshly stamped global invoice
 * shows up in the Facturas screen. We deliberately do NOT toast here: the
 * trigger has SIX distinct outcomes (201 stamped, 200 NOTHING_TO_INVOICE, plus
 * 409 CSD inactivo / 409 en proceso / 422 / 502 / 404 errors) that each need
 * different toast styling and copy, so the caller (CfdiConfiguracion) branches
 * on the result / `err.response.status`. Errors re-throw to the caller.
 */
export function useTriggerGlobalCfdi() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()

  return useMutation<GlobalCfdiResult, any, string>({
    mutationFn: (emisorId: string) => cfdiService.triggerGlobalCfdi(venueId!, emisorId),
    onSuccess: () => {
      // A new global CFDI (when stamped) must appear in the Facturas list.
      queryClient.invalidateQueries({ queryKey: ['cfdis', venueId] })
    },
    // Status-specific UX is intentionally left to the caller.
  })
}

export const refundCreditNoteQueryKey = (venueId: string | null, refundId: string) => ['refund-credit-note', venueId, refundId]

/**
 * Estado de la nota de crédito (CFDI de Egreso) de un reembolso.
 *
 * Un 403 significa que el local NO tiene la feature CFDI: NO es un error que haya que
 * reintentar ni gritar — el panel lo pinta como "apagado" con su explicación. Por eso
 * no reintentamos en 403/404 y dejamos el error disponible para el componente.
 */
export function useRefundCreditNote(refundId: string, options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()
  const enabled = options?.enabled ?? true

  return useQuery({
    queryKey: refundCreditNoteQueryKey(venueId, refundId),
    queryFn: () => cfdiService.getRefundCreditNote(venueId!, refundId),
    enabled: !!venueId && !!refundId && enabled,
    retry: (failureCount, err: any) => {
      const status = err?.response?.status
      if (status === 403 || status === 404) return false
      return failureCount < 1
    },
    staleTime: 30 * 1000,
  })
}

/**
 * Timbra la nota de crédito de un reembolso.
 *
 * 🔴 Irreversible (documento fiscal real): el caller confirma antes. No se hace toast de
 * error aquí — cada status necesita su propio texto (409 regla de negocio, 422 validación,
 * 502 PAC), así que el componente ramifica sobre `err.response`.
 */
export function useEmitRefundCreditNote() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('cfdi')

  return useMutation({
    mutationFn: (refundId: string) => cfdiService.emitRefundCreditNote(venueId!, refundId),
    onSuccess: (data, refundId) => {
      queryClient.invalidateQueries({ queryKey: refundCreditNoteQueryKey(venueId, refundId) })
      queryClient.invalidateQueries({ queryKey: ['cfdis', venueId] })
      const cn = data?.creditNote
      const folio = cn ? `${cn.serie ?? ''}${cn.folio ?? ''}` : ''
      toast({
        title: t('creditNote.toast.success', { defaultValue: 'Nota de crédito emitida' }),
        description: cn?.uuid
          ? t('creditNote.toast.successDetail', { folio, uuid: cn.uuid, defaultValue: `${folio} · ${cn.uuid}` })
          : undefined,
      })
    },
    // Error handling intencionalmente en el caller (texto por status).
  })
}

/** Cancel an issued CFDI with a SAT motivo (01-04). */
export function useCancelCfdi() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('cfdi')

  return useMutation({
    mutationFn: ({ cfdiId, data }: { cfdiId: string; data: CancelCfdiRequest }) =>
      cfdiService.cancelCfdi(venueId!, cfdiId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cfdis', venueId] })
      toast({ title: t('toast.cancelRequested') })
    },
    onError: (err: any) => {
      toast({ title: t('toast.cancelError'), description: err?.response?.data?.message ?? err?.message ?? '', variant: 'destructive' })
    },
  })
}
