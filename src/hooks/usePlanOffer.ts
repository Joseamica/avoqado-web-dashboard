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

/** Con offerVersion null (o sin datos): el nombre localizado de hoy; con una del editor (≥ 2), su displayName. Un nombre no es dinero. */
export function useNombreDelPlan(tier: 'FREE' | 'PRO' | 'PREMIUM'): string {
  const { t } = useTranslation('billing')
  const oferta = usePlanOffer()
  if (oferta.estado === 'servidor' && oferta.offerVersion !== null && oferta.offerVersion >= 2) return oferta[tier].displayName
  return t(`plan.tiers.${tier.toLowerCase()}.name`)
}
