import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { DateTime } from 'luxon'
import { Download, FileText, FileSpreadsheet, FileType2, Loader2, Crown } from 'lucide-react'

import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { FilterPill, FilterPopoverHeader, FilterPopoverFooter } from '@/components/filters/FilterPill'
import { DateRangePicker } from '@/components/date-range-picker'
import { useToast } from '@/hooks/use-toast'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { teamService } from '@/services/team.service'
import type { MerchantAccount } from '@/services/paymentProvider.service'
import type { PaymentMethodFilter, CardTypeFilter } from '@/services/reports/salesSummary.service'
import api from '@/api'

export type SalesExportFormat = 'csv' | 'xlsx' | 'pdf'
export type SalesExportMode = 'summary' | 'detailed'

interface SalesSummaryExportDialogProps {
  open: boolean
  onClose: () => void
  venueId?: string
  initialDateFrom: Date
  initialDateTo: Date
  /** Seed values from the page's current filters — editable inside the dialog. */
  initialPaymentMethod?: PaymentMethodFilter | null
  initialCardType?: CardTypeFilter | null
  initialMerchantAccountId?: string | null
  /** Merchant accounts already loaded on the page (getVenueMerchantAccountsByVenueId). */
  merchantAccounts?: MerchantAccount[]
  estimatedCount?: number
}

const SUMMARY_SECTIONS = ['totals', 'paymentMethods', 'cardTypes', 'merchantAccounts', 'byPeriod'] as const
const DETAIL_COLUMNS = [
  'createdAt', 'paymentId', 'waiterName', 'merchantAccount', 'method',
  'cardBrand', 'last4', 'international', 'amount', 'tipAmount', 'totalAmount', 'status', 'source',
] as const
const REQUIRED_COLUMNS = new Set<string>(['createdAt', 'amount'])

const PAYMENT_METHODS: PaymentMethodFilter[] = ['CASH', 'CARD', 'OTHER']
const CARD_TYPES: CardTypeFilter[] = ['CREDIT', 'DEBIT', 'AMEX', 'INTERNATIONAL']

