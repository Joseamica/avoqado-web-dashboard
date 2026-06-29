import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { BookOpen, Landmark, Loader2, Lock, Plus, Scale, Sparkles, Trash2 } from 'lucide-react'

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
import { useToast } from '@/hooks/use-toast'
import { useJournal, useCreateJournalEntry, useGeneratePolicies } from '@/hooks/useJournal'
import { usePeriodLocks } from '@/hooks/usePeriodLocks'
import { useChartOfAccounts } from '@/hooks/useChartOfAccounts'
import { PeriodLockCard } from '@/components/accounting/PeriodLockCard'
import type { JournalEntryDTO } from '@/services/fiscal/journalEntry.service'
import type { LedgerAccount } from '@/services/fiscal/chartOfAccounts.service'
import { Currency } from '@/utils/currency'
import { cn } from '@/lib/utils'

const SAMPLE_ENTRIES: JournalEntryDTO[] = [
  {
    id: 's1', date: '2026-06-15', period: '2026-06', folio: 12, type: 'INGRESO', source: 'PAYMENT', status: 'POSTED', concept: 'Cobro del día con tarjeta',
    totalDebitCents: 116000, totalCreditCents: 116000,
    lines: [
      { id: 'l1', ledgerAccountId: 'a', accountCode: '102.01', accountName: 'Bancos nacionales', debitCents: 116000, creditCents: 0, description: null },
      { id: 'l2', ledgerAccountId: 'b', accountCode: '401.01', accountName: 'Ventas tasa general', debitCents: 0, creditCents: 100000, description: null },
      { id: 'l3', ledgerAccountId: 'c', accountCode: '208.01', accountName: 'IVA trasladado cobrado', debitCents: 0, creditCents: 16000, description: null },
    ],
  },
]

const peso = (s: string) => Math.round((parseFloat(s) || 0) * 100)

interface EditorLine {
  ledgerAccountId: string
  debit: string
  credit: string
  description: string
}

