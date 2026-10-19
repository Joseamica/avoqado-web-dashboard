import DataTable from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Familia } from '@/features/product-variants/families'
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { ChevronRight } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { FilaConFamilia } from '../stockFamilies'

// 🔴 `flexRender` pinta cada celda como componente: si `columns` cambiara al desplegar, React remontaría las celdas y el chevron
// perdería el foco del teclado. Por eso lo desplegado vive en `TablaConFamilias` y el chevron lo lee de aquí (patrón de la Tarea 9).
const Desplegadas = createContext<{ estaDesplegada: (groupId: string) => boolean; alternar: (groupId: string) => void; conFiltro: boolean }>({
  estaDesplegada: () => false,
  alternar: () => {},
  conFiltro: false,
})

// 🔴 Cada fila se identifica por SU id (`familia:<groupId>` en la de una familia), no por su posición: si un refetch quita una fila
// de arriba, React no le pasa el popover abierto (o el menú) de una fila a la que quedó en su lugar.
// Genérica: con `(fila: { id: string })` TS deducía `TData = { id: string }` y chocaba con las columnas.
const idDeFila = <T extends { id: string }>(fila: T) => fila.id

interface Props<R> {
  data: FilaConFamilia<R>[]
  columns: ColumnDef<FilaConFamilia<R>, unknown>[]
  /** Búsqueda o filtro activo: las familias que quedan salen desplegadas, con sólo las variantes que cumplen. */
  conFiltro: boolean
  isLoading?: boolean
  tableId?: string
  tableTabLeft?: ReactNode
  tableTab?: ReactNode
}

/**
 * La `DataTable` de existencias con cada familia desplegable: sus variantes se pintan con las MISMAS columnas, así que cada una
 * conserva su propio control de existencias. Sin familias pinta exactamente lo mismo que `DataTable` (nada se despliega).
 */
export function TablaConFamilias<R extends { id: string }>({ data, columns, conFiltro, isLoading, tableId, tableTabLeft, tableTab }: Props<R>) {
  // Las que el chevron cambió respecto al default: plegadas sin filtro, desplegadas con filtro. Entrar o salir del filtro las olvida.
  const [invertidas, setInvertidas] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    setInvertidas(prev => (prev.size ? new Set() : prev))
  }, [conFiltro])
  const estaDesplegada = useCallback((groupId: string) => invertidas.has(groupId) !== conFiltro, [invertidas, conFiltro])
  const alternar = useCallback((groupId: string) => {
    setInvertidas(prev => {
      const siguiente = new Set(prev)
      if (!siguiente.delete(groupId)) siguiente.add(groupId)
      return siguiente
    })
  }, [])
  const desplegadas = useMemo(() => ({ estaDesplegada, alternar, conFiltro }), [estaDesplegada, alternar, conFiltro])
  const variantesDesplegadas = useCallback(
    (fila: FilaConFamilia<R>) =>
      fila.__familia && estaDesplegada(fila.__familia.groupId) ? (
        <VariantesDeLaFamilia<R> variantes={fila.__familia.variantes} columns={columns} />
      ) : null,
    [estaDesplegada, columns],
  )

  return (
    <Desplegadas.Provider value={desplegadas}>
      <DataTable
        data={data}
        rowCount={data.length}
        columns={columns}
        isLoading={isLoading}
        enableSearch={false}
        showColumnCustomizer={false}
        tableId={tableId}
        tableTabLeft={tableTabLeft}
        tableTab={tableTab}
        renderSubComponent={variantesDesplegadas}
        getRowId={idDeFila}
      />
    </Desplegadas.Provider>
  )
}

/**
 * La celda «nombre» de la fila de una familia: chevron, nombre, «N variantes» y el rótulo de la suma. Con búsqueda o filtro la fila
 * sólo cuenta las variantes que cumplen, y el rótulo lo dice («Suma de las que coinciden»).
 */
export function NombreDeFamilia({ familia, children }: { familia: Familia<unknown>; children?: ReactNode }) {
  const { t } = useTranslation('inventory')
  const { estaDesplegada, alternar, conFiltro } = useContext(Desplegadas)
  const desplegada = estaDesplegada(familia.groupId)
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 cursor-pointer"
        aria-expanded={desplegada}
        aria-label={t('familias.ver', { name: familia.name })}
        data-tour="stock-family-expand"
        onClick={e => {
          e.stopPropagation()
          alternar(familia.groupId)
        }}
      >
        <ChevronRight className={`h-4 w-4 transition-transform ${desplegada ? 'rotate-90' : ''}`} />
      </Button>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{familia.name}</span>
          <Badge variant="secondary" className="text-xs">
            {t('familias.variantes', { count: familia.variantes.length })}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">{conFiltro ? t('familias.sumaFiltrada') : t('familias.suma')}</span>
        {children}
      </div>
    </div>
  )
}

function VariantesDeLaFamilia<R extends { id: string }>({
  variantes,
  columns,
}: {
  variantes: FilaConFamilia<R>[]
  columns: ColumnDef<FilaConFamilia<R>, unknown>[]
}) {
  const tabla = useReactTable({ data: variantes, columns, getCoreRowModel: getCoreRowModel(), getRowId: idDeFila })
  return (
    <div className="bg-muted/30 py-2 pl-12 pr-4" data-tour="stock-family-variants">
      <Table>
        <TableHeader>
          {tabla.getHeaderGroups().map(grupo => (
            <TableRow key={grupo.id}>
              {grupo.headers.map(h => (
                <TableHead key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {tabla.getRowModel().rows.map(fila => (
            <TableRow key={fila.id}>
              {fila.getVisibleCells().map(celda => (
                <TableCell key={celda.id}>{flexRender(celda.column.columnDef.cell, celda.getContext())}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
