import { useQuery } from '@tanstack/react-query'

import { reintentarReporte, repetirAlVolver } from '@/components/accounting/errorDelReporte'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import {
  accountingKeys,
  fetchBankAndCash,
  fetchBusinessSummary,
  type BankAndCashResponse,
  type BusinessSummaryResponse,
} from '@/services/reports/accounting.service'

interface PeriodArgs {
  from: string // YYYY-MM-DD (venue timezone)
  to: string // YYYY-MM-DD (venue timezone)
  enabled?: boolean
}

/**
 * Resumen del negocio (Capa A) — portada de Contabilidad para el venue activo.
 * Scoped al venue via useCurrentVenue(); disabled hasta que haya venue + ambas fechas.
 */
export function useBusinessSummary({ from, to, enabled = true }: PeriodArgs) {
  const { venueId } = useCurrentVenue()

  const query = useQuery<BusinessSummaryResponse>({
    queryKey: accountingKeys.businessSummary(venueId, from, to),
    queryFn: () => fetchBusinessSummary(venueId!, from, to),
    enabled: !!venueId && enabled && !!from && !!to,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    // B4b (Codex r5 R5-8): REPORT_TOO_LARGE / REPORT_TIMEOUT no se repiten solos; lo demás, una vez como antes.
    retry: reintentarReporte(1),
    // I1 (revisión final): tampoco al recuperar el foco ni al reconectar.
    refetchOnWindowFocus: repetirAlVolver,
    refetchOnReconnect: repetirAlVolver,
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

/**
 * Bancos y cajas (Capa A) — cuentas de dinero del venue activo.
 */
export function useBankAndCash({ from, to, enabled = true }: PeriodArgs) {
  const { venueId } = useCurrentVenue()

  const query = useQuery<BankAndCashResponse>({
    queryKey: accountingKeys.banks(venueId, from, to),
    queryFn: () => fetchBankAndCash(venueId!, from, to),
    enabled: !!venueId && enabled && !!from && !!to,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}
