import { Layers } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { VenueTierBadge } from '@/components/venue-tier-badge'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'

export interface EntradaDeVariantes {
  key: string
  label: string
  onSelect: () => void
  requierePlan?: boolean
  disabled?: boolean
}

/** Botón «Variantes» del encabezado de Productos. Las entradas con `requierePlan` se apagan con la etiqueta PRO fuera de Pro/Premium. */
export function VariantsMenu({ items }: { items: EntradaDeVariantes[] }) {
  const { t } = useTranslation('variants')
  const acceso = useTierFeatureAccess('PRODUCT_VARIANTS')
  const conPlan = acceso.hasAccess && acceso.isResolved
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" data-tour="products-variants-menu">
          <Layers className="mr-2 h-4 w-4" />
          {t('lista.menu')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map(i => (
          <DropdownMenuItem
            key={i.key}
            disabled={i.disabled || (i.requierePlan && !conPlan)}
            onSelect={i.onSelect}
            className="gap-2"
            data-tour={`products-variants-${i.key}`}
          >
            {i.label}
            {i.requierePlan && !conPlan && <VenueTierBadge tier="PRO" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
