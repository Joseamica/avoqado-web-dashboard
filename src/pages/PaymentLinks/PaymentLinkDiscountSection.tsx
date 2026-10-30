import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { DateTime } from 'luxon'
import { Lock } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuth } from '@/context/AuthContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import discountService from '@/services/discount.service'
import { discountError, type DiscountFormValue } from './payment-link-discount.utils'
import { Currency } from '@/utils/currency'
import { getIntlLocale } from '@/utils/i18n-locale'

/** Avisar «vence en N días» cuando faltan 7 o menos (umbral del spec). */
const EXPIRY_WARNING_DAYS = 7

/** Descuento en pesos de la vista previa (centavos, mitad hacia arriba); el servidor es quien manda. */
function previewDiscount(base: number, type: 'PERCENTAGE' | 'FIXED_AMOUNT', value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null
  if (type === 'PERCENTAGE') return value < 100 ? Math.round(base * value + 1e-9) / 100 : null
  return value < base ? value : null
}

interface Props {
  value: DiscountFormValue
  onChange: (v: DiscountFormValue) => void
  base: number | null
  amountType: 'FIXED' | 'OPEN'
  canApply: boolean
  canRead: boolean
  onSetExpiry: (iso: string) => void
  /** Vencimiento ya fijado desde el aviso (para confirmarlo en pantalla). */
  expiresAt?: string | null
}

