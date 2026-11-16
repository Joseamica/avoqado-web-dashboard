/** D1 · la casilla «Vender en: ☑ Rappi ☐ Uber Eats» del producto. El estado y `aplicar` viven en `useVenderEnCanales`. */
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { EstadoVenderEn } from './useVenderEnCanales'

export function VenderEnCanales({ estado, className }: { estado: EstadoVenderEn; className?: string }) {
  const { t } = useTranslation('delivery')
  if (!estado.visible) return null
  return (
    <section data-tour="product-vender-en" className={cn('space-y-3 rounded-lg border border-input p-4', className)}>
      <div className="space-y-0.5">
        <h3 className="text-base font-medium">{t('venderEn.titulo')}</h3>
        <p className="text-sm text-muted-foreground">{t('venderEn.ayuda')}</p>
      </div>
      {estado.canales.map(c => (
        <div key={c.id} className="space-y-1">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`vender-en-${c.id}`}
              className="cursor-pointer"
              checked={estado.marcados[c.id]}
              onCheckedChange={v => estado.setMarcado(c.id, v === true)}
            />
            <Label htmlFor={`vender-en-${c.id}`} className="cursor-pointer font-normal">
              {c.nombre}
            </Label>
          </div>
          {c.todoElCatalogo && !estado.marcados[c.id] && (
            <p className="pl-6 text-sm text-muted-foreground">{t('venderEn.avisoTodoElCatalogo', { canal: c.nombre })}</p>
          )}
        </div>
      ))}
    </section>
  )
}
