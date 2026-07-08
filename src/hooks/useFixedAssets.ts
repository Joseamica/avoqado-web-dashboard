import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useCurrentVenue } from '@/hooks/use-current-venue'
import {
  fixedAssetKeys,
  getAssetTypes,
  getFixedAssets,
  registerFixedAsset,
  runDepreciation,
  type AssetTypeDef,
  type FixedAssetView,
  type RegisterFixedAssetInput,
} from '@/services/fiscal/fixedAsset.service'
import { isrKeys } from '@/services/fiscal/isr.service'

/** Catálogo de tipos de activo fijo con su tasa oficial default. */
export function useAssetTypes(options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()
  const enabled = options?.enabled ?? true
  return useQuery<AssetTypeDef[]>({
    queryKey: fixedAssetKeys.types(venueId),
    queryFn: () => getAssetTypes(venueId!),
    enabled: !!venueId && enabled,
    staleTime: 5 * 60 * 1000,
  })
}

/** Activos fijos registrados del contribuyente. */
export function useFixedAssets(options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()
  const enabled = options?.enabled ?? true
  return useQuery<{ needsFiscalSetup: boolean; assets: FixedAssetView[] }>({
    queryKey: fixedAssetKeys.list(venueId),
    queryFn: () => getFixedAssets(venueId!),
    enabled: !!venueId && enabled,
    staleTime: 30 * 1000,
  })
}

/** Registra (confirma) un activo fijo. Invalida la lista y el ISR (la depreciación lo deduce). */
export function useRegisterFixedAsset() {
  const { venueId } = useCurrentVenue()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RegisterFixedAssetInput) => registerFixedAsset(venueId!, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fixedAssetKeys.all })
      qc.invalidateQueries({ queryKey: isrKeys.all })
    },
  })
}

/** Corre la depreciación del periodo. Invalida la lista y el ISR. */
export function useRunDepreciation() {
  const { venueId } = useCurrentVenue()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (period?: string) => runDepreciation(venueId!, period),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fixedAssetKeys.all })
      qc.invalidateQueries({ queryKey: isrKeys.all })
    },
  })
}
