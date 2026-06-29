import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { journalKeys } from '@/services/fiscal/journalEntry.service'
import { closePeriod, getPeriodLocks, periodLockKeys, reopenPeriod, type PeriodLocksResponse } from '@/services/fiscal/periodLock.service'

/** Candados de periodo del venue activo. `enabled:false` desde el teaser (paywall). */
export function usePeriodLocks(options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()
  const enabled = options?.enabled ?? true

  return useQuery<PeriodLocksResponse>({
    queryKey: periodLockKeys.list(venueId),
    queryFn: () => getPeriodLocks(venueId!),
    enabled: !!venueId && enabled,
    staleTime: 30 * 1000,
  })
}

/** Cierra un periodo. Permiso accounting:manage. Invalida candados + diario (las pólizas se bloquean dentro). */
export function useClosePeriod() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('reports')

  return useMutation({
    mutationFn: ({ period, reason }: { period: string; reason?: string }) => closePeriod(venueId!, period, reason),
    onSuccess: r => {
      queryClient.invalidateQueries({ queryKey: periodLockKeys.all })
      queryClient.invalidateQueries({ queryKey: journalKeys.all })
      toast({ title: t('periodLock.toast.closed', { period: r.period }) })
    },
    onError: (err: any) => {
      toast({ title: t('periodLock.toast.error'), description: err?.response?.data?.message ?? err?.message ?? '', variant: 'destructive' })
    },
  })
}

/** Reabre un periodo cerrado (permite correcciones). Permiso accounting:manage. */
export function useReopenPeriod() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('reports')

  return useMutation({
    mutationFn: ({ period, reason }: { period: string; reason?: string }) => reopenPeriod(venueId!, period, reason),
    onSuccess: r => {
      queryClient.invalidateQueries({ queryKey: periodLockKeys.all })
      queryClient.invalidateQueries({ queryKey: journalKeys.all })
      toast({ title: t('periodLock.toast.reopened', { period: r.period }) })
    },
    onError: (err: any) => {
      toast({ title: t('periodLock.toast.error'), description: err?.response?.data?.message ?? err?.message ?? '', variant: 'destructive' })
    },
  })
}
