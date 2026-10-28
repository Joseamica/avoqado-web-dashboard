import { Check } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { salesWhatsAppLink } from '@/config/plan-catalog'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

import type { LaunchOfferView, PlanQuote } from '../../launchOffer.types'
import { formatMXN } from '../../offer/formatMXN'
import { textoDePrecio } from '../../offer/textoDePrecio'

type Plan = 'PRO' | 'PREMIUM' | 'ENTERPRISE'

/** Qué viñetas llevan Pro y Premium según el giro. 'restaurante' = las de siempre (`plans.benefits.pro.*`). */
export type JuegoDeBeneficios = 'restaurante' | 'comercio' | 'servicios' | 'generico'

// Nombres de marca: son iguales en español e inglés (como `billing.plan.tiers.*.name`).
const NOMBRE: Record<Plan, string> = { PRO: 'Pro', PREMIUM: 'Premium', ENTERPRISE: 'Enterprise' }
const ORDEN: Plan[] = ['PRO', 'PREMIUM', 'ENTERPRISE']

// Mismo texto que usaba `PlanStep` al tocar Enterprise: la conversación de ventas es en español.
const TEXTO_ENTERPRISE = 'Hola, me interesa el plan Enterprise de Avoqado para mi negocio.'

interface TarjetaProps {
  plan: Plan
  etiqueta?: string
  destacada: boolean
  precio: ReactNode
  puntos: string[]
  boton: string
  bloqueado: boolean
  onClick: () => void
}

function Tarjeta({ plan, etiqueta, destacada, precio, puntos, boton, bloqueado, onClick }: TarjetaProps) {
  const { t } = useTranslation('setup')
  const idTitulo = useId()
  const clave = plan.toLowerCase()

  return (
    <article
      data-plan={plan}
      aria-labelledby={idTitulo}
      className={cn(
        'flex flex-col gap-4 rounded-xl bg-card p-6 text-card-foreground',
        destacada ? 'border-2 border-primary shadow-md' : 'border border-border',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={idTitulo} className="text-xl font-semibold">
          {NOMBRE[plan]}
        </h2>
        {etiqueta && <Badge>{etiqueta}</Badge>}
      </div>
      <p className="text-sm text-muted-foreground">{t(`plans.${clave}Tagline`)}</p>
      <div className="flex flex-col gap-1">{precio}</div>
      <ul className="flex flex-1 flex-col gap-2 text-sm">
        {puntos.map((texto, i) => (
          <li key={i} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{texto}</span>
          </li>
        ))}
      </ul>
      <Button variant={destacada ? 'default' : 'outline'} disabled={bloqueado} onClick={onClick}>
        {boton}
      </Button>
    </article>
  )
}

interface TarjetasDePlanesProps {
  /** Campaña disponible del anuncio; sin ella, las tarjetas van en modo estándar (prueba de 30 días). */
  oferta: LaunchOfferView | null
  planQuote: PlanQuote | null | undefined
  /** Hay un cobro sin cerrar: ningún botón elige plan ni abre ventas. */
  bloqueado: boolean
  onElegir: (tier: 'PRO' | 'PREMIUM') => void
  /** Viñetas de Pro y Premium según el giro; las de la campaña (`oferta.copy.bullets`) siguen ganando. */
  beneficios: JuegoDeBeneficios
}

/**
 * Las 3 tarjetas del paso de planes del alta (Pro, Premium y Enterprise).
 *
 * 🔴 Sólo formatea centavos que ya vienen del servidor (`formatMXN` / `textoDePrecio`): no suma ni
 * deriva ningún monto. Si falta la cotización, la línea «Luego …» no se pinta en vez de inventarse.
 */
export function TarjetasDePlanes({ oferta, planQuote, bloqueado, onElegir, beneficios }: TarjetasDePlanesProps) {
  const { t } = useTranslation('setup')
  const esCelular = useIsMobile()
  const prefijoDeBeneficios = beneficios === 'restaurante' ? 'plans.benefits' : `plans.benefits.${beneficios}`

  // La tarjeta de la campaña (Pro o Premium) lleva la oferta y el botón fuerte; sin campaña es Pro.
  const planDestacado: Plan = oferta?.planTier ?? 'PRO'
  // En celular van apiladas: la de la campaña primero. En computadora el orden no cambia.
  const orden = esCelular && oferta ? [oferta.planTier, ...ORDEN.filter(p => p !== oferta.planTier)] : ORDEN

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {orden.map(plan => {
        const destacada = plan === planDestacado

        if (plan === 'ENTERPRISE') {
          return (
            <Tarjeta
              key={plan}
              plan={plan}
              destacada={false}
              precio={
                <>
                  <p className="text-2xl font-semibold">{t('plans.enterprisePrice')}</p>
                  <p className="text-sm text-muted-foreground">{t('plans.enterpriseSub')}</p>
                </>
              }
              puntos={[1, 2, 3, 4].map(n => t(`plans.benefits.enterprise.${n}`))}
              boton={t('plans.talkToSales')}
              bloqueado={bloqueado}
              onClick={() => window.open(salesWhatsAppLink(TEXTO_ENTERPRISE), '_blank', 'noopener,noreferrer')}
            />
          )
        }

        const clave = plan.toLowerCase()
        const esLaOferta = oferta?.planTier === plan
        const tier = planQuote?.tiers?.[plan]

        return (
          <Tarjeta
            key={plan}
            plan={plan}
            etiqueta={esLaOferta ? t('plans.yourOffer') : !oferta && plan === 'PRO' ? t('plans.recommended') : undefined}
            destacada={destacada}
            precio={
              esLaOferta ? (
                <>
                  <p className="text-2xl font-semibold">
                    {t('plans.offerPrice', { price: formatMXN(oferta.promo.monthlyCents), count: oferta.promo.months })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('plans.offerRenewal', { price: textoDePrecio(t, oferta.renewal.monthlyCents, oferta.renewal.subtotalCents) })}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-semibold">
                    {t('plans.trialPrice')}
                    {oferta && <span className="text-sm font-normal text-muted-foreground"> · {t('plans.withoutOffer')}</span>}
                  </p>
                  {tier && (
                    <p className="text-sm text-muted-foreground">
                      {t('plans.thenPerMonth', { price: textoDePrecio(t, tier.monthlyCents, tier.monthlyNetCents) })}
                    </p>
                  )}
                </>
              )
            }
            puntos={
              esLaOferta && oferta.copy.bullets.length > 0
                ? oferta.copy.bullets
                : [1, 2, 3, 4].map(n => t(`${prefijoDeBeneficios}.${clave}.${n}`))
            }
            boton={
              esLaOferta
                ? t('plans.chooseOffer', { plan: oferta.planName, price: formatMXN(oferta.promo.monthlyCents) })
                : t(plan === 'PRO' ? 'plans.choosePro' : 'plans.choosePremium')
            }
            bloqueado={bloqueado}
            onClick={() => onElegir(plan)}
          />
        )
      })}
    </div>
  )
}
