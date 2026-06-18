import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { createJournalEntry, generatePolicies, getJournal, journalKeys, type JournalResponse, type NewEntry } from '@/services/fiscal/journalEntry.service'

/** Libro diario del venue activo. `enabled:false` desde el teaser (paywall). */
export function useJournal(period?: string, options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()
  const enabled = options?.enabled ?? true

  return useQuery<JournalResponse>({
    queryKey: journalKeys.list(venueId, period),
    queryFn: () => getJournal(venueId!, period),
    enabled: !!venueId && enabled,
    staleTime: 30 * 1000,
  })
}

/** Crea una póliza manual. Permiso accounting:manage. */
export function useCreateJournalEntry() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('reports')

  return useMutation({
    mutationFn: (entry: NewEntry) => createJournalEntry(venueId!, entry),
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: journalKeys.all })
      toast({ title: t('journal.toast.created', { folio: data.folio }) })
    },
    onError: (err: any) => {
      toast({ title: t('journal.toast.createError'), description: err?.response?.data?.message ?? err?.message ?? '', variant: 'destructive' })
    },
  })
}

/** Posteo automático: genera las pólizas del periodo desde los pagos. Permiso accounting:manage. */
export function useGeneratePolicies() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('reports')

  return useMutation({
    mutationFn: (period?: string) => generatePolicies(venueId!, period),
    onSuccess: r => {
      queryClient.invalidateQueries({ queryKey: journalKeys.all })
      if (r.missingMappings.length > 0) {
        toast({ title: t('journal.toast.generateMapping'), description: r.missingMappings.join(', '), variant: 'destructive' })
      } else if (r.posted === 0) {
        toast({ title: t('journal.toast.generateNone', { already: r.alreadyPosted }) })
      } else {
        toast({ title: t('journal.toast.generated', { posted: r.posted }) })
      }
    },
    onError: (err: any) => {
      toast({ title: t('journal.toast.generateError'), description: err?.response?.data?.message ?? err?.message ?? '', variant: 'destructive' })
    },
  })
}
