import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AlertTriangle, Landmark, Loader2, Plus, Users } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { AccountingErrorState } from '@/components/accounting/AccountingErrorState'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { useEmployees, useCreateEmployee, usePayrollPreview, useRunPayroll } from '@/hooks/useNomina'
import type { PayrollPeriodicity } from '@/services/fiscal/nomina.service'
import { Currency } from '@/utils/currency'

const peso = (s: string) => Math.round((parseFloat(s) || 0) * 100)

function NominaInner() {
  const { t } = useTranslation('reports')
  const { fullBasePath } = useCurrentVenue()
  const { can } = useAccess()
  const { hasAccess } = useTierFeatureAccess('CFDI')
  const canManage = can('accounting:manage')
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7))
  const [periodicidad] = useState<PayrollPeriodicity>('MENSUAL')
  const [modalOpen, setModalOpen] = useState(false)

  const empQuery = useEmployees({ enabled: hasAccess })
  const preview = usePayrollPreview(period, periodicidad, { enabled: hasAccess })
  const runMutation = useRunPayroll()
  const employees = empQuery.data?.employees ?? []
  const needsFiscalSetup = hasAccess && empQuery.data?.needsFiscalSetup
  const totals = preview.data?.totals

  return (
    <div className="p-4 space-y-5 bg-background">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('nomina.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {empQuery.data?.rfc
              ? t('subtitleSuffix', { base: t('nomina.subtitle'), suffix: t('chartOfAccounts.rfcLabel', { rfc: empQuery.data.rfc }) })
              : t('nomina.subtitle')}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <label htmlFor="nom-period" className="block text-[10px] text-muted-foreground">{t('trialBalance.period')}</label>
            <Input id="nom-period" type="month" value={period} onChange={e => setPeriod(e.target.value)} className="h-10 w-40" />
          </div>
          {!needsFiscalSetup && canManage && hasAccess && (
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="w-4 h-4" />
              {t('nomina.newEmployee')}
            </Button>
          )}
        </div>
      </header>

      <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-amber-700 dark:text-amber-400">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-xs font-medium">{t('nomina.preliminarBanner')}</p>
      </div>

      {empQuery.isLoading && hasAccess ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : empQuery.isError && hasAccess ? (
        <AccountingErrorState onRetry={() => empQuery.refetch()} />
      ) : needsFiscalSetup ? (
        <Card className="border-input">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Landmark className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{t('chartOfAccounts.needsFiscalSetupTitle')}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t('chartOfAccounts.needsFiscalSetupBody')}</p>
            <Link to={`${fullBasePath}/cfdi/configuracion`}>
              <Button size="sm" variant="outline">{t('chartOfAccounts.goToFiscalConfig')}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : employees.length === 0 ? (
        <Card className="border-input">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Users className="w-8 h-8 text-emerald-500" />
            <p className="text-sm font-medium text-foreground">{t('nomina.emptyTitle')}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t('nomina.emptyBody')}</p>
            {canManage && (
              <Button size="sm" onClick={() => setModalOpen(true)}>
                <Plus className="w-4 h-4" />
                {t('nomina.newEmployee')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Preview de la corrida */}
          <Card className="border-input">
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-input text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-normal">{t('nomina.col.empleado')}</th>
                    <th className="px-3 py-2 text-right font-normal">{t('nomina.col.percepciones')}</th>
                    <th className="px-3 py-2 text-right font-normal">{t('nomina.col.isr')}</th>
                    <th className="px-3 py-2 text-right font-normal">{t('nomina.col.imss')}</th>
                    <th className="px-3 py-2 text-right font-normal">{t('nomina.col.neto')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(preview.data?.lines ?? []).map(l => (
                    <tr key={l.employeeId} className="border-b border-input/40">
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground">{l.nombre}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{l.rfcEmpleado}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{Currency(l.totalPercepcionesCents, true)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{Currency(l.isrRetenidoCents, true)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{Currency(l.imssObreroCents, true)}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums text-foreground">{Currency(l.netoCents, true)}</td>
                    </tr>
                  ))}
                </tbody>
                {totals && (
                  <tfoot>
                    <tr className="border-t border-input font-medium">
                      <td className="px-3 py-2">{t('nomina.total', { count: totals.empleados })}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{Currency(totals.percepcionesCents, true)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{Currency(totals.isrCents, true)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{Currency(totals.imssCents, true)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{Currency(totals.netoCents, true)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </CardContent>
          </Card>

          {canManage && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => runMutation.mutate({ period, periodicidad, fechaPago: `${period}-28` })} disabled={runMutation.isPending || employees.length === 0}>
                {runMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {t('nomina.run')}
              </Button>
            </div>
          )}
        </>
      )}

      <Card className="border-input">
        <CardContent className="py-3 space-y-1 text-xs text-muted-foreground">
          <p>{t('nomina.disclosureEstimate')}</p>
          <p>{t('nomina.disclosurePoliza')}</p>
        </CardContent>
      </Card>

      {modalOpen && <NewEmployeeModal onClose={() => setModalOpen(false)} />}
    </div>
  )
}

function NewEmployeeModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('reports')
  const createMutation = useCreateEmployee()
  const [nombre, setNombre] = useState('')
  const [rfcEmpleado, setRfc] = useState('')
  const [puesto, setPuesto] = useState('')
  const [salario, setSalario] = useState('')
  const [periodicidadPago, setPeriodicidad] = useState<PayrollPeriodicity>('MENSUAL')

  const canSubmit = !!nombre.trim() && !!rfcEmpleado.trim() && peso(salario) > 0 && !createMutation.isPending
  const submit = () => {
    if (!canSubmit) return
    createMutation.mutate(
      { nombre: nombre.trim(), rfcEmpleado: rfcEmpleado.trim().toUpperCase(), puesto: puesto.trim() || null, salarioMensualBrutoCents: peso(salario), periodicidadPago },
      { onSuccess: onClose },
    )
  }

  return (
    <FullScreenModal
      open
      onClose={onClose}
      title={t('nomina.modal.title')}
      contentClassName="bg-muted/30"
      actions={
        <Button size="sm" onClick={submit} disabled={!canSubmit}>
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {t('nomina.modal.save')}
        </Button>
      }
    >
      <div className="mx-auto max-w-xl space-y-4 p-4">
        <div className="rounded-2xl border border-input bg-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('nomina.modal.nombre')}</Label>
              <Input value={nombre} onChange={e => setNombre(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>{t('nomina.modal.rfc')}</Label>
              <Input value={rfcEmpleado} onChange={e => setRfc(e.target.value.toUpperCase())} placeholder="XAXX010101000" className="h-11 font-mono" />
            </div>
            <div className="space-y-2">
              <Label>{t('nomina.modal.puesto')}</Label>
              <Input value={puesto} onChange={e => setPuesto(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>{t('nomina.modal.salario')}</Label>
              <Input type="number" inputMode="decimal" value={salario} onChange={e => setSalario(e.target.value)} placeholder="0.00" className="h-11 text-right" />
            </div>
            <div className="space-y-2">
              <Label>{t('nomina.modal.periodicidad')}</Label>
              <Select value={periodicidadPago} onValueChange={v => setPeriodicidad(v as PayrollPeriodicity)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MENSUAL">{t('nomina.periodicidad.MENSUAL')}</SelectItem>
                  <SelectItem value="QUINCENAL">{t('nomina.periodicidad.QUINCENAL')}</SelectItem>
                  <SelectItem value="SEMANAL">{t('nomina.periodicidad.SEMANAL')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t('nomina.modal.hint')}</p>
        </div>
      </div>
    </FullScreenModal>
  )
}

/**
 * Nómina — empleados + corrida de nómina (estimación). Gated PREMIUM (FeatureGate CFDI).
 * Calcula ISR (tarifa art-96 − subsidio) + IMSS obrero por empleado y postea la póliza.
 */
export default function Nomina() {
  return (
    <FeatureGate feature="CFDI">
      <NominaInner />
    </FeatureGate>
  )
}
