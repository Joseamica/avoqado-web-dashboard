import { Layers } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { Product } from '@/types'

/** Aviso de las pantallas que editan UN producto por id (ficha, asistente): si es una variante, los datos del padre se cambian en la familia. */
export function VariantNotice({
  product,
  onOpenFamily,
}: {
  product: Pick<Product, 'name' | 'productGroupId' | 'productGroupName'>
  onOpenFamily?: () => void
}) {
  const { t } = useTranslation('variants')
  if (!product.productGroupId) return null
  const familia = product.productGroupName ?? ''
  return (
    <div
      role="note"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-input bg-muted p-4 text-sm"
      data-tour="product-variant-notice"
    >
      <Layers className="h-4 w-4 shrink-0" aria-hidden />
      <p className="flex-1">{t('variante.aviso', { name: product.name, familia })}</p>
      {onOpenFamily && (
        // type="button": el aviso vive dentro de <form> (ficha y asistente); sin él, «Abrir» enviaría el formulario.
        <Button type="button" size="sm" variant="outline" onClick={onOpenFamily} data-tour="product-variant-open-family">
          {t('variante.abrir', { familia })}
        </Button>
      )}
    </div>
  )
}
