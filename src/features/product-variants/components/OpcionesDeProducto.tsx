import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { SelectGroup, SelectLabel } from '@/components/ui/select'
import { agruparPorFamilia, type Familia, type ProductoConFamilia } from '../families'

interface Props<P> {
  productos: P[]
  /** Un <SelectItem> por producto (con su `key`). */
  item: (p: P) => ReactNode
  /** Lo que va al inicio de cada familia, antes de sus variantes (p. ej. «Toda la familia»). */
  inicioDeFamilia?: (f: Familia<P>) => ReactNode
}

/**
 * Contenido de un <Select> de UN producto. Sin familias es la lista plana de siempre (mismo orden, sin encabezados). Con familias,
 * primero los sueltos bajo «Productos» y luego cada familia como grupo: así un suelto nunca parece de la familia de arriba.
 */
export function OpcionesDeProducto<P extends ProductoConFamilia>({ productos, item, inicioDeFamilia }: Props<P>) {
  const { t } = useTranslation('variants')
  const renglones = useMemo(() => agruparPorFamilia(productos), [productos])
  const sueltos = renglones.flatMap(r => (r.tipo === 'producto' ? [r.producto] : []))
  const familias = renglones.flatMap(r => (r.tipo === 'familia' ? [r.familia] : []))
  if (familias.length === 0) return <>{sueltos.map(item)}</>
  return (
    <>
      {sueltos.length > 0 && (
        <SelectGroup>
          <SelectLabel>{t('selector.sueltos')}</SelectLabel>
          {sueltos.map(item)}
        </SelectGroup>
      )}
      {familias.map(f => (
        <SelectGroup key={f.groupId}>
          <SelectLabel>{f.name}</SelectLabel>
          {inicioDeFamilia?.(f)}
          {f.variantes.map(item)}
        </SelectGroup>
      ))}
    </>
  )
}
