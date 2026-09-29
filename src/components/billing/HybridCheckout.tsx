import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FeatureCatalogBrowser } from './FeatureCatalogBrowser'
import { HybridCartBar } from './HybridCartBar'
import {
  hybridBilling,
  type HybridOffer,
  type HybridPurchase,
  type HybridTerms,
  type HybridPayment,
} from '@/services/hybridBilling.service'
import {
  captureHybridOffer,
  readHybridOffer,
  saveHybridAttempt,
  readHybridAttempt,
  clearHybridAttempt,
  readHybridDraft,
  saveHybridDraft,
  clearHybridDraft,
} from '@/lib/hybridIntent'
import { getConnectionStatus, subscribeToConnection } from '@/api'
import { useDebounce } from '@/hooks/useDebounce'
import { getIntlLocale } from '@/utils/i18n-locale'

export function HybridTermsSummary({ terms, showRenewal = true }: { terms: HybridTerms; showRenewal?: boolean }) {
  const { t, i18n } = useTranslation('billing')
  const price = (value: number) => new Intl.NumberFormat(getIntlLocale(i18n.language), { style: 'currency', currency: 'MXN' }).format(value)
  return (
    <div className="space-y-1">
      <p className="font-semibold tabular-nums">{t('hybrid.monthly', { price: price(terms.price) })}</p>
      {showRenewal && (
        <p className="text-sm text-muted-foreground">
          {terms.renewal.kind === 'REPRICE'
            ? t('hybrid.reprice', { count: terms.promotionCycles, price: price(terms.renewal.price) })
            : terms.renewal.kind === 'END'
              ? t('hybrid.end', { count: terms.promotionCycles })
              : t('hybrid.same')}
        </p>
      )}
    </div>
  )
}
const finished = (status: string) => ['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(status)
const onlineSnapshot = () => getConnectionStatus().isOnline
const safePaymentUrl = (value?: string | null) => {
  try {
    const url = new URL(value ?? '')
    return url.protocol === 'https:' && ['invoice.stripe.com', 'pay.stripe.com'].includes(url.hostname) ? url.href : null
  } catch {
    return null
  }
}

/** The same published-offer checkout serves onboarding and existing venues. All charges come from the saved server quote. */
export function HybridCheckout({
  venueId,
  onCompleted,
  initialSlug,
  timezone = 'America/Mexico_City',
}: {
  venueId: string
  onCompleted?: (purchaseId: string) => void | Promise<void>
  initialSlug?: string
  timezone?: string
}) {
  const { t, i18n } = useTranslation('billing')
  const client = useQueryClient()
  const online = useSyncExternalStore(subscribeToConnection, onlineSnapshot, () => true)
  const [slug] = useState(() => {
    captureHybridOffer()
    return initialSlug ?? readHybridOffer()
  })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebounce(search, 300)
  const [draft] = useState(() => readHybridDraft(venueId))
  const [restored, setRestored] = useState(!draft?.lines.length)
  const [draftSaveFailed, setDraftSaveFailed] = useState(false)
  const [cart, setCart] = useState<{ offer: HybridOffer; codes: string[] }[]>([])
  const [replace, setReplace] = useState<string[]>([])
  const [drop, setDrop] = useState<string[]>([])
  const [purchase, setPurchase] = useState<HybridPurchase | null>(null)
  const [attemptId, setAttemptId] = useState(() => readHybridAttempt(venueId)?.id ?? null)
  const [payment, setPayment] = useState<HybridPayment | null>(null)
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const alertRef = useRef<HTMLDivElement>(null)
  // The alert sits above the offer list; the review button is far below it, so bring the reason into view.
  useEffect(() => {
    if (error) alertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [error])
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])
  const restore = useQuery({
    queryKey: ['hybrid-draft', venueId, draft],
    queryFn: ({ signal }) =>
      Promise.all(
        draft!.lines.map(async line => {
          const offer = await hybridBilling.offer(line.slug, signal)
          if (offer.id !== line.id || !offer.purchaseAvailable) throw new Error('Publication changed')
          return { offer, codes: line.codes }
        }),
      ),
    enabled: !restored,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
  useEffect(() => {
    if (!restored && restore.data) {
      setCart(restore.data)
      setReplace(draft?.replace ?? [])
      setDrop(draft?.drop ?? [])
      setRestored(true)
    }
  }, [restore.data, restored, draft])
  useEffect(() => {
    if (!restored || purchase) return
    try {
      saveHybridDraft(venueId, { lines: cart.map(row => ({ id: row.offer.id, slug: row.offer.slug, codes: row.codes })), replace, drop })
      setDraftSaveFailed(false)
    } catch {
      setDraftSaveFailed(true)
    }
  }, [venueId, cart, replace, drop, restored, purchase])
  const current = useQuery({ queryKey: ['hybrid-current', venueId], queryFn: () => hybridBilling.current(venueId), retry: false })
  const status = useQuery({
    queryKey: ['hybrid-purchase', venueId, attemptId],
    queryFn: () => hybridBilling.purchase(venueId, attemptId!),
    enabled: !!attemptId,
    retry: false,
    refetchInterval: query =>
      query.state.data && !finished(query.state.data.status) && query.state.data.status !== 'QUOTED' ? 10000 : false,
    refetchIntervalInBackground: false,
  })
  useEffect(() => {
    if (current.data) {
      setPurchase(current.data)
      setAttemptId(current.data.id)
    }
  }, [current.data])
  useEffect(() => {
    if (status.data?.id === attemptId && (!current.data || (current.data.id === attemptId && status.data.status !== 'QUOTED')))
      setPurchase(status.data)
  }, [status.data, attemptId, current.data])
  const refreshCurrent = current.refetch,
    refreshStatus = status.refetch
  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key !== `avq_hybrid_attempt_v1:${venueId}`) return
      void refreshCurrent()
      if (attemptId) void refreshStatus()
    }
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [venueId, attemptId, refreshCurrent, refreshStatus])
  const offers = useQuery({
    queryKey: ['hybrid-offers', q, page],
    queryFn: ({ signal }) => hybridBilling.offers({ page, pageSize: 6, q: q || undefined }, signal),
    enabled: !purchase,
    staleTime: 60000,
    placeholderData: keepPreviousData,
    retry: false,
  })
  const linked = useQuery({
    queryKey: ['hybrid-offer', slug],
    queryFn: ({ signal }) => hybridBilling.offer(slug!, signal),
    enabled: !!slug && !purchase,
    retry: false,
    staleTime: 60000,
  })
  const replacements = useQuery({
    queryKey: ['hybrid-replacements', venueId],
    queryFn: () => hybridBilling.replacements(venueId),
    enabled: !purchase,
    staleTime: 60000,
    retry: false,
  })
  const visible = useMemo(
    () => [...(linked.data ? [linked.data] : []), ...(offers.data?.items.filter(offer => offer.id !== linked.data?.id) ?? [])],
    [linked.data, offers.data],
  )
  const included = [
    ...new Set([
      ...(replacements.data?.standaloneFeatureCodes ?? ['CHATBOT']),
      ...(replacements.data?.items.filter(item => !replace.includes(item.subscriptionId)).flatMap(item => item.featureCodes) ?? []),
      // A plan or a single-feature offer in the cart already brings its features: a bundle never charges them again.
      ...cart.filter(row => row.offer.definition.kind !== 'CHOICE_BUNDLE').flatMap(row => row.offer.includedFeatureCodes),
    ]),
  ]
  const effectiveCart = cart.map(row => ({ ...row, codes: row.codes.filter(code => !included.includes(code)) }))
  const purchasedCodes = [
    ...new Set(effectiveCart.flatMap(row => (row.offer.definition.kind === 'CHOICE_BUNDLE' ? row.codes : row.offer.includedFeatureCodes))),
  ]
  const leaving = [
    ...new Set(replacements.data?.items.filter(item => replace.includes(item.subscriptionId)).flatMap(item => item.featureCodes) ?? []),
  ].filter(code => !included.includes(code) && !purchasedCodes.includes(code))
  const feature = (code: string) => t(`hybrid.featureNames.${code}`, { defaultValue: code })
  const rowCodes = (row: { offer: HybridOffer; codes: string[] }) =>
    row.offer.definition.kind === 'CHOICE_BUNDLE' ? row.codes : row.offer.includedFeatureCodes
  // The server refuses to charge a feature twice; say it on the card, before «Revisar cotización».
  const conflict = (offer: HybridOffer) => {
    if (offer.definition.kind === 'CHOICE_BUNDLE' || cart.some(row => row.offer.id === offer.id)) return null
    const clash = cart.find(row => rowCodes(row).some(code => offer.includedFeatureCodes.includes(code)))
    if (clash) return t('hybrid.inCart', { offer: clash.offer.name })
    const owned = offer.definition.kind === 'FEATURES' ? offer.includedFeatureCodes.filter(code => included.includes(code)) : []
    return owned.length ? t('hybrid.owned', { features: owned.map(feature).join(' · ') }) : null
  }
  const incomplete = effectiveCart.find(
    row => row.offer.definition.kind === 'CHOICE_BUNDLE' && row.codes.length !== row.offer.definition.choiceCount,
  )
  const valid =
    cart.length > 0 &&
    effectiveCart.every(row => row.offer.definition.kind !== 'CHOICE_BUNDLE' || row.codes.length === row.offer.definition.choiceCount) &&
    leaving.every(code => drop.includes(code))
  const fail = (value: unknown) =>
    setError((value as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('hybrid.error'))
  const action = useMutation({
    mutationFn: async (work: () => Promise<void>) => {
      setError(null)
      await work()
    },
    onError: fail,
  })
  const busy = action.isPending || !online || (!restored && !purchase)
  const review = () =>
    action.mutate(async () => {
      const result = await hybridBilling.quote(venueId, {
        lines: effectiveCart.map(row => ({ publicationId: row.offer.id, selectedFeatureCodes: row.codes })),
        replaceSubscriptionIds: replace,
        dropFeatureCodes: leaving.filter(code => drop.includes(code)),
      })
      saveHybridAttempt(venueId, { id: result.id, clientKey: crypto.randomUUID() })
      setAttemptId(result.id)
      setPurchase(result)
      setConsent(false)
      setPayment(null)
    })
  const accept = () =>
    action.mutate(async () => {
      if (!purchase || !consent || new Date(purchase.quoteExpiresAt).getTime() <= Date.now()) return
      const old = readHybridAttempt(venueId)
      const attempt = old?.id === purchase.id ? old : { id: purchase.id, clientKey: crypto.randomUUID() }
      saveHybridAttempt(venueId, attempt) // durable BEFORE the first potentially billable request
      try {
        const result = await hybridBilling.accept(venueId, purchase.id, { quoteHash: purchase.quoteHash, clientKey: attempt.clientKey })
        setPayment(result)
      } finally {
        setAttemptId(purchase.id)
        void client.invalidateQueries({ queryKey: ['hybrid-current', venueId] })
        void client.invalidateQueries({ queryKey: ['hybrid-purchase', venueId, purchase.id] })
      }
    })
  const resume = () =>
    action.mutate(async () => {
      if (!purchase) return
      setPayment(await hybridBilling.resume(venueId, purchase.id))
      await status.refetch()
      await current.refetch()
    })
  const clear = () => {
    if (purchase) clearHybridAttempt(venueId, purchase.id)
    setPurchase(null)
    setAttemptId(null)
    setPayment(null)
    setConsent(false)
    void current.refetch()
    void replacements.refetch()
  }
  const money = (value: string) =>
    new Intl.NumberFormat(getIntlLocale(i18n.language), { style: 'currency', currency: 'MXN' }).format(Number(value))
  const date = (value: string) =>
    new Intl.DateTimeFormat(getIntlLocale(i18n.language), {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(new Date(value))
  const recoveryError = current.isError || (attemptId && status.isError)
  const paymentUrl = safePaymentUrl(payment?.paymentUrl)
  const reviewExpired = purchase && new Date(purchase.quoteExpiresAt).getTime() <= now
  return (
    <section className="mx-auto max-w-5xl space-y-6 pb-6" data-tour="hybrid-checkout">
      {!restored &&
        (restore.isError ? (
          <div role="alert" className="space-y-3">
            <p>{t('hybrid.restoreChanged')}</p>
            <Button onClick={() => void restore.refetch()}>{t('catalog.retry')}</Button>
            <Button
              variant="outline"
              onClick={() => {
                clearHybridDraft(venueId)
                setRestored(true)
              }}
            >
              {t('hybrid.back')}
            </Button>
          </div>
        ) : (
          <p role="status">{t('catalog.loading')}</p>
        ))}
      {draftSaveFailed && <p role="alert">{t('hybrid.draftSaveFailed')}</p>}
      {!online && (
        <p role="status" className="rounded-xl bg-muted p-4">
          {t('hybrid.offline')}
        </p>
      )}
      {(error || recoveryError) && (
        <div ref={alertRef} role="alert" className="space-y-2 rounded-xl border border-destructive p-4">
          <p>{error ?? t('hybrid.error')}</p>
          {recoveryError && (
            <Button
              variant="outline"
              onClick={() => {
                void current.refetch()
                if (attemptId) void status.refetch()
              }}
            >
              {t('catalog.retry')}
            </Button>
          )}
        </div>
      )}
      {purchase ? (
        <>
          {purchase.status === 'COMPLETED' ? (
            <div className="space-y-4 rounded-2xl border border-input p-6">
              <h2 className="text-2xl font-semibold">{t('hybrid.completed')}</h2>
              <p>{t('hybrid.activation')}</p>
              <Button
                disabled={busy}
                data-tour="hybrid-completed-continue"
                onClick={() =>
                  onCompleted
                    ? action.mutate(async () => {
                        await onCompleted(purchase.id)
                        clearHybridAttempt(venueId, purchase.id)
                        clearHybridDraft(venueId)
                      })
                    : clear()
                }
              >
                {t('hybrid.continue')}
              </Button>
            </div>
          ) : finished(purchase.status) ? (
            <div className="space-y-4">
              <p>{t('hybrid.closed')}</p>
              <Button onClick={clear}>{t('hybrid.back')}</Button>
            </div>
          ) : purchase.status !== 'QUOTED' ? (
            <div className="space-y-4 rounded-2xl border border-input p-6">
              <h2 className="text-2xl font-semibold">{t('hybrid.pending')}</h2>
              <p className="text-muted-foreground">{t('hybrid.pendingHint')}</p>
              {paymentUrl && (
                <Button asChild>
                  <a href={paymentUrl} target="_blank" rel="noopener noreferrer" data-tour="hybrid-pay">
                    {t('hybrid.pay')}
                  </a>
                </Button>
              )}
              <div className="flex flex-wrap gap-3">
                <Button disabled={busy} onClick={resume} data-tour="hybrid-resume">
                  {t('hybrid.resume')}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    action.mutate(async () => {
                      setPayment(await hybridBilling.cancel(venueId, purchase.id))
                      await status.refetch()
                      await current.refetch()
                    })
                  }
                >
                  {t('hybrid.cancelAttempt')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5 rounded-2xl border border-input p-6" data-tour="hybrid-quote">
              <h2 className="text-2xl font-semibold">{t('hybrid.quoteTitle')}</h2>
              {purchase.quote.lines.map(line => (
                <article key={line.publicationId} className="space-y-2 border-b border-input pb-4">
                  <h3 className="font-semibold">{line.name}</h3>
                  <HybridTermsSummary terms={line.terms} />
                  <p className="text-sm text-muted-foreground">{line.featureCodes.map(feature).join(' · ')}</p>
                </article>
              ))}
              <dl className="space-y-2">
                {(
                  [
                    ['total', 'total'],
                    ['credit', 'credit'],
                    ['balance', 'existingBalance'],
                    ['due', 'dueNow'],
                    ['creditAfter', 'creditBalanceAfter'],
                  ] as const
                ).map(([label, key]) => (
                  <div key={key} className={`flex justify-between gap-4 ${key === 'dueNow' ? 'text-xl font-semibold' : 'text-sm'}`}>
                    <dt>{t(`hybrid.${label}`)}</dt>
                    <dd className="tabular-nums">{money(purchase.quote[key])}</dd>
                  </div>
                ))}
              </dl>
              {purchase.quote.droppedFeatureCodes.length > 0 && (
                <p>
                  {t('hybrid.dropped')}: {purchase.quote.droppedFeatureCodes.map(feature).join(' · ')}
                </p>
              )}
              <p className="text-sm text-muted-foreground">{t('hybrid.expiry', { date: date(purchase.quoteExpiresAt) })}</p>
              {reviewExpired && <p role="alert">{t('hybrid.expired')}</p>}
              <label className="flex cursor-pointer gap-3">
                <input
                  type="checkbox"
                  checked={consent}
                  disabled={busy}
                  onChange={event => setConsent(event.target.checked)}
                  data-tour="hybrid-consent"
                />
                {t('hybrid.consent')}
              </label>
              <div className="flex flex-wrap gap-3">
                <Button disabled={busy || !consent || !!reviewExpired || !!recoveryError} onClick={accept} data-tour="hybrid-accept">
                  {t('hybrid.accept')}
                </Button>
                <Button variant="outline" disabled={busy} onClick={clear}>
                  {t('hybrid.back')}
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-muted-foreground">{t('hybrid.intro')}</p>
          {linked.isError && <p role="status">{t('hybrid.unavailable')}</p>}
          <Input
            aria-label={t('hybrid.search')}
            placeholder={t('hybrid.search')}
            value={search}
            maxLength={120}
            data-tour="hybrid-offers-search"
            onChange={event => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
          {offers.isPending ? (
            <p role="status">{t('catalog.loading')}</p>
          ) : offers.isError ? (
            <div role="alert">
              <p>{t('hybrid.error')}</p>
              <Button variant="outline" onClick={() => void offers.refetch()}>
                {t('catalog.retry')}
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t('hybrid.offersCount', { count: offers.data.total })}</p>
              {!visible.length && <p>{t('hybrid.empty')}</p>}
              <div className="grid gap-4 md:grid-cols-2">
                {visible.map(offer => {
                  const selected = cart.some(row => row.offer.id === offer.id)
                  const fromLink = offer.id === linked.data?.id
                  const blocked = conflict(offer)
                  return (
                    <article
                      key={offer.id}
                      className={`flex flex-col gap-4 rounded-2xl border p-5 ${fromLink ? 'border-primary' : 'border-input'}`}
                    >
                      {fromLink && (
                        <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          {t('hybrid.fromLink')}
                        </span>
                      )}
                      <h3 className="text-lg font-semibold">{offer.name}</h3>
                      <HybridTermsSummary terms={offer.definition.terms} />
                      <p className="text-sm">
                        {offer.definition.kind === 'CHOICE_BUNDLE'
                          ? t('hybrid.choice', { count: offer.definition.choiceCount })
                          : offer.includedFeatureCodes.map(feature).join(' · ')}
                      </p>
                      {blocked && (
                        <p role="note" className="text-sm text-muted-foreground">
                          {blocked}
                        </p>
                      )}
                      <Button
                        variant={selected ? 'outline' : 'default'}
                        className="mt-auto"
                        disabled={busy || !offer.purchaseAvailable || !!blocked || (!selected && cart.length >= 8)}
                        data-tour="hybrid-offer-select"
                        onClick={() =>
                          setCart(rows => (selected ? rows.filter(row => row.offer.id !== offer.id) : [...rows, { offer, codes: [] }]))
                        }
                      >
                        {t(selected ? 'hybrid.remove' : 'hybrid.select')}
                      </Button>
                    </article>
                  )
                })}
              </div>
              {offers.data.total > offers.data.pageSize && (
                <nav className="flex items-center justify-between">
                  <Button variant="outline" disabled={page <= 1 || offers.isFetching} onClick={() => setPage(n => n - 1)}>
                    {t('catalog.previous')}
                  </Button>
                  <span>{t('catalog.page', { page, pages: Math.ceil(offers.data.total / offers.data.pageSize) })}</span>
                  <Button
                    variant="outline"
                    disabled={page * offers.data.pageSize >= offers.data.total || offers.isFetching}
                    onClick={() => setPage(n => n + 1)}
                  >
                    {t('catalog.next')}
                  </Button>
                </nav>
              )}
            </>
          )}
          {replacements.isError && (
            <div role="alert">
              <p>{t('hybrid.error')}</p>
              <Button variant="outline" onClick={() => void replacements.refetch()}>
                {t('catalog.retry')}
              </Button>
            </div>
          )}
          {!!replacements.data?.total && (
            <details className="rounded-xl border border-input p-4">
              <summary className="cursor-pointer font-medium">{t('hybrid.replacements')}</summary>
              <p className="my-3 text-sm text-muted-foreground">{t('hybrid.replaceHint')}</p>
              {replacements.data.items.map(item => (
                <label key={item.subscriptionId} className="my-3 flex cursor-pointer gap-3">
                  <input
                    type="checkbox"
                    disabled={!item.replaceable || busy}
                    checked={replace.includes(item.subscriptionId)}
                    onChange={event => {
                      setReplace(ids =>
                        event.target.checked ? [...ids, item.subscriptionId] : ids.filter(id => id !== item.subscriptionId),
                      )
                      setDrop([])
                    }}
                  />
                  {item.featureCodes.map(feature).join(' · ') || item.subscriptionId}
                </label>
              ))}
            </details>
          )}
          {cart.length > 0 && (
            <div className="space-y-5 rounded-2xl bg-muted/30 p-5">
              <h3 className="text-xl font-semibold">{t('hybrid.cart')}</h3>
              {effectiveCart.map(row => (
                <article key={row.offer.id} id={`hybrid-row-${row.offer.id}`} className="scroll-mt-4 space-y-3">
                  <h4 className="font-semibold">{row.offer.name}</h4>
                  {row.offer.definition.kind === 'CHOICE_BUNDLE' && (
                    <>
                      <p aria-live="polite">
                        {t('hybrid.selected', { selected: row.codes.length, count: row.offer.definition.choiceCount })}
                      </p>
                      <p className="text-sm">{row.codes.map(feature).join(' · ')}</p>
                      <FeatureCatalogBrowser
                        selection={{
                          eligibleCodes: row.offer.definition.eligibleFeatureCodes,
                          selectedCodes: row.codes,
                          includedCodes: included,
                          choiceCount: row.offer.definition.choiceCount,
                          onChange: codes =>
                            setCart(rows => rows.map(item => (item.offer.id === row.offer.id ? { ...item, codes } : item))),
                        }}
                      />
                    </>
                  )}
                </article>
              ))}
              {leaving.map(code => (
                <label key={code} className="flex cursor-pointer gap-3">
                  <input
                    type="checkbox"
                    checked={drop.includes(code)}
                    onChange={event => setDrop(codes => (event.target.checked ? [...codes, code] : codes.filter(c => c !== code)))}
                  />
                  {t('hybrid.drop')}: {feature(code)}
                </label>
              ))}
            </div>
          )}
          {cart.length > 0 && (
            <HybridCartBar
              missing={
                incomplete?.offer.definition.kind === 'CHOICE_BUNDLE'
                  ? {
                      offer: incomplete.offer.name,
                      count: incomplete.offer.definition.choiceCount - incomplete.codes.length,
                      rowId: incomplete.offer.id,
                    }
                  : null
              }
              price={money(String(cart.reduce((sum, row) => sum + row.offer.definition.terms.price, 0)))}
              reviewDisabled={busy || !valid || current.isPending || !!recoveryError || !replacements.data}
              onReview={review}
            />
          )}
        </>
      )}
    </section>
  )
}
