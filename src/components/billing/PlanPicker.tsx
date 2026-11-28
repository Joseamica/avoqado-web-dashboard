// src/components/billing/PlanPicker.tsx
import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PLAN_TIERS, TIER_ORDER, type TierId, type PlanTierDef } from '@/config/plan-catalog'
import { totalDeBeneficios } from '@/config/plan-comparison'
import { PlanBenefitsDialog } from './PlanBenefitsDialog'
import { nombreDeGratisEnBeneficios, nombreDelPlanDe, usePlanOffer, type OfertaDePlanes } from '@/hooks/usePlanOffer'
import { fmtPesos } from '@/lib/fmtPesos'
import { textoDelAnual } from '@/lib/textoDelAnual'
import { Currency } from '@/utils/currency'

const ACCENT: Record<PlanTierDef['accent'], string> = {
  free: 'text-muted-foreground',
  pro: 'text-emerald-400',
  premium: 'text-amber-400',
  enterprise: 'text-slate-300',
}
const ACCENT_BG: Record<PlanTierDef['accent'], string> = {
  free: 'bg-muted',
  pro: 'bg-emerald-400/15',
  premium: 'bg-amber-400/15',
  enterprise: 'bg-slate-300/10',
}

/** Beneficios que la tarjeta enseña a la vista; el resto vive en «Ver todos» (founder, 25-sep). */
const PRINCIPALES_VISIBLES = 4
const PLAN_ANTERIOR: Partial<Record<string, TierId>> = { allFree: 'FREE', allPro: 'PRO', allPremium: 'PREMIUM' }

const fmt = fmtPesos
/**
 * What `currentTier` means to the caller.
 *
 * - `'owned'` (default) — the plan the venue ALREADY has (billing portal). That card is
 *   inert: its CTA is a disabled "Tu plan actual" and the card body is NOT clickable, so a
 *   stray click can never start an upgrade/downgrade.
 * - `'choice'` — the tier the user just PICKED inside a wizard (SetupWizard PlanStep,
 *   ConversionWizard). Nothing is owned yet, so every card stays live: the whole card is a
 *   radio, and the CTAs read "Elegir X" / "Seleccionado" instead of "Mejorar a X" /
 *   "Tu plan actual". Using `'owned'` in a wizard is what left the pre-selected PRO card
 *   with a dead button and no way forward.
 */
/** Lo que cotizó el SERVIDOR para un plan. Con `displayName` y los brutos, el nombre y el texto del anual salen de ESA cotización. */
export interface PrecioCotizado {
  monthlyNetCents: number
  annualNetCents: number
  displayName?: string
  monthlyGrossCents?: number
  annualGrossCents?: number
}

/** IVA de México: el bruto de una cotización que no lo trae se saca con la misma regla del SERVIDOR. */
const brutoDe = (netCents: number) => Math.round(netCents * 1.16)

export type PlanSelectionMode = 'owned' | 'choice'

