// src/components/billing/FeatureGate.tsx
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { useFeaturePrice } from '@/hooks/use-feature-price'
import { Button } from '@/components/ui/button'
import { getTierDef, type TierId } from '@/config/plan-catalog'
import { cn } from '@/lib/utils'

interface FeatureGateProps {
  /** Feature code that gates this content (e.g. 'CFDI'). */
  feature: string
  /** Override the advertised/required tier; defaults to getTierForFeature(feature). */
  requiredTier?: TierId
  children: React.ReactNode
}

/**
 * Los PLANES se muestran «$999/mes + IVA» (`plan.plusIva`) porque su precio de catálogo es base.
 * 🔴 Las funciones sueltas NO: `syncFeaturesToStripe` cobra `monthlyPrice` tal cual, sin IVA encima,
 * así que su texto no lleva «+ IVA» (Codex, 21-sep).
 */
const fmtMxn = (n: number) => `$${n.toLocaleString('es-MX')}`

const ACCENT: Record<string, string> = {
  free: 'text-muted-foreground',
  pro: 'text-emerald-400',
  premium: 'text-amber-400',
  enterprise: 'text-slate-300',
}

export function FeatureGate({ feature, requiredTier, children }: FeatureGateProps) {
  const { t } = useTranslation('billing')
  const { fullBasePath } = useCurrentVenue()
  const navigate = useNavigate()
  // Tier-aware access (gates normal venues by plan tier — unlike canFeature which is white-label-only).
  const { hasAccess, requiredTier: tierId } = useTierFeatureAccess(feature, requiredTier)
  // Sólo se pide el precio cuando el cartel se va a dibujar (`!hasAccess`).
  const { price: precioSuelto, canSeePrices, canPurchase } = useFeaturePrice(feature, { enabled: !hasAccess })

  if (hasAccess) return <>{children}</>

  const def = getTierDef(tierId)
  const Icon = def.icon
  // Use capitalized key directly so i18n interpolation produces the real tier name
  // (e.g. "premium" → "Premium"). Both locale files define `plan.tiers.premium.name = "Premium"`.
  const tierName = def.key.charAt(0).toUpperCase() + def.key.slice(1)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-input">
      {/* blurred teaser */}
      <div aria-hidden className="pointer-events-none select-none opacity-50 blur-[5px]">
        {children}
      </div>
      {/* paywall card */}
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-input bg-popover p-7 text-center shadow-2xl">
          <div className={cn('mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-amber-400/15', ACCENT[def.accent])}>
            <Icon className="h-6 w-6" />
          </div>
          <p className={cn('text-[11px] font-bold uppercase tracking-wide', ACCENT[def.accent])}>
            {t('featureGate.tierTag', { tier: tierName })}
          </p>
          <p className="mx-auto mb-3 mt-3 max-w-[30ch] text-sm text-muted-foreground">
            {t('featureGate.body', { tier: tierName })}
          </p>
          {/* 🔴 Los precios y el botón sólo para quien puede contratar. A los demás se les dice a
              quién pedírselo — nunca se esconde la pantalla ni se les manda a un 403. */}
          {canSeePrices ? (
            <>
              <div className="mb-5 space-y-1">
                {def.priceMonthly != null && (
                  <p className="text-sm font-medium">{t('featureGate.planPrice', { tier: tierName, price: fmtMxn(def.priceMonthly) })}</p>
                )}
                {precioSuelto != null && (
                  <p className="text-xs text-muted-foreground">
                    <span>{t('featureGate.alonePrice', { price: fmtMxn(precioSuelto) })}</span>
                    {/* 🔴 La compra suelta está CERRADA por ahora (founder, 21-sep, opción A): se contrata con
                        nuestro equipo. Sólo quien puede contratar ve el enlace; a los demás, «pídesela al dueño». */}
                    {canPurchase && (
                      <>
                        {' · '}
                        <a
                          className="underline underline-offset-2 hover:text-foreground"
                          href={`mailto:hola@avoqado.io?subject=${encodeURIComponent(t('featureGate.aloneContactSubject', { feature }))}`}
                        >
                          {t('featureGate.aloneContact')}
                        </a>
                      </>
                    )}
                  </p>
                )}
              </div>
              {/* Ver precios (`read`) no es poder comprar (`manage`): sin el segundo, a quién pedírselo. */}
              {canPurchase ? (
                <Button className="cursor-pointer gap-2" onClick={() => navigate(`${fullBasePath}/settings/billing/subscriptions`)}>
                  <Icon className="h-4 w-4" />
                  {t('featureGate.upgrade', { tier: tierName })}
                </Button>
              ) : (
                <p className="mb-1 text-xs text-muted-foreground">{t('featureGate.askOwner')}</p>
              )}
            </>
          ) : (
            <p className="mb-1 mt-4 text-xs text-muted-foreground">{t('featureGate.askOwner')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
