import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import {
  accountMappingKeys,
  getAccountMapping,
  seedAccountMapping,
  setAccountMapping,
  type AccountMappingResponse,
} from '@/services/fiscal/accountMapping.service'

/** Configuración contable del venue activo. `enabled:false` desde el teaser (paywall). */
export function useAccountMapping(options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()
  const enabled = options?.enabled ?? true

  return useQuery<AccountMappingResponse>({
    queryKey: accountMappingKeys.byVenue(venueId),
    queryFn: () => getAccountMapping(venueId!),
    enabled: !!venueId && enabled,
    staleTime: 60 * 1000,
  })
}

/** Siembra los defaults del mapa (idempotente). Permiso accounting:manage. */
export function useSeedAccountMapping() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('reports')

  return useMutation({
    mutationFn: () => seedAccountMapping(venueId!),
    onSuccess: data => {
      queryClient.setQueryData(accountMappingKeys.byVenue(venueId), data)
      toast({ title: t('accountMapping.toast.seeded') })
    },
    onError: (err: any) => {
      toast({ title: t('accountMapping.toast.seedError'), description: err?.response?.data?.message ?? err?.message ?? '', variant: 'destructive' })
    },
  })
}

/** Reasigna un movimiento a una cuenta. Permiso accounting:manage. */
export function useSetAccountMapping() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('reports')

  return useMutation({
    mutationFn: ({ movementType, ledgerAccountId }: { movementType: string; ledgerAccountId: string | null }) =>
      setAccountMapping(venueId!, movementType, ledgerAccountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountMappingKeys.byVenue(venueId) })
      toast({ title: t('accountMapping.toast.updated') })
    },
    onError: (err: any) => {
      toast({ title: t('accountMapping.toast.updateError'), description: err?.response?.data?.message ?? err?.message ?? '', variant: 'destructive' })
    },
  })
}