interface PlanPickerProps {
  currentTier: TierId
  onSelectTier: (tier: TierId, interval: 'monthly' | 'annual') => void
  /**
   * Controlled billing interval. When provided (with `onIntervalChange`), the parent owns
   * the toggle state — used by wizards that must persist the interval even when the user
   * flips the toggle without re-clicking a tier CTA. Omit for the default uncontrolled mode.
   */
  interval?: 'monthly' | 'annual'
  onIntervalChange?: (interval: 'monthly' | 'annual') => void
  /**
   * Optional promo note rendered under a tier's price line (e.g. the onboarding intro
   * offer "3 meses a $599" on PRO). Display-only — the caller owns the promo's billing logic.
   */
  promoNotes?: Partial<Record<TierId, string>>
  /** See {@link PlanSelectionMode}. Defaults to `'owned'` (billing portal semantics). */
  selectionMode?: PlanSelectionMode
  /**
   * Tarjeta extra a la IZQUIERDA de las demás (el Plan Básico del alta). Con ella la cuadrícula cuenta 4 columnas
   * contándola, y Pro conserva su «Más popular».
   */
  leadingCard?: ReactNode
  /**
   * Precios SIN IVA que publica el servidor (el alta). Presentes ⇒ la tarjeta pinta ESE monto + «+ IVA», el mismo que
   * consiente el cobro; ausentes ⇒ el del catálogo. Nunca se derivan aquí.
   */
  preciosSinIva?: Partial<Record<TierId, PrecioCotizado>>
  /** El plan elegido sólo existe mensual (el Básico): el selector Mensual/Anual se apaga en vez de no hacer nada. */
  intervalLocked?: boolean
  /** La tarjeta de `leadingCard` es la elegida: ninguna de las demás se pinta como elegida. */
  leadingSelected?: boolean
  /**
   * Planes editables (B2, Task 12): los planes que la versión del editor no vende hoy. Su tarjeta se pinta apagada, dice
   * «No disponible por ahora» en vez de un precio y no llama a `onSelectTier`. Sin la prop, como hoy.
   */
  fueraDeVenta?: Partial<Record<TierId, true>>
}

