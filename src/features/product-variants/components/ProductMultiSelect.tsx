import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import MultipleSelector, { type Option } from '@/components/multi-selector'
import { agruparPorFamilia, expandirSeleccion, familiasDe, valorDeFamilia, type ProductoConFamilia } from '../families'

interface Props {
  productos: ProductoConFamilia[]
  value: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
  emptyIndicator?: ReactNode
  footer?: ReactNode
  disabled?: boolean
}

/**
 * Selector múltiple de productos. Sin familias es el MultipleSelector de siempre (mismas opciones, mismo orden, sin grupos); con
 * familias, cada una es un grupo que empieza con «Toda la familia «X» (N)». Lo guardado siempre son ids de variante.
 */
export function ProductMultiSelect({ productos, value, onChange, ...rest }: Props) {
  const { t } = useTranslation('variants')
  const hayFamilias = useMemo(() => familiasDe(productos).length > 0, [productos])
  const options = useMemo<Option[]>(() => {
    if (!hayFamilias) return productos.map(p => ({ value: p.id, label: p.name }))
    const sueltos = t('selector.sueltos')
    const elegidos = new Set(value)
    return agruparPorFamilia(productos).flatMap(r =>
      r.tipo === 'producto'
        ? [{ value: r.producto.id, label: r.producto.name, grupo: sueltos }]
        : [
            // Si ya están todas elegidas, «toda la familia» no haría nada: no se ofrece.
            ...(r.familia.variantes.every(v => elegidos.has(v.id))
              ? []
              : [
                  {
                    value: valorDeFamilia(r.familia.groupId),
                    label: t('selector.todaLaFamilia', { name: r.familia.name, count: r.familia.variantes.length }),
                    grupo: r.familia.name,
                  },
                ]),
            ...r.familia.variantes.map(v => ({ value: v.id, label: v.name, grupo: r.familia.name })),
          ],
    )
  }, [productos, hayFamilias, value, t])
  const seleccion = useMemo<Option[]>(
    () => value.map(id => options.find(o => o.value === id) ?? { value: id, label: id }),
    [value, options],
  )
  return (
    <MultipleSelector
      {...rest}
      options={options}
      value={seleccion}
      groupBy={hayFamilias ? 'grupo' : undefined}
      onChange={opts =>
        onChange(
          expandirSeleccion(
            opts.map(o => o.value),
            productos,
          ),
        )
      }
    />
  )
}
