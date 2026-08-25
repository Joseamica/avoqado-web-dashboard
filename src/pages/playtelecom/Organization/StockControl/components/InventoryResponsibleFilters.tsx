import { useTranslation } from 'react-i18next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { InventoryFilters } from '@/services/stockDashboard.service'

/**
 * Filtros de la tabla por responsable: sucursal receptora y tipo de artículo.
 *
 * Se usan selectores simples y no los FilterPill multi-selección del resto de
 * las tablas: aquí se elige UNA sucursal, no varias, y un multi-select para
 * escoger una sola opción confunde más de lo que ayuda.
 *
 * 🔴 "Todas" nunca se quita de la lista. Con el filtro puesto el supervisor ve
 * sólo una parte del inventario, y necesita poder volver al total para cuadrar
 * el conteo físico contra lo que el promotor trae en la mano.
 */
const ALL = '__all__'

interface Props {
  filters?: InventoryFilters
  receivingVenueId: string | null
  categoryId: string | null
  onReceivingVenueChange: (value: string | null) => void
  onCategoryChange: (value: string | null) => void
  disabled?: boolean
}

export function InventoryResponsibleFilters({
  filters,
  receivingVenueId,
  categoryId,
  onReceivingVenueChange,
  onCategoryChange,
  disabled,
}: Props) {
  const { t } = useTranslation('playtelecom')
  const base = 'stock.byResponsible.filters'

  const receivingVenues = filters?.receivingVenues ?? []
  const categories = filters?.categories ?? []

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="w-full sm:w-72">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="filter-receiving-venue">
          {t(`${base}.receivingVenue`)}
        </label>
        <Select
          value={receivingVenueId ?? ALL}
          onValueChange={v => onReceivingVenueChange(v === ALL ? null : v)}
          disabled={disabled || receivingVenues.length === 0}
        >
          <SelectTrigger id="filter-receiving-venue" className="h-10">
            <SelectValue placeholder={t(`${base}.all`)} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t(`${base}.all`)}</SelectItem>
            {receivingVenues.map(v => (
              <SelectItem key={v.id} value={v.id}>
                {v.name} ({v.itemCount.toLocaleString('es-MX')})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-full sm:w-64">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="filter-category">
          {t(`${base}.simType`)}
        </label>
        <Select
          value={categoryId ?? ALL}
          onValueChange={v => onCategoryChange(v === ALL ? null : v)}
          disabled={disabled || categories.length === 0}
        >
          <SelectTrigger id="filter-category" className="h-10">
            <SelectValue placeholder={t(`${base}.allTypes`)} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t(`${base}.allTypes`)}</SelectItem>
            {categories.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} ({c.itemCount.toLocaleString('es-MX')})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Que el usuario sepa si está viendo todo o una parte: sin esta línea, un
          filtro preseleccionado hace parecer que faltan SIMs. */}
      <p className="pb-2.5 text-xs text-muted-foreground">{receivingVenueId ? t(`${base}.filtered`) : t(`${base}.showingAll`)}</p>
    </div>
  )
}
