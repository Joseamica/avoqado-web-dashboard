import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, FileText, Loader2, Upload } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Currency } from '@/utils/currency'
import { cn } from '@/lib/utils'
import {
  bankReconKeys,
  confirmBankMatches,
  getBankStatement,
  listBankStatements,
  uploadBankStatement,
  type BankStatementLine,
  type ReconMatchStatus,
} from '@/services/bankReconciliation.service'

const STATUS_STYLE: Record<ReconMatchStatus, string> = {
  MATCHED: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  CONFIRMED: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  DUPLICATE: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  UNMATCHED: 'bg-muted text-muted-foreground',
}

function BankReconciliationInner() {
  const { t } = useTranslation('reports')
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [dragOver, setDragOver] = useState(false)

  const statementsQuery = useQuery({
    queryKey: bankReconKeys.list(venueId),
    queryFn: () => listBankStatements(venueId!),
    enabled: !!venueId,
  })

  const detailQuery = useQuery({
    queryKey: bankReconKeys.detail(venueId, selectedId ?? ''),
    queryFn: () => getBankStatement(venueId!, selectedId!),
    enabled: !!venueId && !!selectedId,
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadBankStatement(venueId!, file),
    onSuccess: result => {
      queryClient.invalidateQueries({ queryKey: bankReconKeys.list(venueId) })
      setSelectedId(result.statementId)
      setChecked(new Set())
    },
  })

  const confirmMutation = useMutation({
    mutationFn: (lineIds: string[]) => confirmBankMatches(venueId!, selectedId!, lineIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankReconKeys.detail(venueId, selectedId ?? '') })
      queryClient.invalidateQueries({ queryKey: bankReconKeys.list(venueId) })
      setChecked(new Set())
    },
  })

  const onPickFile = (file?: File | null) => {
    if (file) uploadMutation.mutate(file)
  }

  const toggle = (id: string) =>
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const lines = useMemo(() => detailQuery.data?.lines ?? [], [detailQuery.data])
  const confirmable = useMemo(() => lines.filter(l => l.matchStatus === 'MATCHED'), [lines])

  return (
    <div className="p-4 space-y-5 bg-background">
      <header>
        <h1 className="text-xl font-semibold text-foreground">{t('bankReconciliation.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('bankReconciliation.subtitle')}</p>
      </header>

      {/* Upload dropzone */}
      <div
        onDragOver={e => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault()
          setDragOver(false)
          onPickFile(e.dataTransfer.files?.[0])
        }}
        onClick={() => fileRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-input p-8 text-center cursor-pointer transition-colors',
          dragOver && 'border-emerald-500 bg-emerald-500/5',
        )}
        data-tour="bank-recon-upload"
      >
        {uploadMutation.isPending ? (
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="w-6 h-6 text-muted-foreground" />
        )}
        <p className="text-sm font-medium">{t('bankReconciliation.dropTitle')}</p>
        <p className="text-xs text-muted-foreground">{t('bankReconciliation.dropHint')}</p>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => onPickFile(e.target.files?.[0])} />
      </div>

      {uploadMutation.isError && <p className="text-sm text-destructive">{t('bankReconciliation.uploadError')}</p>}
      {uploadMutation.isSuccess && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          {t('bankReconciliation.uploadOk', { matched: uploadMutation.data.matchedCount, total: uploadMutation.data.lineCount })}
        </p>
      )}

      {/* Statements list */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">{t('bankReconciliation.statements')}</h2>
        {statementsQuery.isLoading ? (
          <Skeleton className="h-16 rounded-lg" />
        ) : (statementsQuery.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">{t('bankReconciliation.empty')}</p>
        ) : (
          <div className="space-y-2">
            {statementsQuery.data!.map(s => (
              <Card
                key={s.id}
                className={cn('border-input cursor-pointer', selectedId === s.id && 'ring-1 ring-emerald-500')}
                onClick={() => {
                  setSelectedId(s.id)
                  setChecked(new Set())
                }}
              >
                <CardContent className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm truncate">{s.fileName}</span>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {t('bankReconciliation.matchedOf', { matched: s.matchedCount, total: s.lineCount })}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Detail: lines table */}
      {selectedId && (
        <Card className="border-input">
          <CardContent className="py-3">
            {detailQuery.isLoading ? (
              <Skeleton className="h-40" />
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium">{t('bankReconciliation.movements')}</h2>
                  <Button
                    size="sm"
                    disabled={checked.size === 0 || confirmMutation.isPending}
                    onClick={() => confirmMutation.mutate([...checked])}
                  >
                    {confirmMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    {t('bankReconciliation.confirm', { count: checked.size })}
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground text-left border-b border-input">
                        <th className="py-2 pr-2 w-8" />
                        <th className="py-2 pr-2">{t('bankReconciliation.date')}</th>
                        <th className="py-2 pr-2">{t('bankReconciliation.description')}</th>
                        <th className="py-2 pr-2 text-right">{t('bankReconciliation.amount')}</th>
                        <th className="py-2 pl-2">{t('bankReconciliation.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l: BankStatementLine) => {
                        const selectable = l.matchStatus === 'MATCHED'
                        return (
                          <tr key={l.id} className="border-b border-input/50">
                            <td className="py-2 pr-2">
                              {selectable && (
                                <input
                                  type="checkbox"
                                  checked={checked.has(l.id)}
                                  onChange={() => toggle(l.id)}
                                  aria-label={t('bankReconciliation.confirmLine')}
                                />
                              )}
                            </td>
                            <td className="py-2 pr-2 whitespace-nowrap text-muted-foreground">{l.postedDate.slice(0, 10)}</td>
                            <td className="py-2 pr-2 max-w-[220px] truncate">{l.description}</td>
                            <td className={cn('py-2 pr-2 text-right tabular-nums', l.direction === 'DEBIT' && 'text-muted-foreground')}>
                              {Currency(l.amountCents, true)}
                            </td>
                            <td className="py-2 pl-2">
                              <span className={cn('text-xs px-2 py-0.5 rounded-full whitespace-nowrap', STATUS_STYLE[l.matchStatus])}>
                                {t(`bankReconciliation.statuses.${l.matchStatus}`)}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {confirmable.length === 0 && lines.length > 0 && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {t('bankReconciliation.nothingToConfirm')}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-input">
        <CardContent className="py-3 text-xs text-muted-foreground space-y-1">
          <p>{t('bankReconciliation.disclosureMatch')}</p>
          <p>{t('bankReconciliation.disclosureAi')}</p>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Conciliación bancaria con IA — Capa "Bancos". Gated PRO (FeatureGate BANK_RECONCILIATION).
 * Sube tu estado de cuenta (CSV) → concilia contra lo que Avoqado depositó.
 */
export default function BankReconciliation() {
  return (
    <FeatureGate feature="BANK_RECONCILIATION">
      <BankReconciliationInner />
    </FeatureGate>
  )
}
