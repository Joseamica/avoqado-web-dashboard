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
  type UpsertEmisorRequest,
  type UpsertMerchantConfigRequest,
  type UploadCsdRequest,
} from '@/services/cfdi.service'

export const fiscalConfigQueryKey = (venueId: string | null) => ['fiscal-config', venueId]
export const cfdisQueryKey = (venueId: string | null, filters: CfdiListFilters) => ['cfdis', venueId, filters]

/** Emisores + merchant configs for the active venue. */
export function useFiscalConfig() {
  const { venueId } = useCurrentVenue()

  return useQuery({
    queryKey: fiscalConfigQueryKey(venueId),
    queryFn: () => cfdiService.getFiscalConfig(venueId!),
    enabled: !!venueId,
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

/** Paginated + filtered list of issued CFDIs. */
export function useCfdis(filters: CfdiListFilters) {
  const { venueId } = useCurrentVenue()

  return useQuery({
    queryKey: cfdisQueryKey(venueId, filters),
    queryFn: () => cfdiService.getCfdis(venueId!, filters),
    enabled: !!venueId,
    placeholderData: prev => prev,
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
