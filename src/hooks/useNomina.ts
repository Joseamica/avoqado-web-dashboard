import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import {
  createEmployee,
  getEmployees,
  getPayrollPreview,
  runPayroll,
  stampPayroll,
  nominaKeys,
  type EmployeesResponse,
  type NewEmployee,
  type PayrollPeriodicity,
  type PayrollPreviewResponse,
} from '@/services/fiscal/nomina.service'

export function useEmployees(options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()
  return useQuery<EmployeesResponse>({
    queryKey: nominaKeys.employees(venueId),
    queryFn: () => getEmployees(venueId!),
    enabled: !!venueId && (options?.enabled ?? true),
    staleTime: 30 * 1000,
  })
}

export function useCreateEmployee() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('reports')
  return useMutation({
    mutationFn: (employee: NewEmployee) => createEmployee(venueId!, employee),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: nominaKeys.all })
      toast({ title: t('nomina.toast.employeeCreated') })
    },
    onError: (err: any) => toast({ title: t('nomina.toast.employeeError'), description: err?.response?.data?.message ?? err?.message ?? '', variant: 'destructive' }),
  })
}

export function usePayrollPreview(period: string, periodicidad: PayrollPeriodicity, options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()
  return useQuery<PayrollPreviewResponse>({
    queryKey: nominaKeys.preview(venueId, period, periodicidad),
    queryFn: () => getPayrollPreview(venueId!, period, periodicidad),
    enabled: !!venueId && (options?.enabled ?? true),
    staleTime: 30 * 1000,
  })
}

export function useRunPayroll() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('reports')
  return useMutation({
    mutationFn: ({ period, periodicidad, fechaPago }: { period: string; periodicidad: PayrollPeriodicity; fechaPago: string }) => runPayroll(venueId!, period, periodicidad, fechaPago),
    onSuccess: r => {
      queryClient.invalidateQueries({ queryKey: nominaKeys.all })
      queryClient.invalidateQueries({ queryKey: ['journal'] })
      if (r.missingMappings.length > 0) toast({ title: t('nomina.toast.runMapping'), description: r.missingMappings.join(', '), variant: 'destructive' })
      else if (r.alreadyExists) toast({ title: t('nomina.toast.runExists') })
      else toast({ title: t('nomina.toast.runPosted', { empleados: r.totals.empleados }) })
    },
    onError: (err: any) => toast({ title: t('nomina.toast.runError'), description: err?.response?.data?.message ?? err?.message ?? '', variant: 'destructive' }),
  })
}

/** Timbra los recibos de nómina (CFDI) de una corrida. Permiso accounting:manage. */
export function useStampPayroll() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation('reports')
  return useMutation({
    mutationFn: (payrollRunId: string) => stampPayroll(venueId!, payrollRunId),
    onSuccess: r => {
      queryClient.invalidateQueries({ queryKey: nominaKeys.all })
      if (r.needsCsd) toast({ title: t('nomina.toast.stampNeedsCsd'), variant: 'destructive' })
      else if (r.errors.length > 0) toast({ title: t('nomina.toast.stampErrors', { stamped: r.stamped, errors: r.errors.length }), variant: 'destructive' })
      else toast({ title: t('nomina.toast.stamped', { stamped: r.stamped }) })
    },
    onError: (err: any) => toast({ title: t('nomina.toast.stampError'), description: err?.response?.data?.message ?? err?.message ?? '', variant: 'destructive' }),
  })
}