export function PlanPicker({
  currentTier,
  onSelectTier,
  interval: controlledInterval,
  onIntervalChange,
  promoNotes,
  selectionMode = 'owned',
  leadingCard,
  leadingSelected = false,
  preciosSinIva,
  intervalLocked = false,
  fueraDeVenta,
}: PlanPickerProps) {
  const { t, i18n } = useTranslation('billing')
  const [internalInterval, setInternalInterval] = useState<'monthly' | 'annual'>('monthly')
  const interval = controlledInterval ?? internalInterval
  const setInterval = (i: 'monthly' | 'annual') => {
    setInternalInterval(i)
    onIntervalChange?.(i)
  }

  const tiers = useMemo(() => PLAN_TIERS, [])
  // La píldora del anual habla de TODOS los planes de pago a la venta: «2 meses gratis» sólo si cada uno lo cumple (anual = 10
  // mensualidades). De la cotización, si la hay; si no, de la oferta vigente. Ningún plan decide solo.
  const oferta = usePlanOffer()
  const nombreDelPlan = (id: TierId) => preciosSinIva?.[id]?.displayName ?? nombreDelPlanDe(oferta, id, t)
  const noSeVende = (id: TierId) =>
    !!fueraDeVenta?.[id] ||
    (!preciosSinIva?.[id] && (id === 'PRO' || id === 'PREMIUM') && oferta.estado === 'servidor' && !oferta[id].onSale)
  const textoDelBeneficio = (clave: string) => {
    const anterior = PLAN_ANTERIOR[clave]
    if (!anterior) return t(`plan.features.${clave}`)
    if (noSeVende(anterior)) return null
    const plan =
      anterior === 'FREE'
        ? (preciosSinIva?.FREE?.displayName ?? nombreDeGratisEnBeneficios(oferta, t, i18n?.resolvedLanguage ?? i18n?.language))
        : nombreDelPlan(anterior)
    return t(`plan.features.${clave}`, { plan })
  }
  const textosDelAnual = preciosSinIva
    ? (['PRO', 'PREMIUM'] as const).flatMap(id => {
        const cotizado = preciosSinIva[id]
        return cotizado
          ? [
              textoDelAnual(
                cotizado.monthlyGrossCents ?? brutoDe(cotizado.monthlyNetCents),
                cotizado.annualGrossCents ?? brutoDe(cotizado.annualNetCents),
              ),
            ]
          : []
      })
    : oferta.estado === 'servidor'
      ? (['PRO', 'PREMIUM'] as const).flatMap(id =>
          oferta[id].onSale ? [textoDelAnual(oferta[id].monthly.grossCents, oferta[id].annual.grossCents)] : [],
        )
      : []
  const pildoraDosMesesGratis = textosDelAnual.length > 0 && textosDelAnual.every(texto => texto?.tipo === 'dosMesesGratis')

  return (
    // `@container` + `@`-variants below: the grid must react to the width of ITS OWN box,
    // not the viewport. The setup wizard renders this inside a fixed-width column, so
    // viewport breakpoints (`xl:grid-cols-4`) used to fire on a wide screen and squeeze
    // four cards into a narrow column.
    <div className="@container flex flex-col gap-6">
      {/* Billing toggle — the savings hint lives ON the annual segment so it's unambiguously
          tied to choosing annual (not a floating pill that reads as always-on). */}
      <div className="flex items-center gap-3">
        <div className="inline-flex rounded-full border border-input bg-muted/60 p-1">
          {(['monthly', 'annual'] as const).map(i => (
            <button
              key={i}
              type="button"
              disabled={intervalLocked}
              onClick={() => setInterval(i)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
                interval === i ? 'bg-foreground text-background' : 'text-muted-foreground',
              )}
            >
              {t(`plan.billing.${i}`)}
              {i === 'annual' && pildoraDosMesesGratis && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
                    interval === 'annual' ? 'bg-emerald-400 text-emerald-950' : 'bg-emerald-400/15 text-emerald-500',
                  )}
                >
                  {t('plan.billing.save')}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div
        // Todas las tarjetas miden lo mismo de alto (founder, 25-sep): una fila pareja se compara mejor.
        className={cn(
          'grid grid-cols-1 gap-4 @lg:grid-cols-2',
          // Una columna por tarjeta en el ancho máximo: con el Básico son 5 y Enterprise no se queda sola en otra fila.
          leadingCard ? '@4xl:grid-cols-5' : '@4xl:grid-cols-4',
        )}
        {...(selectionMode === 'choice' ? { role: 'radiogroup', 'aria-label': t('plan.chooseAria') } : {})}
      >
        {tiers.map(tier => (
          <Fragment key={tier.id}>
            {/* Gratis · Básico · Pro · Premium · Enterprise: el Básico va justo a la izquierda de Pro. */}
            {tier.id === 'PRO' && leadingCard}
            <PlanCard
              tier={tier}
              interval={interval}
              selectionMode={selectionMode}
              isCurrent={!leadingSelected && tier.id === currentTier}
              isDowngrade={TIER_ORDER.indexOf(tier.id) < TIER_ORDER.indexOf(currentTier)}
              promoNote={promoNotes?.[tier.id]}
              precioSinIva={preciosSinIva?.[tier.id]}
              oferta={oferta}
              tierName={nombreDelPlan(tier.id)}
              noDisponible={noSeVende(tier.id)}
              textoDelBeneficio={textoDelBeneficio}
              onSelect={() => {
                if (!fueraDeVenta?.[tier.id]) onSelectTier(tier.id, interval)
              }}
            />
          </Fragment>
        ))}
      </div>
    </div>
  )
}

function PlanCard({
  tier,
  interval,
  selectionMode,
  isCurrent,
  isDowngrade,
  promoNote,
  precioSinIva,
  oferta,
  tierName,
  noDisponible,
  textoDelBeneficio,
  onSelect,
}: {
  tier: PlanTierDef
  interval: 'monthly' | 'annual'
  selectionMode: PlanSelectionMode
  isCurrent: boolean
  isDowngrade: boolean
  promoNote?: string
  precioSinIva?: PrecioCotizado
  oferta: OfertaDePlanes
  tierName: string
  noDisponible: boolean
  textoDelBeneficio: (clave: string) => string | null
  onSelect: () => void
}) {
  const { t } = useTranslation('billing')
  const Icon = tier.icon
  const esDePago = tier.id === 'PRO' || tier.id === 'PREMIUM'
  // De dónde sale el dinero: la cotización del llamador, o la oferta vigente (un 200). Nunca un número guardado en el catálogo (B4).
  const fuente = precioSinIva
    ? {
        monthlyNet: precioSinIva.monthlyNetCents,
        annualNet: precioSinIva.annualNetCents,
        monthlyGross: precioSinIva.monthlyGrossCents ?? brutoDe(precioSinIva.monthlyNetCents),
        annualGross: precioSinIva.annualGrossCents ?? brutoDe(precioSinIva.annualNetCents),
      }
    : esDePago && oferta.estado === 'servidor'
      ? {
          monthlyNet: oferta[tier.id as 'PRO' | 'PREMIUM'].monthly.netCents,
          annualNet: oferta[tier.id as 'PRO' | 'PREMIUM'].annual.netCents,
          monthlyGross: oferta[tier.id as 'PRO' | 'PREMIUM'].monthly.grossCents,
          annualGross: oferta[tier.id as 'PRO' | 'PREMIUM'].annual.grossCents,
        }
      : null
  // Always show the effective MONTHLY price as the headline; annual shows the per-month
  // equivalent with the yearly total in the subtitle (matches the approved mockup).
  const precioAnual = fuente ? fuente.annualNet / 100 : tier.id === 'FREE' ? 0 : undefined
  const monthlyEquiv: number | null | undefined = fuente
    ? precioSinIva
      ? interval === 'monthly'
        ? fuente.monthlyNet / 100
        : Math.round(fuente.annualNet / 12) / 100
      : interval === 'monthly'
        ? fuente.monthlyNet / 100
        : // Con la versión del editor (≥ 2) el equivalente mensual lleva centavos, como el de la cotización; la v1, en pesos enteros de hoy.
          oferta.estado === 'servidor' && oferta.offerVersion !== null && oferta.offerVersion >= 2
          ? Math.round(fuente.annualNet / 12) / 100
          : Math.round(fuente.annualNet / 100 / 12)
    : tier.id === 'FREE'
      ? 0
      : tier.priceMonthly === null
        ? null
        : undefined // sin dato del SERVIDOR: ningún monto (ni $0.00)
  const textoAnual = fuente ? textoDelAnual(fuente.monthlyGross, fuente.annualGross) : null
  const textoAnualPintado =
    textoAnual?.tipo === 'dosMesesGratis'
      ? t('plan.billing.save')
      : textoAnual?.tipo === 'ahorras'
        ? t('plan.annualSaves', { amount: Currency(textoAnual.grossCentsAlAnio, true) })
        : null

  const isChoice = selectionMode === 'choice'
  const [verTodos, setVerTodos] = useState(false)
  /** Wizard: this card is the user's current pick. Billing: this is the plan they own. */
  const isPicked = isChoice && isCurrent
  const isOwned = !isChoice && isCurrent

  // Choice mode: the whole card is the hit target (the founder's ask — "si picas el card se
  // selecciona, no necesariamente un botón"). Owned mode keeps the card inert so a stray
  // click in the billing portal can never kick off an upgrade or a downgrade.
  const cardInteraction = noDisponible
    ? isChoice
      ? { role: 'radio' as const, 'aria-checked': isPicked, 'aria-disabled': true, tabIndex: -1 }
      : { 'aria-disabled': true }
    : isChoice
      ? {
          role: 'radio' as const,
          'aria-checked': isPicked,
          tabIndex: 0,
          onClick: onSelect,
          onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
            // Only when the card itself has focus — otherwise Enter on the inner CTA would
            // fire the action twice.
            if (e.target !== e.currentTarget) return
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onSelect()
            }
          },
        }
      : {}

  // The inner CTA repeats the card's action, so stop the bubble to avoid a double fire
  // (for ENTERPRISE that would open two WhatsApp tabs).
  const ctaClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect()
  }
  // One tab stop per card in choice mode: the card is the radio, the CTA is decoration.
  const ctaTabIndex = isChoice ? -1 : undefined

  // Lo que ofrece el pie de «Ver todos»: elegir el plan desde ahí (asistentes) o escribir a ventas.
  // En Facturación no se cambia de plan desde la ventana: sólo se cierra.
  const accionDeLaVentana = noDisponible
    ? undefined
    : tier.checkout === 'contact'
      ? { label: t('plan.cta.contact'), onClick: onSelect }
      : isChoice && !isPicked && tier.checkout !== 'coming_soon'
        ? { label: t('plan.cta.choose', { tier: tierName }), onClick: onSelect }
        : undefined

  return (
    <Fragment>
      <div
        data-tour={`plan-card-${tier.id.toLowerCase()}`}
        {...cardInteraction}
        className={cn(
          'relative flex flex-col gap-4 rounded-2xl border border-input bg-card p-5 transition hover:-translate-y-0.5',
          tier.popular && 'border-emerald-400/55 ring-1 ring-emerald-400/25',
          isChoice && !noDisponible && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isChoice && !isPicked && !noDisponible && 'hover:border-foreground/30',
          noDisponible && 'cursor-not-allowed opacity-60 hover:translate-y-0',
          // Selection ring uses the neutral `primary` token, not emerald — emerald is already
          // spoken for by the "Más popular" ring on PRO, so a green ring wouldn't read as
          // "selected" on the one card that is selected by default.
          isPicked && 'border-primary ring-2 ring-primary/30 hover:translate-y-0',
        )}
      >
        {tier.popular && (
          <span className="absolute -top-3 left-5 rounded-full bg-emerald-400 px-2.5 py-1 text-[11px] font-bold text-emerald-950">
            {t('plan.popular')}
          </span>
        )}
        {isPicked && (
          // Icon only — `aria-checked` on the card already announces the state, and repeating
          // the "Seleccionado" label here would just duplicate the CTA below it.
          <span
            aria-hidden="true"
            className="absolute -top-3 right-4 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground"
          >
            <Check className="h-3.5 w-3.5" />
          </span>
        )}
        <div className={cn('grid h-10 w-10 place-items-center rounded-xl', ACCENT_BG[tier.accent], ACCENT[tier.accent])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-lg font-bold">{tierName}</div>
        <p className="min-h-[34px] text-sm text-muted-foreground">{t(`plan.tiers.${tier.key}.pitch`)}</p>

        {/* El precio y «/mes · IVA incluido» pueden partirse en dos renglones: en tarjetas angostas no
          caben juntos y el sufijo se salía del cuadro. El sufijo es UNA pieza (no se corta a la mitad). */}
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          {noDisponible ? (
            <span className="text-xl font-extrabold text-muted-foreground">{t('plan.notOnSale')}</span>
          ) : monthlyEquiv === null ? (
            <span className="text-xl font-extrabold">{t('plan.cta.contact')}</span>
          ) : monthlyEquiv === undefined ? null : (
            <>
              <span className="text-3xl font-extrabold tracking-tight">{fmt(monthlyEquiv)}</span>
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {t('plan.perMonth')}
                {monthlyEquiv > 0 && <> · {t('plan.plusIva')}</>}
              </span>
            </>
          )}
        </div>
        <div className="min-h-[16px] text-xs text-muted-foreground">
          {noDisponible ? (
            ''
          ) : tier.id === 'FREE' ? (
            t('plan.forever')
          ) : tier.priceMonthly === null || monthlyEquiv === undefined ? (
            ''
          ) : interval === 'annual' && precioAnual != null ? (
            <>
              <span>{t('plan.annualEquiv', { price: fmt(precioAnual) })}</span>
              {textoAnualPintado && <span> · {textoAnualPintado}</span>}
            </>
          ) : (
            t('plan.billedMonthly')
          )}
        </div>
        {promoNote && <div className="rounded-lg bg-emerald-400/10 px-2.5 py-1.5 text-xs font-medium text-emerald-500">{promoNote}</div>}

        <ul className="mt-1 flex flex-col gap-2.5">
          {tier.featureKeys.slice(0, PRINCIPALES_VISIBLES).map(fk => {
            const texto = textoDelBeneficio(fk)
            if (texto === null) return null
            return (
              <li key={fk} className="flex items-start gap-2 text-sm">
                <Check className={cn('mt-0.5 h-4 w-4 shrink-0', ACCENT[tier.accent])} />
                <span>
                  {texto}
                  {fk === 'chatbotBeta' && (
                    <Badge variant="outline" className="ml-1.5 h-4 px-1 text-[9px]">
                      Beta
                    </Badge>
                  )}
                </span>
              </li>
            )
          })}
        </ul>

        {/* Al fondo (`mt-auto`) para que quede a la misma altura en las cuatro tarjetas. Abre la lista
          completa SIN elegir el plan: la tarjeta es el radio, así que el clic no debe subir hasta ella. */}
        <div className="mt-auto flex flex-col gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-tour={`plan-see-all-${tier.id.toLowerCase()}`}
            className="-mx-2 w-fit cursor-pointer gap-1 px-2 text-sm font-semibold"
            onClick={e => {
              e.stopPropagation()
              setVerTodos(true)
            }}
          >
            {t('plan.benefits.seeAll', { count: totalDeBeneficios(tier), defaultValue: 'Ver todos ({{count}})' })}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>

          {/* Al ELEGIR (asistentes) la tarjeta entera es el radio, el ✓ marca la elegida y cada asistente
          tiene su propio «Continuar»: el botón «Elegir X / Seleccionado» sólo repetía eso. Se queda
          el de Enterprise, que es una ACCIÓN (escribir a ventas), no una selección. */}
          {isChoice && tier.checkout !== 'contact' ? null : (
            <div>
              {noDisponible ? (
                <Button disabled variant="outline" className="w-full">
                  {t('plan.notOnSale')}
                </Button>
              ) : isOwned ? (
                <Button disabled variant="ghost" className="w-full cursor-default text-muted-foreground">
                  {t('plan.cta.current')}
                </Button>
              ) : tier.checkout === 'coming_soon' ? (
                <Button disabled variant="outline" className="w-full gap-2">
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    {t('plan.comingSoon')}
                  </Badge>
                </Button>
              ) : tier.checkout === 'contact' ? (
                <Button variant="outline" tabIndex={ctaTabIndex} className="w-full cursor-pointer" onClick={ctaClick}>
                  {t('plan.cta.contact')}
                </Button>
              ) : isPicked ? (
                // Stays a real, live button — the bug the founder hit was this card rendering the
                // owned-plan CTA (disabled "Tu plan actual") on the tier the wizard pre-selects.
                <Button tabIndex={ctaTabIndex} className="w-full cursor-pointer gap-2" onClick={ctaClick}>
                  <Check className="h-4 w-4" />
                  {t('plan.cta.selected')}
                </Button>
              ) : (
                <Button
                  className="w-full cursor-pointer"
                  tabIndex={ctaTabIndex}
                  variant={tier.popular && !isDowngrade ? 'default' : 'outline'}
                  onClick={ctaClick}
                >
                  {isChoice
                    ? t('plan.cta.choose', { tier: tierName })
                    : t(`plan.cta.${isDowngrade ? 'downgrade' : 'upgrade'}`, { tier: tierName })}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Hermana de la tarjeta, no hija: los eventos de React cruzan los portales, y un clic dentro de
        la ventana subiría hasta la tarjeta y elegiría el plan sin querer. */}
      <PlanBenefitsDialog
        tier={tier}
        open={verTodos}
        onOpenChange={setVerTodos}
        accentClassName={ACCENT[tier.accent]}
        action={accionDeLaVentana}
        tierName={tierName}
      />
    </Fragment>
  )
}