function JournalInner() {
  const { t } = useTranslation('reports')
  const { fullBasePath } = useCurrentVenue()
  const { can } = useAccess()
  const { hasAccess } = useTierFeatureAccess('CFDI')
  const canManage = can('accounting:manage')

  const journalQuery = useJournal(undefined, { enabled: hasAccess })
  const generateMutation = useGeneratePolicies()
  const [modalOpen, setModalOpen] = useState(false)

  const data = journalQuery.data
  const entries = hasAccess ? data?.entries ?? [] : SAMPLE_ENTRIES
  const needsFiscalSetup = hasAccess && data?.needsFiscalSetup

  return (
    <div className="p-4 space-y-5 bg-background">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('journal.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {data?.rfc
              ? t('subtitleSuffix', { base: t('journal.subtitle'), suffix: t('chartOfAccounts.rfcLabel', { rfc: data.rfc }) })
              : t('journal.subtitle')}
          </p>
        </div>
        {!needsFiscalSetup && canManage && hasAccess && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => generateMutation.mutate(undefined)}
              disabled={generateMutation.isPending}
              data-tour="journal-generate"
            >
              {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {t('journal.generate')}
            </Button>
            <Button size="sm" onClick={() => setModalOpen(true)} data-tour="journal-new">
              <Plus className="w-4 h-4" />
              {t('journal.newEntry')}
            </Button>
          </div>
        )}
      </header>

      {hasAccess && !needsFiscalSetup && <PeriodLockCard enabled />}

      {journalQuery.isLoading && hasAccess ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : journalQuery.isError && hasAccess ? (
        <AccountingErrorState onRetry={() => journalQuery.refetch()} />
      ) : needsFiscalSetup ? (
        <Card className="border-input">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Landmark className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{t('chartOfAccounts.needsFiscalSetupTitle')}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t('chartOfAccounts.needsFiscalSetupBody')}</p>
            <Link to={`${fullBasePath}/cfdi/configuracion`}>
              <Button size="sm" variant="outline">
                {t('chartOfAccounts.goToFiscalConfig')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : entries.length === 0 ? (
        <Card className="border-input">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <BookOpen className="w-8 h-8 text-emerald-500" />
            <p className="text-sm font-medium text-foreground">{t('journal.emptyTitle')}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t('journal.emptyBody')}</p>
            {canManage && (
              <Button size="sm" onClick={() => setModalOpen(true)}>
                <Plus className="w-4 h-4" />
                {t('journal.newEntry')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map(e => (
            <Card key={e.id} className="border-input">
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-xs text-muted-foreground">#{e.folio}</span>
                      <span className="text-muted-foreground">{e.date}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{t(`journal.source.${e.source}`, { defaultValue: e.source })}</span>
                    </div>
                    <p className="truncate text-sm font-medium text-foreground">{e.concept}</p>
                  </div>
                  <span className="whitespace-nowrap text-sm font-medium tabular-nums text-foreground">{Currency(e.totalDebitCents, true)}</span>
                </div>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-1 pr-2 font-normal">{t('journal.account')}</th>
                        <th className="py-1 pr-2 text-right font-normal">{t('journal.debit')}</th>
                        <th className="py-1 pl-2 text-right font-normal">{t('journal.credit')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {e.lines.map(l => (
                        <tr key={l.id} className="border-t border-input/40">
                          <td className="py-1 pr-2">
                            <span className="font-mono text-muted-foreground">{l.accountCode}</span> {l.accountName}
                          </td>
                          <td className="py-1 pr-2 text-right tabular-nums">{l.debitCents ? Currency(l.debitCents, true) : '—'}</td>
                          <td className="py-1 pl-2 text-right tabular-nums">{l.creditCents ? Currency(l.creditCents, true) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="border-input">
        <CardContent className="py-3 space-y-1 text-xs text-muted-foreground">
          <p>{t('journal.disclosureBalance')}</p>
          <p>{t('journal.disclosureAuto')}</p>
        </CardContent>
      </Card>

      {modalOpen && <NewEntryModal onClose={() => setModalOpen(false)} />}
    </div>
  )
}

/** Modal para crear una póliza manual con editor de líneas + verificación de balance en vivo. */
function NewEntryModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('reports')
  const { toast } = useToast()
  const createMutation = useCreateJournalEntry()
  const chartQuery = useChartOfAccounts()
  const locksQuery = usePeriodLocks()

  const accountOptions = useMemo<LedgerAccount[]>(
    () => (chartQuery.data?.accounts ?? []).filter(a => a.isPostable && a.isActive).sort((a, b) => a.code.localeCompare(b.code)),
    [chartQuery.data],
  )

  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [concept, setConcept] = useState('')
  const [lines, setLines] = useState<EditorLine[]>([
    { ledgerAccountId: '', debit: '', credit: '', description: '' },
    { ledgerAccountId: '', debit: '', credit: '', description: '' },
  ])

  const setLine = (i: number, patch: Partial<EditorLine>) => setLines(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  const addLine = () => setLines(prev => [...prev, { ledgerAccountId: '', debit: '', credit: '', description: '' }])
  const removeLine = (i: number) => setLines(prev => (prev.length > 2 ? prev.filter((_, idx) => idx !== i) : prev))

  const totalDebit = lines.reduce((s, l) => s + peso(l.debit), 0)
  const totalCredit = lines.reduce((s, l) => s + peso(l.credit), 0)
  const diff = totalDebit - totalCredit
  const balanced = totalDebit > 0 && diff === 0

  const linesValid = lines.every(l => {
    const d = peso(l.debit)
    const c = peso(l.credit)
    return l.ledgerAccountId && (d > 0) !== (c > 0)
  })
  const periodLocked = useMemo(
    () => (locksQuery.data?.locks ?? []).some(l => l.status === 'CLOSED' && l.period === date.slice(0, 7)),
    [locksQuery.data, date],
  )
  const canSubmit = !!date && !!concept.trim() && lines.length >= 2 && linesValid && balanced && !periodLocked && !createMutation.isPending

  const submit = () => {
    if (!canSubmit) return
    createMutation.mutate(
      {
        date,
        concept: concept.trim(),
        lines: lines.map(l => ({
          ledgerAccountId: l.ledgerAccountId,
          debitCents: peso(l.debit),
          creditCents: peso(l.credit),
          description: l.description.trim() || null,
        })),
      },
      {
        onSuccess: onClose,
        onError: (err: any) => toast({ title: err?.response?.data?.message ?? t('accountingError.body'), variant: 'destructive' }),
      },
    )
  }

  return (
    <FullScreenModal
      open
      onClose={onClose}
      title={t('journal.modal.title')}
      contentClassName="bg-muted/30"
      actions={
        <Button size="sm" onClick={submit} disabled={!canSubmit}>
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {t('journal.modal.save')}
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('journal.modal.date')}</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-12 text-base" />
          </div>
          <div className="space-y-2">
            <Label>{t('journal.modal.concept')}</Label>
            <Input value={concept} onChange={e => setConcept(e.target.value)} placeholder={t('journal.modal.conceptPh')} className="h-12 text-base" />
          </div>
        </div>

        {periodLocked && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-600 dark:text-amber-400">
            <Lock className="h-4 w-4 shrink-0" />
            <span>{t('periodLock.modalLocked', { period: date.slice(0, 7) })}</span>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t('journal.modal.lines')}</Label>
            <Button type="button" size="sm" variant="outline" onClick={addLine}>
              <Plus className="w-3.5 h-3.5" />
              {t('journal.modal.addLine')}
            </Button>
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex items-end gap-2 rounded-lg border border-input bg-card p-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <Select value={l.ledgerAccountId || undefined} onValueChange={v => setLine(i, { ledgerAccountId: v })}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder={t('journal.modal.pickAccount')} />
                    </SelectTrigger>
                    <SelectContent>
                      {accountOptions.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} · {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24 space-y-1">
                  <span className="text-[10px] text-muted-foreground">{t('journal.debit')}</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={l.debit}
                    onChange={e => setLine(i, { debit: e.target.value, credit: e.target.value ? '' : l.credit })}
                    placeholder="0.00"
                    className="h-10 text-right"
                  />
                </div>
                <div className="w-24 space-y-1">
                  <span className="text-[10px] text-muted-foreground">{t('journal.credit')}</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={l.credit}
                    onChange={e => setLine(i, { credit: e.target.value, debit: e.target.value ? '' : l.debit })}
                    placeholder="0.00"
                    className="h-10 text-right"
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-10 w-9 shrink-0 cursor-pointer"
                  onClick={() => removeLine(i)}
                  disabled={lines.length <= 2}
                  aria-label={t('journal.modal.removeLine')}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Live balance indicator */}
        <div
          className={cn(
            'flex items-center justify-between rounded-lg border p-3 text-sm',
            balanced ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-input bg-muted/40',
          )}
        >
          <div className="flex items-center gap-2">
            <Scale className={cn('h-4 w-4', balanced ? 'text-emerald-500' : 'text-muted-foreground')} />
            <span className={cn('font-medium', balanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
              {balanced ? t('journal.modal.balanced') : t('journal.modal.unbalanced', { diff: Currency(Math.abs(diff), true) })}
            </span>
          </div>
          <div className="flex gap-4 tabular-nums">
            <span>
              {t('journal.debit')}: <strong className="text-foreground">{Currency(totalDebit, true)}</strong>
            </span>
            <span>
              {t('journal.credit')}: <strong className="text-foreground">{Currency(totalCredit, true)}</strong>
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t('journal.modal.hint')}</p>
      </div>
    </FullScreenModal>
  )
}

/**
 * Libro diario · Pólizas — motor de doble partida (Capa B). Gated PREMIUM (FeatureGate CFDI).
 * Slice 1: ver el diario + crear pólizas manuales balanceadas (Σcargo = Σabono).
 */
export default function Journal() {
  return (
    <FeatureGate feature="CFDI">
      <JournalInner />
    </FeatureGate>
  )
}
