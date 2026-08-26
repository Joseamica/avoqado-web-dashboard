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
 *
 * 🔴 Textos en español fijo, NO con `t()`, por decisión del founder (2026-08-25):
 * el resto de esta pantalla está hardcodeado en español y traducir sólo esta
 * parte dejaba la pantalla bilingüe. Ver el comentario largo en
 * `InventoryByResponsibleTable.tsx`.
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
  const receivingVenues = filters?.receivingVenues ?? []
  const categories = filters?.categories ?? []

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="w-full sm:w-72">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="filter-receiving-venue">
          Sucursal receptora
        </label>
        <Select
          value={receivingVenueId ?? ALL}
          onValueChange={v => onReceivingVenueChange(v === ALL ? null : v)}
          disabled={disabled || receivingVenues.length === 0}
        >
          <SelectTrigger id="filter-receiving-venue" className="h-10">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
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
          Tipo de SIM
        </label>
        <Select
          value={categoryId ?? ALL}
          onValueChange={v => onCategoryChange(v === ALL ? null : v)}
          disabled={disabled || categories.length === 0}
        >
          <SelectTrigger id="filter-category" className="h-10">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
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
      <p className="pb-2.5 text-xs text-muted-foreground">
        {receivingVenueId ? 'Filtrado por sucursal receptora' : 'Mostrando todo el inventario en mano'}
      </p>
    </div>
  )
}
