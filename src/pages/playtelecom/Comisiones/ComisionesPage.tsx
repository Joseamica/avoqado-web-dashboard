/**
 * PlayTelecom — Comisiones (Cash Out)
 *
 * Back-office config + payout view for the same-day promoter commission scheme:
 *  - Escalated rate table per sale type (Línea Nueva / Portabilidad).
 *  - Active-days calendar (which days the scheme is on).
 *  - Withdrawals (retiros) + "Generar reporte" for Finanzas (SPEI dispersion).
 *
 * Gated by SERIALIZED_INVENTORY (route guard) + cash-out:* permissions (backend).
 * Amounts are PESOS. Backend: /api/v1/dashboard/cash-out/*.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Save, Loader2, FileText, CalendarDays, Coins } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { GlassCard } from '@/components/ui/glass-card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { cashOutService, type CashOutRate, type CashOutSaleType } from '@/services/cashOut.service'

const SALE_TYPES: { type: CashOutSaleType; labelKey: string; fallback: string }[] = [
  { type: 'LINEA_NUEVA', labelKey: 'comisiones.lineaNueva', fallback: 'Línea Nueva' },
  { type: 'PORTABILIDAD', labelKey: 'comisiones.portabilidad', fallback: 'Portabilidad' },
]

const STATUS_VARIANT: Record<string, string> = {
  REQUESTED: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  REPORTED: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  PAID: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  FAILED: 'bg-destructive/15 text-destructive',
}

export default function ComisionesPage() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const qc = useQueryClient()

  const errMsg = (e: unknown) =>
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? (e as Error)?.message ?? 'Error'
  const fail = (e: unknown) =>
    toast({ title: t('common:error', { defaultValue: 'Error' }), description: errMsg(e), variant: 'destructive' })

  // ---------- Rate table ----------
  const ratesQuery = useQuery({
    queryKey: ['cash-out-rates', venueId],
    queryFn: () => cashOutService.getRates(venueId as string),
    enabled: !!venueId,
  })
  // Local draft (null = pristine, mirror the query). Widened amounts to allow clearable inputs.
  const [draft, setDraft] = useState<CashOutRate[] | null>(null)
  const rates = draft ?? ratesQuery.data ?? []
  const dirty = draft !== null

  const setRate = (idx: number, patch: Partial<CashOutRate>) => {
    setDraft(rates.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }
  const addTier = (saleType: CashOutSaleType) => {
    const existing = rates.filter(r => r.saleType === saleType)
    const lastMax = existing.reduce((m, r) => Math.max(m, r.maxCount ?? r.minCount), 0)
    setDraft([...rates, { saleType, minCount: lastMax + 1, maxCount: null, amount: 0 }])
  }
  const removeTier = (idx: number) => setDraft(rates.filter((_, i) => i !== idx))

  const saveRates = useMutation({
    mutationFn: () => cashOutService.saveRates(venueId as string, rates),
    onSuccess: () => {
      toast({ title: t('comisiones.ratesSaved', { defaultValue: 'Tarifas guardadas' }) })
      setDraft(null)
      qc.invalidateQueries({ queryKey: ['cash-out-rates', venueId] })
    },
    onError: fail,
  })

  // ---------- Active days ----------
  const daysQuery = useQuery({
    queryKey: ['cash-out-days', venueId],
    queryFn: () => cashOutService.getActiveDays(venueId as string),
    enabled: !!venueId,
  })
  const [daysDraft, setDaysDraft] = useState<string[] | null>(null)
  const activeDays = (daysDraft ?? daysQuery.data ?? []).slice().sort()
  const daysDirty = daysDraft !== null
  const [newDay, setNewDay] = useState('')

  const addDay = () => {
    if (newDay && !activeDays.includes(newDay)) setDaysDraft([...activeDays, newDay])
    setNewDay('')
  }
  const removeDay = (d: string) => setDaysDraft(activeDays.filter(x => x !== d))
  const saveDays = useMutation({
    mutationFn: () => cashOutService.saveActiveDays(venueId as string, activeDays),
    onSuccess: () => {
      toast({ title: t('comisiones.daysSaved', { defaultValue: 'Días guardados' }) })
      setDaysDraft(null)
      qc.invalidateQueries({ queryKey: ['cash-out-days', venueId] })
    },
    onError: fail,
  })

  // ---------- Withdrawals + report ----------
  const withdrawalsQuery = useQuery({
    queryKey: ['cash-out-withdrawals', venueId],
    queryFn: () => cashOutService.listWithdrawals(venueId as string),
    enabled: !!venueId,
  })
  const withdrawals = useMemo(() => withdrawalsQuery.data ?? [], [withdrawalsQuery.data])
  const pending = useMemo(() => withdrawals.filter(w => w.status === 'REQUESTED').length, [withdrawals])

  const genReport = useMutation({
    mutationFn: () => cashOutService.generateReport(venueId as string),
    onSuccess: r => {
      toast({
        title: t('comisiones.reportGenerated', { defaultValue: 'Reporte generado' }),
        description: t('comisiones.reportSummary', { defaultValue: `${r.count} retiros · $${r.totalNet} a dispersar`, count: r.count, total: r.totalNet }),
      })
      qc.invalidateQueries({ queryKey: ['cash-out-withdrawals', venueId] })
    },
    onError: fail,
  })

  return (
    <div className="space-y-6">
      {/* ---- Rate table ---- */}
      <GlassCard className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Coins className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">{t('comisiones.ratesTitle', { defaultValue: 'Tabla de comisiones escalonada' })}</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          {t('comisiones.ratesHelp', { defaultValue: 'El monto de la comisión depende de las ventas acumuladas en la semana (Lun–Dom). El último tramo debe quedar abierto (sin máximo).' })}
        </p>

        {ratesQuery.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {SALE_TYPES.map(({ type, labelKey, fallback }) => {
              const idxs = rates.map((r, i) => ({ r, i })).filter(x => x.r.saleType === type)
              return (
                <div key={type} className="rounded-xl border border-input p-4">
                  <h3 className="mb-3 text-sm font-semibold">{t(labelKey, { defaultValue: fallback })}</h3>
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_1fr_1.2fr_auto] gap-2 text-[11px] uppercase text-muted-foreground">
                      <span>{t('comisiones.from', { defaultValue: 'Desde' })}</span>
                      <span>{t('comisiones.to', { defaultValue: 'Hasta' })}</span>
                      <span>{t('comisiones.amount', { defaultValue: 'Comisión ($)' })}</span>
                      <span />
                    </div>
                    {idxs.map(({ r, i }) => (
                      <div key={i} className="grid grid-cols-[1fr_1fr_1.2fr_auto] items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          value={r.minCount ?? ''}
                          onChange={e => setRate(i, { minCount: e.target.value === '' ? (undefined as unknown as number) : parseInt(e.target.value, 10) })}
                        />
                        <Input
                          type="number"
                          min={1}
                          placeholder={t('comisiones.openTier', { defaultValue: '∞' })}
                          value={r.maxCount ?? ''}
                          onChange={e => setRate(i, { maxCount: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                        />
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={r.amount ?? ''}
                          onChange={e => setRate(i, { amount: e.target.value === '' ? (undefined as unknown as number) : parseFloat(e.target.value) })}
                        />
                        <Button variant="ghost" size="icon" className="cursor-pointer text-muted-foreground hover:text-destructive" onClick={() => removeTier(i)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="mt-1 cursor-pointer" onClick={() => addTier(type)}>
                      <Plus className="mr-1 h-4 w-4" /> {t('comisiones.addTier', { defaultValue: 'Agregar tramo' })}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button className="cursor-pointer" disabled={!dirty || saveRates.isPending} onClick={() => saveRates.mutate()}>
            {saveRates.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            {t('common:save', { defaultValue: 'Guardar' })}
          </Button>
        </div>
      </GlassCard>

      {/* ---- Active days ---- */}
      <GlassCard className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">{t('comisiones.daysTitle', { defaultValue: 'Días activos del esquema' })}</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          {t('comisiones.daysHelp', { defaultValue: 'En estos días el promotor puede retirar su comisión. No puede coexistir con el concurso de comisiones.' })}
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {daysQuery.isLoading ? (
            <Skeleton className="h-7 w-48" />
          ) : activeDays.length === 0 ? (
            <span className="text-sm text-muted-foreground">{t('comisiones.noDays', { defaultValue: 'Sin días activos' })}</span>
          ) : (
            activeDays.map(d => (
              <Badge key={d} variant="secondary" className="cursor-pointer gap-1" onClick={() => removeDay(d)}>
                {d} <Trash2 className="h-3 w-3" />
              </Badge>
            ))
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={newDay} onChange={e => setNewDay(e.target.value)} className="w-44" />
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={addDay}>
            <Plus className="mr-1 h-4 w-4" /> {t('comisiones.addDay', { defaultValue: 'Agregar día' })}
          </Button>
          <Button className="ml-auto cursor-pointer" disabled={!daysDirty || saveDays.isPending} onClick={() => saveDays.mutate()}>
            {saveDays.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            {t('common:save', { defaultValue: 'Guardar' })}
          </Button>
        </div>
      </GlassCard>

      {/* ---- Withdrawals + report ---- */}
      <GlassCard className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">{t('comisiones.withdrawalsTitle', { defaultValue: 'Retiros y reporte de dispersión' })}</h2>
          {pending > 0 && (
            <Badge variant="secondary" className="ml-1">
              {t('comisiones.pendingCount', { defaultValue: `${pending} por dispersar`, count: pending })}
            </Badge>
          )}
          <Button
            className="ml-auto cursor-pointer"
            disabled={pending === 0 || genReport.isPending}
            onClick={() => genReport.mutate()}
          >
            {genReport.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileText className="mr-1 h-4 w-4" />}
            {t('comisiones.generateReport', { defaultValue: 'Generar reporte (corte)' })}
          </Button>
        </div>

        {withdrawalsQuery.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : withdrawals.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('comisiones.noWithdrawals', { defaultValue: 'Aún no hay retiros.' })}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase text-muted-foreground">
                <tr className="border-b border-input">
                  <th className="py-2 pr-3 font-medium">{t('comisiones.folio', { defaultValue: 'Folio' })}</th>
                  <th className="py-2 pr-3 font-medium">{t('comisiones.promoter', { defaultValue: 'Promotor' })}</th>
                  <th className="py-2 pr-3 font-medium">CLABE</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('comisiones.net', { defaultValue: 'Neto' })}</th>
                  <th className="py-2 pr-3 font-medium">{t('comisiones.status', { defaultValue: 'Estado' })}</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map(w => (
                  <tr key={w.id} className="border-b border-input/50">
                    <td className="py-2 pr-3 font-mono text-xs">{w.folio}</td>
                    <td className="py-2 pr-3">{w.staffId}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{w.clabe ?? '—'}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">${w.netAmount}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_VARIANT[w.status] ?? ''}`}>{w.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  )
}
