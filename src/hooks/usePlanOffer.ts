import { useQuery } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { planOfferService, type PlanDeLaOferta } from '@/services/planOffer.service'

export type { PlanDeLaOferta }

export type OfertaDePlanes =
  | { estado: 'servidor'; offerVersion: number | null; FREE: { displayName: string }; PRO: PlanDeLaOferta; PREMIUM: PlanDeLaOferta }
  /** Cargando, o cualquier respuesta que no es 200 (404 incluido): no hay montos que enseñar, nunca los de hoy en su lugar (r3 #1). */
  | { estado: 'cargando' | 'sinDato' }

export function usePlanOffer(opciones?: { enabled?: boolean }): OfertaDePlanes {
  const { data, isPending, isError } = useQuery({
    queryKey: ['plan-offer'],
    queryFn: () => planOfferService.get(),
    staleTime: 60_000,
    retry: 1,
    enabled: opciones?.enabled ?? true,
  })
  // Una lectura que falla (también un refetch con `data` viejo) es «sin dato»: nunca montos de una lectura anterior.
  if (isError) return { estado: 'sinDato' }
  if (data) return { estado: 'servidor', ...data }
  return { estado: isPending ? 'cargando' : 'sinDato' }
}

type TierDeNombre = 'FREE' | 'PRO' | 'PREMIUM' | 'ENTERPRISE'

/** Con offerVersion null (o sin datos): el nombre localizado de hoy; con una del editor (≥ 2), su displayName. Un nombre no es dinero. */
export function nombreDelPlanDe(oferta: OfertaDePlanes, tier: TierDeNombre, t: (key: string) => string): string {
  // Un nivel que la oferta no trae (ENTERPRISE, o uno desconocido como 'GRATIS') cae al nombre localizado: nunca truena.
  if (
    (tier === 'FREE' || tier === 'PRO' || tier === 'PREMIUM') &&
    oferta.estado === 'servidor' &&
    oferta.offerVersion !== null &&
    oferta.offerVersion >= 2
  )
    return oferta[tier]?.displayName ?? t(`plan.tiers.${tier.toLowerCase()}.name`)
  return t(`plan.tiers.${tier.toLowerCase()}.name`)
}

export function nombreDeGratisEnBeneficios(oferta: OfertaDePlanes, t: TFunction, idioma?: string): string {
  // Los textos de herencia en francés usaban «Free» antes del editor.
  return nombreDelPlanDe(oferta, 'FREE', idioma === 'fr' ? key => t(key, { lng: 'en' }) : t)
}

export function useNombreDelPlan(tier: TierDeNombre, opciones?: { enabled?: boolean }): string {
  const { t } = useTranslation('billing')
  return nombreDelPlanDe(usePlanOffer(opciones), tier, t)
}

/** Para listas y mapas: UNA lectura de la oferta y una función que da el nombre de cualquier plan (un hook no va dentro de un `map`). */
export function useNombresDelPlan(cotizacion?: CotizadoParaNombres): (tier: TierDeNombre | string) => string {
  const { t } = useTranslation('billing')
  const oferta = usePlanOffer()
  return tier => nombreConCotizacion(oferta, tier, t, cotizacion)
}

/** Lo único que se lee de la cotización firmada de GET `/plan`: el nombre de cada plan de esa versión. */
export type CotizadoParaNombres = { planes?: Partial<Record<'PRO' | 'PREMIUM', { displayName: string } | undefined>> } | undefined

/** Con una cotización firmada, el nombre sale de ELLA (el mismo que el precio que se cobra); si no, de la oferta vigente. */
export function nombreConCotizacion(
  oferta: OfertaDePlanes,
  tier: string,
  t: (key: string) => string,
  cotizacion?: CotizadoParaNombres,
): string {
  const nivel = tier.toUpperCase()
  const cotizado = nivel === 'PRO' || nivel === 'PREMIUM' ? cotizacion?.planes?.[nivel]?.displayName : undefined
  return cotizado ?? nombreDelPlanDe(oferta, nivel as TierDeNombre, t)
}
