import { useQuery } from '@tanstack/react-query'
import { DateTime } from 'luxon'
import { Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import discountService from '@/services/discount.service'
import type { PaymentLinkDiscountInput, PaymentLinkDiscountView } from '@/services/paymentLink.service'
import { Currency } from '@/utils/currency'
import { getIntlLocale } from '@/utils/i18n-locale'

export type DiscountFormValue =
  | { mode: 'NONE' }
  | { mode: 'MANUAL'; type: 'PERCENTAGE' | 'FIXED_AMOUNT'; value: string; name: string }
  | { mode: 'CATALOG'; discountId: string }

/** Avisar «vence en N días» cuando faltan 7 o menos (umbral del spec). */
const EXPIRY_WARNING_DAYS = 7

/** Precarga el formulario con el descuento que ya tiene la liga. */
export function discountFromLink(d: PaymentLinkDiscountView | null | undefined): DiscountFormValue {
  if (!d) return { mode: 'NONE' }
  if (d.origen === 'CATALOGO' && d.discountId) return { mode: 'CATALOG', discountId: d.discountId }
  return { mode: 'MANUAL', type: d.type, value: String(d.value), name: d.name }
}

/**
 * Lo que se manda al servidor. Sin tocar → ni la llave (una liga con descuento vencido sigue aceptando
 * cambios de precio/título); quitar → `discount: null`.
 */
export function discountPayload(v: DiscountFormValue, touched: boolean): { discount?: PaymentLinkDiscountInput | null } {
  if (!touched) return {}
  if (v.mode === 'NONE') return { discount: null }
  if (v.mode === 'CATALOG') return { discount: { mode: 'CATALOG', discountId: v.discountId } }
  const name = v.name.trim()
  return { discount: { mode: 'MANUAL', type: v.type, value: Number(v.value), ...(name ? { name } : {}) } }
}

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

  const catalog = useQuery({
    queryKey: ['discounts', venueId, 'payment-link-picker'],
    queryFn: () => discountService.getDiscounts(venueId, { active: true, scope: 'ORDER', pageSize: 100 }),
    enabled: !!venueId && canApply && canRead && value.mode === 'CATALOG',
    staleTime: 30_000,
  })
  const now = Date.now()
  const options = (catalog.data?.data ?? []).filter(
    d =>
      d.active &&
      d.type !== 'COMP' &&
      !d.requiresApproval &&
      (!d.validFrom || new Date(d.validFrom).getTime() <= now) &&
      (!d.validUntil || new Date(d.validUntil).getTime() >= now),
  )
  const selected = value.mode === 'CATALOG' ? options.find(d => d.id === value.discountId) : undefined

  const shownDiscount =
    value.mode === 'MANUAL'
      ? { type: value.type, value: Number(value.value) }
      : selected && selected.type !== 'COMP'
        ? { type: selected.type, value: Number(selected.value) }
        : null
  const fixedBase = amountType === 'FIXED' && base != null && base > 0 ? base : null
  const off = shownDiscount && fixedBase != null ? previewDiscount(fixedBase, shownDiscount.type, shownDiscount.value) : null

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
          {catalog.isLoading && <p className="text-sm text-muted-foreground">{t('discount.loading')}</p>}
          {catalog.isError && <p className="text-sm text-destructive">{t('discount.loadError')}</p>}
          {catalog.data && options.length === 0 && <p className="text-sm text-muted-foreground">{t('discount.emptyCatalog')}</p>}
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
                <span className="flex items-center gap-2">
                  {!ok && <Lock className="h-4 w-4" aria-hidden />}
                  <span className="font-medium">{d.name}</span>
                  {!ok && d.paymentLinkCompatibility?.razon && (
                    <span className="text-xs text-muted-foreground">{d.paymentLinkCompatibility.razon}</span>
                  )}
                </span>
                <span className="text-muted-foreground">
                  {d.type === 'PERCENTAGE' ? `${Number(d.value)} %` : Currency(Number(d.value))}
                </span>
              </button>
            )
          })}
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

      {expiresAt && <p className="text-sm text-muted-foreground">{t('discount.expiresOn', { date: expiresLabel })}</p>}

      {value.mode !== 'NONE' && shownDiscount && (
        <p className="text-sm">
          {amountType === 'OPEN' || fixedBase == null ? (
            <span className="text-muted-foreground">{t('discount.openAmountHint')}</span>
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
