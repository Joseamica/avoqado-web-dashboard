import { Pencil } from 'lucide-react'
import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { InventoryBadge } from '@/components/inventory/InventoryBadge'
import { valoresDeVariante, type Familia } from '@/features/product-variants/families'
import type { Product } from '@/types'
import { Currency } from '@/utils/currency'

interface Props {
  familia: Familia<Product>
  onToggleActive: (variante: Product, activa: boolean) => void
  onVerExistencias: (variante: Product) => void
  onOpen: () => void
}

/** Las variantes de una familia desplegada en la lista de Productos: tocar cualquier renglón (o «Editar») abre la familia. */
export function FamilyVariantRows({ familia, onToggleActive, onVerExistencias, onOpen }: Props) {
  const { t } = useTranslation('variants')
  const detener = (e: MouseEvent) => e.stopPropagation()

  return (
    <div className="bg-muted/30 px-4 py-2 pl-14" data-tour="products-family-variants">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('variantesTabla.variante')}</TableHead>
            <TableHead>{t('variantesTabla.skuCol')}</TableHead>
            <TableHead>{t('variantesTabla.precioCol')}</TableHead>
            <TableHead>{t('variantesTabla.existenciasCol')}</TableHead>
            <TableHead>{t('variantesTabla.activaCol')}</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">{t('common:actions')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {familia.variantes.map(v => (
            <TableRow key={v.id} className="cursor-pointer hover:bg-muted/50" onClick={onOpen}>
              <TableCell className="font-medium">{valoresDeVariante(v) || v.name}</TableCell>
              <TableCell className="text-muted-foreground">{v.sku || '—'}</TableCell>
              <TableCell>{Currency(Number(v.price))}</TableCell>
              <TableCell onClick={detener}>
                <InventoryBadge product={v} onClick={() => onVerExistencias(v)} />
              </TableCell>
              <TableCell onClick={detener}>
                <Switch
                  data-tour="products-family-variant-active"
                  checked={v.active}
                  aria-label={t('variantesTabla.activa', { name: v.name })}
                  onCheckedChange={checked => onToggleActive(v, checked)}
                />
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 cursor-pointer"
                  data-tour="products-family-variant-edit"
                  aria-label={t('lista.editarVariante', { name: v.name })}
                  onClick={e => {
                    e.stopPropagation()
                    onOpen()
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
