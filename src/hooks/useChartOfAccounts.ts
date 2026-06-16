import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import {
  chartOfAccountsKeys,
  createLedgerAccount,
  getChartOfAccounts,
  seedChartOfAccounts,
  updateLedgerAccount,
  type ChartOfAccountsResponse,
  type CreateAccountInput,
  type UpdateAccountInput,
} from '@/services/fiscal/chartOfAccounts.service'

/**
 * Catálogo de cuentas del venue activo. `enabled` se apaga desde el teaser (paywall)
 * para no pegarle al backend gateado por CFDI cuando el venue no tiene la feature.
 */
export function useChartOfAccounts(options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()
  const enabled = options?.enabled ?? true

  return useQuery<ChartOfAccountsResponse>({
    queryKey: chartOfAccountsKeys.catalog(venueId),
    queryFn: () => getChartOfAccounts(venueId!),
    enabled: !!venueId && enabled,
    staleTime: 60 * 1000,
  })
}

/** Siembra el catálogo base por giro (idempotente). Permiso accounting:manage. */
export function useSeedChartOfAccounts() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('reports')

  return useMutation({
    mutationFn: () => seedChartOfAccounts(venueId!),
    onSuccess: data => {
      queryClient.setQueryData(chartOfAccountsKeys.catalog(venueId), data)
      toast({ title: t('chartOfAccounts.toast.seeded', { count: data.accounts.length }) })
    },
    onError: (err: any) => {
      toast({
        title: t('chartOfAccounts.toast.seedError'),
        description: err?.response?.data?.message ?? err?.message ?? '',
        variant: 'destructive',
      })
    },
  })
}

/** Crea una cuenta nueva. Permiso accounting:manage. */
export function useCreateLedgerAccount() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('reports')

  return useMutation({
    mutationFn: (input: CreateAccountInput) => createLedgerAccount(venueId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.catalog(venueId) })
      toast({ title: t('chartOfAccounts.toast.created') })
    },
    onError: (err: any) => {
      toast({
        title: t('chartOfAccounts.toast.createError'),
        description: err?.response?.data?.message ?? err?.message ?? '',
        variant: 'destructive',
      })
    },
  })
}

/** Edita una cuenta (nombre, código agrupador, naturaleza, activa). Permiso accounting:manage. */
export function useUpdateLedgerAccount() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('reports')

  return useMutation({
    mutationFn: ({ accountId, input }: { accountId: string; input: UpdateAccountInput }) =>
      updateLedgerAccount(venueId!, accountId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.catalog(venueId) })
      toast({ title: t('chartOfAccounts.toast.updated') })
    },
    onError: (err: any) => {
      toast({
        title: t('chartOfAccounts.toast.updateError'),
        description: err?.response?.data?.message ?? err?.message ?? '',
        variant: 'destructive',
      })
    },
  })
}
