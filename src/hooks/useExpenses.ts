import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import {
  createExpense,
  generateExpensePolicies,
  getDiot,
  getExpenses,
  importExpenseXml,
  markExpensePaid,
  expenseKeys,
  type DiotResponse,
  type ExpensePaymentStatus,
  type ExpensesResponse,
  type NewExpense,
} from '@/services/fiscal/expense.service'

/** Buzón de gastos del venue activo. `enabled:false` desde el teaser (paywall). */
export function useExpenses(filters: { period?: string; paymentStatus?: ExpensePaymentStatus; proveedorRfc?: string } = {}, options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()
  const enabled = options?.enabled ?? true

  return useQuery<ExpensesResponse>({
    queryKey: expenseKeys.list(venueId, filters as Record<string, string | undefined>),
    queryFn: () => getExpenses(venueId!, filters),
    enabled: !!venueId && enabled,
    staleTime: 30 * 1000,
  })
}

/** Registra un gasto / CFDI recibido. Permiso accounting:manage. */
export function useCreateExpense() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('reports')

  return useMutation({
    mutationFn: (expense: NewExpense) => createExpense(venueId!, expense),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all })
      toast({ title: t('expenses.toast.created') })
    },
    onError: (err: any) => {
      toast({ title: t('expenses.toast.createError'), description: err?.response?.data?.message ?? err?.message ?? '', variant: 'destructive' })
    },
  })
}

/** Importa un gasto desde el XML de un CFDI recibido. Permiso accounting:manage. */
export function useImportExpenseXml() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('reports')

  return useMutation({
    mutationFn: (xml: string) => importExpenseXml(venueId!, xml),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all })
      toast({ title: t('expenses.toast.imported') })
    },
    onError: (err: any) => {
      toast({ title: t('expenses.toast.importError'), description: err?.response?.data?.message ?? err?.message ?? '', variant: 'destructive' })
    },
  })
}

/** Postea las pólizas de gasto del periodo. Permiso accounting:manage. */
export function useGenerateExpensePolicies() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('reports')

  return useMutation({
    mutationFn: (period?: string) => generateExpensePolicies(venueId!, period),
    onSuccess: r => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all })
      queryClient.invalidateQueries({ queryKey: ['journal'] })
      if (r.missingMappings.length > 0) {
        toast({ title: t('expenses.toast.generateMapping'), description: r.missingMappings.join(', '), variant: 'destructive' })
      } else if (r.posted === 0) {
        toast({ title: t('expenses.toast.generateNone', { already: r.alreadyPosted }) })
      } else {
        toast({ title: t('expenses.toast.generated', { posted: r.posted }) })
      }
    },
    onError: (err: any) => {
      toast({ title: t('expenses.toast.generateError'), description: err?.response?.data?.message ?? err?.message ?? '', variant: 'destructive' })
    },
  })
}

/** Marca un gasto como pagado (cash-basis). Permiso accounting:manage. */
export function useMarkExpensePaid() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('reports')

  return useMutation({
    mutationFn: ({ expenseId, fechaPago }: { expenseId: string; fechaPago: string }) => markExpensePaid(venueId!, expenseId, fechaPago),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all })
      queryClient.invalidateQueries({ queryKey: ['journal'] })
      toast({ title: t('expenses.toast.markedPaid') })
    },
    onError: (err: any) => {
      toast({ title: t('expenses.toast.markPaidError'), description: err?.response?.data?.message ?? err?.message ?? '', variant: 'destructive' })
    },
  })
}

/** DIOT del periodo. `enabled:false` desde el teaser (paywall). */
export function useDiot(period: string, options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()
  const enabled = options?.enabled ?? true

  return useQuery<DiotResponse>({
    queryKey: expenseKeys.diot(venueId, period),
    queryFn: () => getDiot(venueId!, period),
    enabled: !!venueId && enabled,
    staleTime: 30 * 1000,
  })
}
