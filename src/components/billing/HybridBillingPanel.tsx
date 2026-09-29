import { lazy, Suspense, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { CancelPlanDialog } from './CancelPlanDialog'
import { FeatureCatalogBrowser } from './FeatureCatalogBrowser'
import { HybridTermsSummary } from './HybridCheckout'
import { hybridBilling, type HybridContract } from '@/services/hybridBilling.service'
import { getIntlLocale } from '@/utils/i18n-locale'
const Checkout = lazy(() => import('./HybridCheckout').then(module => ({ default: module.HybridCheckout })))
export function HybridBillingPanel({
  venueId,
  canRead,
  canManage,
  timezone,
  checkoutOpen,
  onCheckoutOpenChange,
}: {
  venueId: string
  canRead: boolean
  canManage: boolean
  timezone: string
  checkoutOpen?: boolean
  onCheckoutOpenChange?: (open: boolean) => void
}) {
  const { t, i18n } = useTranslation('billing')
  const client = useQueryClient()
  const [internalOpen, setInternalOpen] = useState(false)
  const open = checkoutOpen ?? internalOpen
  const setOpen = onCheckoutOpenChange ?? setInternalOpen
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<HybridContract | null>(null)
  const [codes, setCodes] = useState<string[]>([])
  const [cancelling, setCancelling] = useState<HybridContract | null>(null)
  const [error, setError] = useState<string | null>(null)
  const contracts = useQuery({
    queryKey: ['hybrid-contracts', venueId, page],
    queryFn: () => hybridBilling.contracts(venueId, page),
    enabled: canRead,
    staleTime: 30000,
    retry: false,
  })
  const invalidate = async () => {
    await Promise.all(
      ['hybrid-contracts', 'venuePlan', 'venueFeatures', 'seatStatus', 'user-access', 'featureGrid', 'hybrid-replacements'].map(key =>
        client.invalidateQueries({ queryKey: [key, venueId] }),
      ),
    )
  }
  const update = useMutation({
    mutationFn: async (work: () => Promise<unknown>) => {
      setError(null)
      await work()
    },
    onSuccess: async () => {
      setEditing(null)
      setCancelling(null)
      await invalidate()
    },
    onError: (value: unknown) =>
      setError((value as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('hybrid.error')),
  })
  const date = (value: string) =>
    new Intl.DateTimeFormat(getIntlLocale(i18n.language), { dateStyle: 'medium', timeZone: timezone }).format(new Date(value))
  const names = (values: string[]) => values.map(code => t(`hybrid.featureNames.${code}`, { defaultValue: code })).join(' · ')
  return (
    <section
      id="hybrid-contracts"
      tabIndex={-1}
      className="space-y-5 rounded-2xl border border-input p-5 sm:p-6"
      data-tour="billing-hybrid"
    >
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{t('hybrid.title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('hybrid.intro')}</p>
        </div>
        <Button disabled={!canManage} onClick={() => setOpen(true)} data-tour="billing-hybrid-buy">
          {t('hybrid.open')}
        </Button>
      </header>
      {!canManage && <p className="text-sm text-muted-foreground">{t('hybrid.permission')}</p>}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {canRead && (
        <>
          <h3 className="font-medium">{t('hybrid.contracts')}</h3>
          {contracts.isPending ? (
            <p>{t('catalog.loading')}</p>
          ) : contracts.isError ? (
            <div role="alert">
              <p>{t('hybrid.error')}</p>
              <Button variant="outline" onClick={() => void contracts.refetch()}>
                {t('catalog.retry')}
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t('hybrid.contractsCount', { count: contracts.data.total })}</p>
              {contracts.data.total === 0 && <p className="text-sm text-muted-foreground">{t('hybrid.noContracts')}</p>}
              {contracts.data.items.map(contract => (
                <article key={contract.id} className="space-y-3 border-t border-input py-5">
                  <h4 className="font-semibold">{contract.name}</h4>
                  <HybridTermsSummary terms={contract.definition.terms} showRenewal={!contract.cancelAt && !contract.endedAt} />
                  {contract.paymentIssue && (
                    <p role="alert" className="text-sm text-destructive">
                      {t('hybrid.fundingIssue')}
                    </p>
                  )}
                  <p className="text-sm">{names(contract.featureCodes)}</p>
                  <p className="text-sm text-muted-foreground">
                    {contract.endedAt
                      ? t('hybrid.ended')
                      : contract.cancelAt
                        ? t('hybrid.cancelled', { date: date(contract.cancelAt) })
                        : contract.paidThrough
                          ? t('hybrid.ends', { date: date(contract.paidThrough) })
                          : t('hybrid.pending')}
                  </p>
                  {contract.pendingEffectiveAt && (
                    <div className="space-y-2 rounded-xl bg-muted p-3">
                      <p>{t('hybrid.scheduled', { date: date(contract.pendingEffectiveAt) })}</p>
                      <p className="text-sm">{names(contract.pendingFeatureCodes)}</p>
                      <Button
                        variant="outline"
                        disabled={!canManage || update.isPending}
                        onClick={() => update.mutate(() => hybridBilling.selection(venueId, contract.id, contract.revision, null))}
                      >
                        {t('hybrid.withdraw')}
                      </Button>
                    </div>
                  )}
                  {!contract.endedAt && !contract.cancelAt && contract.paidThrough && (
                    <div className="flex flex-wrap gap-3">
                      {contract.kind === 'CHOICE_BUNDLE' && (
                        <Button
                          variant="outline"
                          disabled={!canManage || update.isPending}
                          onClick={() => {
                            setCodes(contract.pendingEffectiveAt ? contract.pendingFeatureCodes : contract.featureCodes)
                            setEditing(contract)
                          }}
                          data-tour="billing-hybrid-selection"
                        >
                          {t('hybrid.changeSelection')}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        disabled={!canManage || update.isPending}
                        onClick={() => setCancelling(contract)}
                        data-tour="billing-hybrid-cancel"
                      >
                        {t('hybrid.cancelContract')}
                      </Button>
                    </div>
                  )}
                </article>
              ))}
              {contracts.data.total > contracts.data.pageSize && (
                <nav className="flex items-center justify-between">
                  <Button variant="outline" disabled={page <= 1 || contracts.isFetching} onClick={() => setPage(n => n - 1)}>
                    {t('catalog.previous')}
                  </Button>
                  <span>{t('catalog.page', { page, pages: Math.ceil(contracts.data.total / contracts.data.pageSize) })}</span>
                  <Button
                    variant="outline"
                    disabled={page * contracts.data.pageSize >= contracts.data.total || contracts.isFetching}
                    onClick={() => setPage(n => n + 1)}
                  >
                    {t('catalog.next')}
                  </Button>
                </nav>
              )}
            </>
          )}
        </>
      )}
      <FullScreenModal open={open} onClose={() => setOpen(false)} title={t('hybrid.title')} contentClassName="bg-muted/30">
        <div className="p-4 sm:p-8">
          <Suspense fallback={<p>{t('catalog.loading')}</p>}>
            <Checkout
              key={venueId}
              venueId={venueId}
              timezone={timezone}
              onCompleted={async () => {
                await invalidate()
                setOpen(false)
              }}
            />
          </Suspense>
        </div>
      </FullScreenModal>
      <FullScreenModal
        open={!!editing}
        onClose={() => {
          if (!update.isPending) setEditing(null)
        }}
        title={t('hybrid.changeSelection')}
        actions={
          <Button
            disabled={update.isPending || editing?.definition.kind !== 'CHOICE_BUNDLE' || codes.length !== editing.definition.choiceCount}
            onClick={() => {
              if (editing) update.mutate(() => hybridBilling.selection(venueId, editing.id, editing.revision, codes))
            }}
            data-tour="billing-hybrid-save-selection"
          >
            {t('hybrid.saveSelection')}
          </Button>
        }
      >
        {editing?.definition.kind === 'CHOICE_BUNDLE' && (
          <div className="mx-auto w-full max-w-5xl space-y-4 p-5">
            <h3 className="text-xl font-semibold">{editing.name}</h3>
            <p>{t('hybrid.nextCycle', { date: editing.paidThrough ? date(editing.paidThrough) : '—' })}</p>
            <HybridTermsSummary terms={editing.definition.terms} />
            <p aria-live="polite">{t('hybrid.selected', { selected: codes.length, count: editing.definition.choiceCount })}</p>
            <p>{names(codes)}</p>
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <FeatureCatalogBrowser
              key={editing.id}
              selection={{
                eligibleCodes: editing.definition.eligibleFeatureCodes,
                selectedCodes: codes,
                includedCodes: ['CHATBOT'],
                choiceCount: editing.definition.choiceCount,
                onChange: setCodes,
              }}
            />
          </div>
        )}
      </FullScreenModal>
      {cancelling && (
        <CancelPlanDialog
          open
          onOpenChange={value => {
            if (!value && !update.isPending) setCancelling(null)
          }}
          target={{ kind: 'CONTRACT', name: cancelling.name, until: cancelling.paidThrough ? date(cancelling.paidThrough) : null }}
          note={
            cancelling.paymentIssue
              ? t('hybrid.cancelWithFundingIssue', {
                  name: cancelling.name,
                  date: cancelling.paidThrough ? date(cancelling.paidThrough) : '—',
                })
              : null
          }
          pending={update.isPending}
          error={error}
          onConfirm={input => update.mutate(() => hybridBilling.cancelContract(venueId, cancelling.id, cancelling.revision, input))}
        />
      )}
    </section>
  )
}
