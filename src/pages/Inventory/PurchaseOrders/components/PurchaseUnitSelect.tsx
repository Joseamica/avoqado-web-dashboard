import { useQuery } from '@tanstack/react-query'

import { getRawMaterialPresentations } from '@/services/inventory.service'
import { cn } from '@/lib/utils'

interface Props {
  venueId: string
  rawMaterialId?: string
  /** Etiqueta corta de la unidad base ("kg", "pz") — la opción por defecto. */
  baseUnitLabel: string
  /** Nombre de la presentación elegida; `undefined` = comprar en unidad base. */
  value?: string
  onChange: (presentationName: string | undefined) => void
  disabled?: boolean
}

/**
 * Selector de la unidad EN QUE SE COMPRA un insumo ("compro en caja, el
 * inventario se lleva en piezas").
 *
 * Si el insumo no tiene presentaciones configuradas, se degrada a la etiqueta
 * estática de siempre — así una orden de compra normal se ve y se comporta
 * exactamente igual que antes de que esto existiera.
 */
export function PurchaseUnitSelect({ venueId, rawMaterialId, baseUnitLabel, value, onChange, disabled }: Props) {
  const { data: presentations } = useQuery({
    queryKey: ['raw-material-presentations', venueId, rawMaterialId],
    queryFn: () => getRawMaterialPresentations(venueId, rawMaterialId as string),
    enabled: Boolean(venueId && rawMaterialId),
    staleTime: 5 * 60 * 1000,
  })

  // Sin presentaciones → el sufijo de unidad de toda la vida.
  if (!presentations || presentations.length === 0) {
    return baseUnitLabel ? (
      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs font-medium text-muted-foreground">
        {baseUnitLabel}
      </span>
    ) : null
  }

  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? undefined : e.target.value)}
      disabled={disabled}
      aria-label="Unidad de compra"
      data-tour="po-item-purchase-unit"
      className={cn(
        'absolute inset-y-1 right-1 max-w-[6.5rem] cursor-pointer rounded-md border-0 bg-muted px-1.5 text-xs font-medium',
        'text-foreground outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      <option value="">{baseUnitLabel}</option>
      {presentations.map(p => (
        <option key={p.name} value={p.name}>
          {p.name}
        </option>
      ))}
    </select>
  )
}
