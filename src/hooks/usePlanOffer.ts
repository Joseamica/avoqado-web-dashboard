import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { planOfferService, type PlanDeLaOferta } from '@/services/planOffer.service'

export type { PlanDeLaOferta }

export type OfertaDePlanes =
  | { estado: 'servidor'; offerVersion: number | null; FREE: { displayName: string }; PRO: PlanDeLaOferta; PREMIUM: PlanDeLaOferta }
  /** Cargando, o cualquier respuesta que no es 200 (404 incluido): no hay montos que enseñar, nunca los de hoy en su lugar (r3 #1). */
  | { estado: 'cargando' | 'sinDato' }

export function usePlanOffer(): OfertaDePlanes {
  const { data, isPending } = useQuery({
    queryKey: ['plan-offer'],
    queryFn: () => planOfferService.get(),
    staleTime: 60_000,
    retry: 1,
  })
  if (data) return { estado: 'servidor', ...data }
  return { estado: isPending ? 'cargando' : 'sinDato' }
}

type TierDeNombre = 'FREE' | 'PRO' | 'PREMIUM' | 'ENTERPRISE'

/** Con offerVersion null (o sin datos): el nombre localizado de hoy; con una del editor (≥ 2), su displayName. Un nombre no es dinero. */
export function nombreDelPlanDe(oferta: OfertaDePlanes, tier: TierDeNombre, t: (key: string) => string): string {
  if (tier !== 'ENTERPRISE' && oferta.estado === 'servidor' && oferta.offerVersion !== null && oferta.offerVersion >= 2)
    return oferta[tier].displayName
  return t(`plan.tiers.${tier.toLowerCase()}.name`)
}

export function useNombreDelPlan(tier: TierDeNombre): string {
  const { t } = useTranslation('billing')
  return nombreDelPlanDe(usePlanOffer(), tier, t)
}

/** Para listas y mapas: UNA lectura de la oferta y una función que da el nombre de cualquier plan (un hook no va dentro de un `map`). */
export function useNombresDelPlan(): (tier: TierDeNombre | string) => string {
  const { t } = useTranslation('billing')
  const oferta = usePlanOffer()
  return tier => nombreDelPlanDe(oferta, tier.toUpperCase() as TierDeNombre, t)
}