export function SalesSummaryExportDialog({
  open, onClose, venueId, initialDateFrom, initialDateTo,
  initialPaymentMethod, initialCardType, initialMerchantAccountId, merchantAccounts = [], estimatedCount,
}: SalesSummaryExportDialogProps) {
  const { t } = useTranslation('reports')
  const { toast } = useToast()
  const { hasAccess: canDetailedExport } = useTierFeatureAccess('TRANSACTION_EXPORT')

  const [mode, setMode] = useState<SalesExportMode>('summary')
  const [format, setFormat] = useState<SalesExportFormat>('csv')
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({ from: initialDateFrom, to: initialDateTo })
  const [sections, setSections] = useState<Set<string>>(() => new Set(['totals', 'paymentMethods']))
  const [columns, setColumns] = useState<Set<string>>(() => new Set(DETAIL_COLUMNS))
  const [isExporting, setIsExporting] = useState(false)

  // ── EDITABLE FILTER STATE (seeded from the page, changeable in the dialog) ──
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodFilter | null>(initialPaymentMethod ?? null)
  const [cardType, setCardType] = useState<CardTypeFilter | null>(initialCardType ?? null)
  const [merchantAccountId, setMerchantAccountId] = useState<string | null>(initialMerchantAccountId ?? null)
  const [staffIds, setStaffIds] = useState<string[]>([]) // detailed mode only
  const [shiftId, setShiftId] = useState<string | null>(null) // detailed mode only

  // Staff list — only fetch when the staff pill can be shown (detailed mode, dialog open).
  const { data: teamResp } = useQuery({
    queryKey: ['exportDialogTeam', venueId],
    queryFn: () => teamService.getTeamMembers(venueId!, 1, 100),
    enabled: open && mode === 'detailed' && !!venueId,
    staleTime: 5 * 60 * 1000,
  })
  const staffList = teamResp?.data ?? []

  // Shift list — GET /venues/:id/shifts (paginated). Same gate as staff.
  const { data: shiftsResp } = useQuery({
    queryKey: ['exportDialogShifts', venueId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/dashboard/venues/${venueId}/shifts`, { params: { page: 1, pageSize: 100 } })
      return res.data as { data: Array<{ id: string; startTime?: string; staff?: { firstName?: string; lastName?: string } }> }
    },
    enabled: open && mode === 'detailed' && !!venueId,
    staleTime: 5 * 60 * 1000,
  })
  const shiftList = shiftsResp?.data ?? []

  const endpoint = useMemo(
    () => `/api/v1/dashboard/reports/venues/${venueId}/sales-summary/export`,
    [venueId],
  )

  // FIX 7: card-type detail (summary section) is only produced when NO paymentMethod filter is
  // active (getSalesSummary builds byPaymentMethodDetailed for the unfiltered view only). Disable
  // the checkbox + drop the section when a paymentMethod filter is set, so the user can't pick a
  // section that silently yields nothing.
  const cardTypesSectionDisabled = mode === 'summary' && paymentMethod !== null

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string, required = false) => {
    if (required) return
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setter(next)
  }

  const showPdfWarning = format === 'pdf' && mode === 'detailed' && estimatedCount !== undefined && estimatedCount > 1000

  // Active-filter labels for the pills (theme-aware inverted pill renders the value).
  const merchantLabel = merchantAccountId
    ? merchantAccounts.find(m => m.id === merchantAccountId)?.displayName
      || merchantAccounts.find(m => m.id === merchantAccountId)?.alias
      || merchantAccounts.find(m => m.id === merchantAccountId)?.provider?.name
      || merchantAccountId
    : null
  const paymentLabel = paymentMethod
    ? t(`salesSummary.export.filters.paymentMethodOptions.${paymentMethod.toLowerCase()}`)
    : null
  const cardLabel = cardType ? t(`salesSummary.export.filters.cardTypeOptions.${cardType.toLowerCase()}`) : null
  const shiftLabel = shiftId
    ? (shiftList.find(s => s.id === shiftId)?.startTime
        ? DateTime.fromISO(shiftList.find(s => s.id === shiftId)!.startTime!).toFormat('dd LLL HH:mm')
        : shiftId)
    : null

  const handleExport = async () => {
    if (mode === 'detailed' && !canDetailedExport) return // gated; UI shows upsell
    setIsExporting(true)
    try {
      // Drop the card-type detail section if a payment filter is active (see FIX 7).
      const effectiveSections = cardTypesSectionDisabled
        ? Array.from(sections).filter(s => s !== 'cardTypes')
        : Array.from(sections)
      const params: Record<string, string> = {
        mode,
        format,
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
        // Editable filters (both modes):
        ...(paymentMethod ? { paymentMethod } : {}),
        ...(paymentMethod === 'CARD' && cardType ? { cardType } : {}),
        ...(merchantAccountId ? { merchantAccountId } : {}),
        // Detailed-mode-only filters:
        ...(mode === 'detailed' && staffIds.length > 0 ? { staffIds: staffIds.join(',') } : {}),
        ...(mode === 'detailed' && shiftId ? { shiftId } : {}),
        ...(mode === 'summary' ? { sections: effectiveSections.join(',') } : { columns: Array.from(columns).join(',') }),
      }
      const response = await api.get(endpoint, { params, responseType: 'blob' })
      const ext = format === 'xlsx' ? 'xlsx' : format
      const stamp = DateTime.now().toFormat('yyyy-LL-dd')
      const stem = mode === 'detailed' ? 'ventas-detalladas' : 'resumen-ventas'
      const filename = `${stem}-${stamp}.${ext}`
      const url = window.URL.createObjectURL(response.data as Blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast({ title: t('salesSummary.export.button') })
      onClose()
    } catch (err: any) {
      // responseType:'blob' -> error body is a Blob; pull the message out.
      let message = t('salesSummary.export.tooLargeHint') as string
      const status = err?.response?.status
      const data = err?.response?.data
      if (data instanceof Blob) {
        try {
          const parsed = JSON.parse(await data.text())
          if (parsed?.message) message = parsed.message
        } catch { /* keep fallback */ }
      } else if (data?.message) {
        message = data.message
      }
      toast({
        title: status === 413 ? t('salesSummary.export.tooLarge') : message,
        description: status === 413 ? message : undefined,
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const detailedDisabled = !canDetailedExport

  return (
    <FullScreenModal
      open={open}
      onClose={onClose}
      title={t('salesSummary.export.title')}
      contentClassName="bg-muted/30"
      actions={
        <Button
          onClick={handleExport}
          disabled={isExporting || (mode === 'detailed' && detailedDisabled)}
          className="cursor-pointer"
          data-tour="export-dialog-submit"
        >
          {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {t('salesSummary.export.button')}
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        {/* Mode toggle */}
        <section className="rounded-2xl border border-input bg-card p-6">
          <h3 className="mb-4 text-base font-semibold">{t('salesSummary.export.mode.label')}</h3>
          <RadioGroup value={mode} onValueChange={v => setMode(v as SalesExportMode)} className="grid gap-3 sm:grid-cols-2">
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${mode === 'summary' ? 'border-primary bg-primary/5' : 'border-input bg-background hover:bg-muted/40'}`}>
              <RadioGroupItem value="summary" id="mode-summary" className="mt-1" />
              <div>
                <Label htmlFor="mode-summary" className="cursor-pointer font-semibold">{t('salesSummary.export.mode.summary')}</Label>
                <p className="mt-1 text-xs text-muted-foreground">{t('salesSummary.export.mode.summaryDesc')}</p>
              </div>
            </label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${detailedDisabled ? 'opacity-70' : ''} ${mode === 'detailed' ? 'border-primary bg-primary/5' : 'border-input bg-background hover:bg-muted/40'}`}>
              <RadioGroupItem value="detailed" id="mode-detailed" className="mt-1" disabled={detailedDisabled} />
              <div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="mode-detailed" className="cursor-pointer font-semibold">{t('salesSummary.export.mode.detailed')}</Label>
                  <Badge variant="outline" className="h-4 px-1.5 text-[10px]"><Crown className="mr-0.5 h-2.5 w-2.5" />PREMIUM</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t('salesSummary.export.mode.detailedDesc')}</p>
              </div>
            </label>
          </RadioGroup>
          {mode === 'detailed' && detailedDisabled && (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
              {t('salesSummary.export.premium.body')}
            </p>
          )}
        </section>

        {/* Date range filter pill */}
        <section className="rounded-2xl border border-input bg-card p-6">
          <DateRangePicker
            initialDateFrom={dateRange.from}
            initialDateTo={dateRange.to}
            showCompare={false}
            onUpdate={({ range }) => range?.from && range?.to && setDateRange({ from: range.from, to: range.to })}
          />
        </section>

        {/* Editable filter pills (FilterPill pattern) — seeded from the page, changeable here.
            payment method + card type + merchant = both modes; staff + shift = detailed only. */}
        <section className="rounded-2xl border border-input bg-card p-6">
          <h3 className="mb-4 text-base font-semibold">{t('salesSummary.export.filters.label')}</h3>
          <div className="flex flex-wrap items-center gap-2">
            {/* Payment method + card type */}
            <FilterPill
              label={t('salesSummary.export.filters.paymentMethod')}
              activeLabel={paymentLabel}
              onClear={() => { setPaymentMethod(null); setCardType(null) }}
            >
              <div>
                <FilterPopoverHeader title={t('salesSummary.export.filters.paymentMethod')} />
                <div className="p-2">
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
                    <input
                      type="radio"
                      name="export-pm"
                      checked={paymentMethod === null}
                      onChange={() => { setPaymentMethod(null); setCardType(null) }}
                    />
                    <span className="text-sm">{t('salesSummary.export.filters.paymentMethodOptions.all')}</span>
                  </label>
                  {PAYMENT_METHODS.map(pm => (
                    <label key={pm} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
                      <input
                        type="radio"
                        name="export-pm"
                        checked={paymentMethod === pm}
                        onChange={() => { setPaymentMethod(pm); if (pm !== 'CARD') setCardType(null) }}
                      />
                      <span className="text-sm">{t(`salesSummary.export.filters.paymentMethodOptions.${pm.toLowerCase()}`)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </FilterPill>

            {/* Card type — only relevant when paymentMethod=CARD */}
            {paymentMethod === 'CARD' && (
              <FilterPill
                label={t('salesSummary.export.filters.cardType')}
                activeLabel={cardLabel}
                onClear={() => setCardType(null)}
              >
                <div>
                  <FilterPopoverHeader title={t('salesSummary.export.filters.cardType')} />
                  <div className="p-2">
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
                      <input type="radio" name="export-ct" checked={cardType === null} onChange={() => setCardType(null)} />
                      <span className="text-sm">{t('salesSummary.export.filters.cardTypeOptions.all')}</span>
                    </label>
                    {CARD_TYPES.map(ct => (
                      <label key={ct} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
                        <input type="radio" name="export-ct" checked={cardType === ct} onChange={() => setCardType(ct)} />
                        <span className="text-sm">{t(`salesSummary.export.filters.cardTypeOptions.${ct.toLowerCase()}`)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </FilterPill>
            )}

            {/* Merchant account — only when the venue has >1 */}
            {merchantAccounts.length > 1 && (
              <FilterPill
                label={t('salesSummary.export.filters.merchant')}
                activeLabel={merchantLabel}
                onClear={() => setMerchantAccountId(null)}
              >
                <div>
                  <FilterPopoverHeader title={t('salesSummary.export.filters.merchant')} />
                  <div className="max-h-64 overflow-auto p-2">
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
                      <input type="radio" name="export-ma" checked={merchantAccountId === null} onChange={() => setMerchantAccountId(null)} />
                      <span className="text-sm">{t('salesSummary.export.filters.merchantOptions.all')}</span>
                    </label>
                    {merchantAccounts.map(ma => (
                      <label key={ma.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
                        <input type="radio" name="export-ma" checked={merchantAccountId === ma.id} onChange={() => setMerchantAccountId(ma.id)} />
                        <span className="text-sm">{ma.displayName || ma.alias || ma.provider?.name || ma.id}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </FilterPill>
            )}

            {/* Staff/waiter — DETAILED MODE ONLY (multi-select). getSalesSummary filters by
                bucket, not by individual staff, so this pill is hidden in summary mode. */}
            {mode === 'detailed' && (
              <FilterPill
                label={t('salesSummary.export.filters.staff')}
                activeCount={staffIds.length}
                onClear={() => setStaffIds([])}
              >
                <div>
                  <FilterPopoverHeader title={t('salesSummary.export.filters.staff')} />
                  <div className="max-h-64 overflow-auto p-2">
                    {staffList.map(s => {
                      const checked = staffIds.includes(s.staffId)
                      return (
                        <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() =>
                              setStaffIds(prev => (checked ? prev.filter(id => id !== s.staffId) : [...prev, s.staffId]))
                            }
                          />
                          <span className="text-sm">{`${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || s.id}</span>
                        </label>
                      )
                    })}
                  </div>
                  <FilterPopoverFooter onApply={() => {}} onClear={() => setStaffIds([])} showClear={staffIds.length > 0} />
                </div>
              </FilterPill>
            )}

            {/* Shift — DETAILED MODE ONLY */}
            {mode === 'detailed' && (
              <FilterPill
                label={t('salesSummary.export.filters.shift')}
                activeLabel={shiftLabel}
                onClear={() => setShiftId(null)}
              >
                <div>
                  <FilterPopoverHeader title={t('salesSummary.export.filters.shift')} />
                  <div className="max-h-64 overflow-auto p-2">
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
                      <input type="radio" name="export-shift" checked={shiftId === null} onChange={() => setShiftId(null)} />
                      <span className="text-sm">{t('salesSummary.export.filters.shiftOptions.all')}</span>
                    </label>
                    {shiftList.map(s => (
                      <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
                        <input type="radio" name="export-shift" checked={shiftId === s.id} onChange={() => setShiftId(s.id)} />
                        <span className="text-sm">
                          {s.startTime ? DateTime.fromISO(s.startTime).toFormat('dd LLL HH:mm') : s.id}
                          {s.staff ? ` · ${`${s.staff.firstName ?? ''} ${s.staff.lastName ?? ''}`.trim()}` : ''}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </FilterPill>
            )}
          </div>
        </section>

        {/* Section / column picker */}
        <section className="rounded-2xl border border-input bg-card p-6">
          {mode === 'summary' ? (
            <>
              <h3 className="mb-4 text-base font-semibold">{t('salesSummary.export.sections.label')}</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {SUMMARY_SECTIONS.map(id => {
                  // FIX 7: card-type detail needs the unfiltered view — disable under a payment filter.
                  const disabled = id === 'cardTypes' && cardTypesSectionDisabled
                  return (
                    <label
                      key={id}
                      className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2 ${disabled ? 'opacity-50' : 'cursor-pointer'} ${sections.has(id) && !disabled ? 'border-primary/40 bg-primary/5' : 'border-input bg-background hover:bg-muted/40'}`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={sections.has(id) && !disabled}
                          disabled={disabled}
                          onCheckedChange={() => toggle(sections, setSections, id, disabled)}
                        />
                        <span className="text-sm">{t(`salesSummary.export.sections.${id}`)}</span>
                      </div>
                      {disabled && (
                        <span className="ml-7 text-xs text-muted-foreground">{t('salesSummary.export.sections.cardTypesDisabledHint')}</span>
                      )}
                    </label>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <h3 className="mb-4 text-base font-semibold">{t('salesSummary.export.columns.label')}</h3>
              {estimatedCount !== undefined && (
                <p className="mb-3 text-sm text-muted-foreground">{t('salesSummary.export.estimatedCount', { count: estimatedCount })}</p>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {DETAIL_COLUMNS.map(id => {
                  const required = REQUIRED_COLUMNS.has(id)
                  return (
                    <label key={id} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 ${columns.has(id) ? 'border-primary/40 bg-primary/5' : 'border-input bg-background hover:bg-muted/40'} ${required ? 'opacity-70' : ''}`}>
                      <Checkbox checked={columns.has(id)} onCheckedChange={() => toggle(columns, setColumns, id, required)} disabled={required} />
                      <span className="text-sm">{t(`salesSummary.export.columns.${id}`)}</span>
                    </label>
                  )
                })}
              </div>
            </>
          )}
        </section>

        {/* Format radio */}
        <section className="rounded-2xl border border-input bg-card p-6">
          <h3 className="mb-4 text-base font-semibold">{t('salesSummary.export.format.label')}</h3>
          <RadioGroup value={format} onValueChange={v => setFormat(v as SalesExportFormat)} className="grid gap-3 sm:grid-cols-3">
            {([['csv', FileText], ['xlsx', FileSpreadsheet], ['pdf', FileType2]] as const).map(([fmt, Icon]) => (
              <label key={fmt} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${format === fmt ? 'border-primary bg-primary/5' : 'border-input bg-background hover:bg-muted/40'}`}>
                <RadioGroupItem value={fmt} id={`fmt-${fmt}`} className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor={`fmt-${fmt}`} className="cursor-pointer font-semibold">{t(`salesSummary.export.format.${fmt}`)}</Label>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{t(`salesSummary.export.format.${fmt}Hint`)}</p>
                </div>
              </label>
            ))}
          </RadioGroup>
          {showPdfWarning && (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
              {t('salesSummary.export.tooLargeHint')}
            </p>
          )}
        </section>
      </div>
    </FullScreenModal>
  )
}
