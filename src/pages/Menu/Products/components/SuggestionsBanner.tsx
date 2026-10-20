import { Layers, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useGroupSuggestions } from '@/features/product-variants/hooks'
import { useAccess } from '@/hooks/use-access'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { cn } from '@/lib/utils'

interface Props {
  venueId: string
  /** Abre «Agrupar productos que ya tengo» en Sugerencias. */
  onRevisar: () => void
  className?: string
}

const llave = (venueId: string) => `variants:sugerencias-cerradas:${venueId}`
/** El navegador puede negar el almacenamiento (ventana privada, datos bloqueados): entonces el aviso sólo se cierra en la sesión. */
const estabaCerrado = (venueId: string) => {
  try {
    return localStorage.getItem(llave(venueId)) === '1'
  } catch {
    return false
  }
}

/** «Encontramos N grupos de productos que parecen variantes»: sólo con plan, permiso de editar y al menos una sugerencia. */
export function SuggestionsBanner({ venueId, onRevisar, className }: Props) {
  const { t } = useTranslation('variants')
  const acceso = useTierFeatureAccess('PRODUCT_VARIANTS')
  const puedeAgrupar = useAccess().can('menu:update')
  const [cerradosAhora, setCerradosAhora] = useState<ReadonlySet<string>>(() => new Set())
  const cerrado = cerradosAhora.has(venueId) || estabaCerrado(venueId)
  const conPlan = acceso.hasAccess && acceso.isResolved

  // Sin plan o sin permiso (o ya cerrado) la consulta ni corre; el total sale de la primera página.
  const sugerencias = useGroupSuggestions(venueId, conPlan && puedeAgrupar && !cerrado)
  const total = sugerencias.data?.pages[0]?.total ?? 0
  if (!conPlan || !puedeAgrupar || cerrado || total === 0) return null

  const cerrar = () => {
    setCerradosAhora(prev => new Set(prev).add(venueId))
    try {
      localStorage.setItem(llave(venueId), '1')
    } catch {
      /* sin almacenamiento: queda cerrado hasta recargar */
    }
  }

  return (
    <div className={cn('flex items-center gap-3 rounded-xl border border-input bg-muted p-3', className)} data-tour="products-suggestions-banner">
      <Layers className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      <p className="min-w-0 flex-1 text-sm">{t('fuentes.aviso', { count: total })}</p>
      <Button size="sm" variant="outline" className="cursor-pointer" onClick={onRevisar} data-tour="products-suggestions-review">
        {t('fuentes.avisoRevisar')}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 shrink-0 cursor-pointer"
        aria-label={t('fuentes.avisoCerrar')}
        onClick={cerrar}
        data-tour="products-suggestions-dismiss"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