export function PaymentLinkDiscountSection({ value, onChange, base, amountType, canApply, canRead, onSetExpiry, expiresAt }: Props) {
  const { t, i18n } = useTranslation('paymentLinks')
  const { venueId } = useCurrentVenue()
  const { activeVenue } = useAuth()
  const zone = activeVenue?.timezone || 'America/Mexico_City'
  const locale = getIntlLocale(i18n?.language)

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search.trim(), 300)
  const catalogOpen = !!venueId && canApply && canRead && value.mode === 'CATALOG'
  const catalog = useQuery({
    queryKey: ['discounts', venueId, 'payment-link-picker', debouncedSearch],
    queryFn: () =>
      discountService.getDiscounts(venueId, {
        active: true,
        scope: 'ORDER',
        pageSize: 100,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      }),
    enabled: catalogOpen,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
  const now = Date.now()
  const rows = catalog.data?.data ?? []
  const options = rows.filter(
    d => d.active && (!d.validFrom || new Date(d.validFrom).getTime() <= now) && (!d.validUntil || new Date(d.validUntil).getTime() >= now),
  )
  // El servidor no filtra por fechas: con más páginas no se sabe cuántos vigentes hay (puede haber vencidos allá),
  // así que no se promete un total y se pide refinar.
  const morePages = (catalog.data?.meta?.totalCount ?? rows.length) > rows.length
  const pickedId = value.mode === 'CATALOG' ? value.discountId : ''
  const inPage = options.find(d => d.id === pickedId)
  // Un descuento ya elegido (p. ej. al editar) puede no estar en esta página: se trae por id.
  const picked = useQuery({
    queryKey: ['discount', venueId, pickedId],
    queryFn: () => discountService.getDiscount(venueId, pickedId),
    enabled: catalogOpen && !!pickedId && !inPage,
    staleTime: 30_000,
  })
  const selected = inPage ?? (pickedId ? picked.data : undefined)

  const shownDiscount =
    value.mode === 'MANUAL'
      ? { type: value.type, value: Number(value.value) }
      : selected
        ? { type: selected.type as 'PERCENTAGE' | 'FIXED_AMOUNT', value: Number(selected.value) }
        : null
  const fixedBase = amountType === 'FIXED' && base != null && base > 0 ? base : null
  const minPurchase = selected?.minPurchaseAmount ? Number(selected.minPurchaseAmount) : 0
  const belowMin = fixedBase != null && minPurchase > 0 && fixedBase < minPurchase
  let off = shownDiscount && fixedBase != null ? previewDiscount(fixedBase, shownDiscount.type, shownDiscount.value) : null
  // Tope del catálogo (0 = sin tope, igual que el servidor).
  const cap = selected?.maxDiscountAmount ? Number(selected.maxDiscountAmount) : 0
  if (off != null && cap > 0) off = Math.min(off, cap)
  const error = discountError(value)

  // Días de calendario del negocio hasta que venza el descuento elegido.
  const days = selected?.validUntil
    ? Math.round(
        DateTime.fromISO(selected.validUntil, { zone: 'utc' })
          .setZone(zone)
          .startOf('day')
          .diff(DateTime.now().setZone(zone).startOf('day'), 'days').days,
      )
    : null
  const untilLabel = selected?.validUntil
    ? DateTime.fromISO(selected.validUntil, { zone: 'utc' }).setZone(zone).setLocale(locale).toLocaleString(DateTime.DATE_MED)
    : ''

  const expiresLabel = expiresAt
    ? DateTime.fromISO(expiresAt, { zone: 'utc' }).setZone(zone).setLocale(locale).toLocaleString(DateTime.DATE_MED)
    : ''

  const radio = (id: string, mode: DiscountFormValue['mode'], disabled: boolean, label: string, hint?: string) => (
    <div className="flex items-start gap-2">
      <input
        type="radio"
        id={id}
        name="pl-discount-mode"
        className="mt-1 cursor-pointer"
        checked={value.mode === mode}
        disabled={disabled}
        onChange={() => {
          if (mode === 'NONE') onChange({ mode: 'NONE' })
          else if (mode === 'MANUAL') onChange({ mode: 'MANUAL', type: 'PERCENTAGE', value: '', name: '' })
          else onChange({ mode: 'CATALOG', discountId: '' })
        }}
      />
      <div>
        <Label htmlFor={id} className="cursor-pointer">
          {label}
        </Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )

  return (
    <section className="space-y-3" data-tour="payment-link-discount">
      <h2 className="text-lg font-semibold">{t('discount.title')}</h2>
      {!canApply && <p className="text-sm text-muted-foreground">{t('discount.noApplyPermission')}</p>}

      <div className="space-y-2">
        {radio('pl-discount-none', 'NONE', !canApply, t('discount.none'))}
        {radio('pl-discount-manual', 'MANUAL', !canApply, t('discount.manual'))}
        {radio(
          'pl-discount-catalog',
          'CATALOG',
          !canApply || !canRead,
          t('discount.catalog'),
          canApply && !canRead ? t('discount.noReadPermission') : undefined,
        )}
      </div>

      {value.mode === 'MANUAL' && (
        <div className="space-y-3 rounded-lg border border-input p-3">
          <div className="flex gap-2">
            <div className="flex rounded-lg border border-input bg-muted/50 p-1">
              {(['PERCENTAGE', 'FIXED_AMOUNT'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => onChange({ ...value, type })}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium cursor-pointer ${
                    value.type === type ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {type === 'PERCENTAGE' ? '%' : '$'}
                </button>
              ))}
            </div>
            <Input
              aria-label={t('discount.valueField')}
              type="number"
              min="0.01"
              step="0.01"
              value={value.value}
              onChange={e => onChange({ ...value, value: e.target.value })}
              className="h-10"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pl-discount-name">{t('discount.nameField')}</Label>
            <Input
              id="pl-discount-name"
              maxLength={60}
              value={value.name}
              onChange={e => onChange({ ...value, name: e.target.value })}
              placeholder={t('discount.namePlaceholder')}
            />
          </div>
        </div>
      )}

      {value.mode === 'CATALOG' && (
        <div className="space-y-2 rounded-lg border border-input p-3">
          <Input
            aria-label={t('discount.search')}
            placeholder={t('discount.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {catalog.isLoading && <p className="text-sm text-muted-foreground">{t('discount.loading')}</p>}
          {catalog.isError && <p className="text-sm text-destructive">{t('discount.loadError')}</p>}
          {catalog.data && options.length === 0 && <p className="text-sm text-muted-foreground">{t('discount.emptyCatalog')}</p>}
          {pickedId && !inPage && selected && (
            <p className="text-sm">
              {t('discount.selected')} <strong>{selected.name}</strong>
            </p>
          )}
          {options.map(d => {
            const ok = d.paymentLinkCompatibility?.ok !== false
            const isSel = value.discountId === d.id
            return (
              <button
                key={d.id}
                type="button"
                disabled={!ok}
                onClick={() => onChange({ mode: 'CATALOG', discountId: d.id })}
                className={`flex w-full items-center justify-between rounded-md border p-2 text-left text-sm ${
                  isSel ? 'border-primary bg-primary/10' : 'border-border'
                } ${ok ? 'cursor-pointer hover:bg-muted/50' : 'cursor-not-allowed opacity-60'}`}
              >
                <span className="flex min-w-0 items-start gap-2">
                  {!ok && <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
                  <span className="min-w-0">
                    <span className="block font-medium">{d.name}</span>
                    {!ok && d.paymentLinkCompatibility?.razon && (
                      <span className="block text-xs text-muted-foreground">{d.paymentLinkCompatibility.razon}</span>
                    )}
                  </span>
                </span>
                <span className="shrink-0 whitespace-nowrap pl-3 text-muted-foreground">
                  {d.type === 'PERCENTAGE' ? `${Number(d.value)} %` : Currency(Number(d.value))}
                </span>
              </button>
            )
          })}
          {catalog.data && options.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {morePages
                ? `${t('discount.countPartial', { shown: options.length })} · ${t('discount.refine')}`
                : t('discount.count', { shown: options.length, total: options.length })}
            </p>
          )}
        </div>
      )}

      {selected?.validUntil && days != null && days >= 0 && days <= EXPIRY_WARNING_DAYS && (
        <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p>{t('discount.expiresSoon', { date: untilLabel, days })}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => onSetExpiry(selected.validUntil as string)}
          >
            {t('discount.alsoExpire', { date: untilLabel })}
          </Button>
        </div>
      )}

      {value.mode !== 'NONE' && error && <p className="text-sm text-destructive">{t(`discount.${error}`)}</p>}

      {expiresAt && <p className="text-sm text-muted-foreground">{t('discount.expiresOn', { date: expiresLabel })}</p>}

      {value.mode !== 'NONE' && shownDiscount && (
        <p className="text-sm">
          {amountType === 'OPEN' || fixedBase == null ? (
            <span className="text-muted-foreground">{t('discount.openAmountHint')}</span>
          ) : belowMin ? (
            <span className="text-destructive">{t('discount.minPurchase', { amount: Currency(minPurchase) })}</span>
          ) : off != null ? (
            <span>
              {t('discount.liveTotal')} <strong>{Currency(fixedBase - off)}</strong>{' '}
              <span className="text-muted-foreground">({t('discount.liveOff', { amount: Currency(off) })})</span>
            </span>
          ) : null}
        </p>
      )}

      {value.mode !== 'NONE' && canApply && (
        <Button type="button" variant="ghost" size="sm" className="cursor-pointer" onClick={() => onChange({ mode: 'NONE' })}>
          {t('discount.remove')}
        </Button>
      )}
    </section>
  )
}
