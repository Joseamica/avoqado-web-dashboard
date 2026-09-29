import { useId, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/useDebounce'
import { FEATURE_CATEGORIES, getFeatureCatalog, type FeatureCategory } from '@/services/featureCatalog.service'

/** A shared, lazy catalog for onboarding and Billing. Purchasing is owned by the published offer. */
interface CatalogSelection {
  eligibleCodes: string[]
  selectedCodes: string[]
  includedCodes: string[]
  choiceCount?: number
  onChange: (codes: string[]) => void
}
export function FeatureCatalogBrowser({ selection }: { selection?: CatalogSelection } = {}) {
  const { t, i18n } = useTranslation('billing')
  // While choosing, the offer's own features go first; the full paged catalog is only for exploring.
  const [open, setOpen] = useState(false)
  const available = selection ? selection.eligibleCodes.filter(code => !selection.includedCodes.includes(code)).length : 0
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<FeatureCategory | ''>('')
  const [page, setPage] = useState(1)
  const panelId = useId()
  // Debouncing the whole query avoids requesting page 1 with the previous search after changing filters.
  const query = useMemo(
    () => ({ q: search.trim() || undefined, category: category || undefined, page, pageSize: 12 }),
    [search, category, page],
  )
  const params = useDebounce(query, 300)
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ['publicFeatureCatalog', params],
    queryFn: ({ signal }) => getFeatureCatalog(params, signal),
    enabled: open,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })
  const language = i18n.language?.split('-')[0]
  const locale = language === 'en' || language === 'fr' ? language : 'es'
  const changing =
    isFetching || params.q !== (search.trim() || undefined) || params.category !== (category || undefined) || params.page !== page

  return (
    <section data-tour="feature-catalog" className="mx-auto w-full max-w-5xl">
      {selection && (
        <fieldset data-tour="hybrid-offer-choices" className="mb-4">
          <legend className="mb-3 text-sm font-medium">{t('hybrid.offerChoices')}</legend>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {selection.eligibleCodes.map(code => {
              const included = selection.includedCodes.includes(code)
              return (
                <li key={code} className="flex flex-col justify-between gap-2 rounded-xl border border-border p-4">
                  <label className="flex cursor-pointer items-start gap-3 text-sm font-medium">
                    <input
                      type="checkbox"
                      className="mt-1 accent-primary"
                      data-tour={`hybrid-feature-${code.toLowerCase()}`}
                      checked={selection.selectedCodes.includes(code)}
                      disabled={included}
                      onChange={event =>
                        selection.onChange(
                          event.target.checked ? [...selection.selectedCodes, code] : selection.selectedCodes.filter(item => item !== code),
                        )
                      }
                    />
                    {t(`hybrid.featureNames.${code}`, { defaultValue: code })}
                  </label>
                  <p className="text-xs text-muted-foreground">{included ? t('hybrid.alreadyIncluded') : t('hybrid.eligible')}</p>
                </li>
              )
            })}
          </ul>
          {selection.choiceCount !== undefined && available < selection.choiceCount && (
            <p role="note" className="mt-3 text-sm text-muted-foreground">
              {t('hybrid.cannotComplete', { available, count: selection.choiceCount })}
            </p>
          )}
        </fieldset>
      )}
      <Button
        variant="ghost"
        className="mx-auto flex rounded-full"
        aria-expanded={open}
        aria-controls={panelId}
        data-tour="feature-catalog-toggle"
        onClick={() => setOpen(value => !value)}
      >
        {t('catalog.title')}
        <ChevronDown aria-hidden="true" className={`ml-2 h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>
      {open && (
        <div id={panelId} className="mt-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
          <p className="mb-4 text-sm text-muted-foreground">{t('catalog.intro')}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label={t('catalog.search')}
                placeholder={t('catalog.search')}
                maxLength={120}
                value={search}
                data-tour="feature-catalog-search"
                className="rounded-full pl-9"
                onChange={event => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
              />
            </div>
            <select
              aria-label={t('catalog.category')}
              data-tour="feature-catalog-category"
              value={category}
              className="h-10 rounded-full border border-input bg-background px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={event => {
                setCategory(event.target.value as FeatureCategory | '')
                setPage(1)
              }}
            >
              <option value="">{t('catalog.allCategories')}</option>
              {FEATURE_CATEGORIES.map(key => (
                <option key={key} value={key}>
                  {t(key === 'custom' ? 'catalog.custom' : `plan.compare.categories.${key}`)}
                </option>
              ))}
            </select>
          </div>
          {isError ? (
            <div role="alert" className="mt-6 text-sm">
              <p>{t('catalog.error')}</p>
              <Button variant="outline" className="mt-3 rounded-full" onClick={() => void refetch()}>
                {t('catalog.retry')}
              </Button>
            </div>
          ) : isPending ? (
            <p role="status" className="py-8 text-sm text-muted-foreground">
              {t('catalog.loading')}
            </p>
          ) : (
            data && (
              <>
                <p role="status" className="my-4 text-sm text-muted-foreground">
                  {t('catalog.total', { count: data.total })}
                </p>
                <ul aria-busy={changing} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.items.map(feature => (
                    <li key={feature.id} className="flex min-h-28 flex-col justify-between gap-3 rounded-xl border border-border p-4">
                      <h3 className="text-sm font-medium">{feature.names[locale] ?? feature.name}</h3>
                      {selection && feature.featureCode && (
                        <p className="text-xs text-muted-foreground">
                          {selection.includedCodes.includes(feature.featureCode)
                            ? t('hybrid.alreadyIncluded')
                            : !selection.eligibleCodes.includes(feature.featureCode)
                              ? t('hybrid.notEligible')
                              : t('hybrid.eligible')}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {feature.offering === 'CONTACT'
                          ? t('catalog.assisted')
                          : feature.minimumTier === 'FREE'
                            ? t('catalog.base')
                            : t('catalog.fromTier', {
                                tier: feature.minimumTier ? t(`plan.tiers.${feature.minimumTier.toLowerCase()}.name`) : '—',
                              })}
                      </p>
                    </li>
                  ))}
                </ul>
                {data.total === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{t('catalog.empty')}</p>}
                {data.totalPages > 1 && (
                  <nav aria-label={t('catalog.pagination')} className="mt-5 flex items-center justify-between gap-3">
                    <Button
                      variant="outline"
                      className="rounded-full"
                      disabled={changing || page <= 1}
                      onClick={() => setPage(value => value - 1)}
                    >
                      {t('catalog.previous')}
                    </Button>
                    <span className="text-xs text-muted-foreground">{t('catalog.page', { page: data.page, pages: data.totalPages })}</span>
                    <Button
                      variant="outline"
                      className="rounded-full"
                      disabled={changing || page >= data.totalPages}
                      onClick={() => setPage(value => value + 1)}
                    >
                      {t('catalog.next')}
                    </Button>
                  </nav>
                )}
              </>
            )
          )}
        </div>
      )}
    </section>
  )
}
