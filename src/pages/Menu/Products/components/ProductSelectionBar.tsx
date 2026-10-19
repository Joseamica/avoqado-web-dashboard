import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { MAX_VARIANTES } from '@/features/product-variants/combinations'

/** Barra fija abajo mientras el dueño elige productos para convertirlos en variantes de uno nuevo. */
export function ProductSelectionBar({ count, onAgrupar, onCancelar }: { count: number; onAgrupar: () => void; onCancelar: () => void }) {
  const { t } = useTranslation('variants')
  const demasiados = count > MAX_VARIANTES
  return (
    <div
      data-tour="products-group-bar"
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-input bg-background px-4 py-2 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      <span className="whitespace-nowrap text-sm font-medium">{t('agrupar.elegidos', { count })}</span>
      {demasiados && <span className="text-xs text-destructive">{t('agrupar.problema.demasiadosMiembros')}</span>}
      <Button
        size="sm"
        className="rounded-full"
        disabled={count === 0 || demasiados}
        onClick={onAgrupar}
        data-tour="products-group-confirm"
      >
        {t('agrupar.agruparComo')}
      </Button>
      <Button size="sm" variant="ghost" className="rounded-full" onClick={onCancelar} data-tour="products-group-cancel">
        {t('agrupar.cancelar')}
      </Button>
    </div>
  )
}
