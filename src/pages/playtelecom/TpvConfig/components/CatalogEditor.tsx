/**
 * CatalogEditor - SIM buttons catalog with add/remove
 * Shows active SIM buttons and plans/recargas section
 */

import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CatalogItem {
  id: string
  name: string
  description?: string
  price: number
  color: string
  isActive: boolean
  sortOrder: number
}

interface CatalogEditorProps {
  categories: CatalogItem[]
  onAdd: () => void
  onRemove: (id: string) => void
  onReorder: (categories: Array<{ id: string; sortOrder: number }>) => void
}

export function CatalogEditor({ categories, onAdd, onRemove }: CatalogEditorProps) {
  const { t } = useTranslation('playtelecom')

  const activeItems = categories.filter(c => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
  const plans = categories.filter(c => !c.isActive)

  return (
    <GlassCard className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          {t('tpvConfig.catalog.title', { defaultValue: 'Catalogo de Venta' })}
        </h3>
        <Button variant="ghost" size="sm" onClick={onAdd} className="text-primary gap-1">
          <Plus className="w-4 h-4" />
          {t('tpvConfig.catalog.addProduct', { defaultValue: 'Agregar Nuevo Producto' })}
        </Button>
      </div>

      <div className="space-y-6">
        {/* Active SIM Buttons */}
        <div>
          <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3 border-b border-border/50 pb-2">
            {t('tpvConfig.catalog.activeButtons', { defaultValue: 'Botones de SIMs Activos' })}
          </h4>
          <div className="flex flex-wrap gap-3">
            {activeItems.map(item => (
              <div
                key={item.id}
                className="group relative border-2 border-border/50 hover:border-primary rounded-xl p-3 w-40 transition-all hover:shadow-md bg-card/50"
              >
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button
                    onClick={() => onRemove(item.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <GripVertical className="w-3 h-3 text-muted-foreground/50 cursor-grab" />
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center font-bold text-xs border"
                    style={{
                      backgroundColor: `${item.color}20`,
                      borderColor: `${item.color}40`,
                      color: item.color,
                    }}
                  >
                    {item.price}
                  </div>
                </div>
                <p className="font-semibold text-sm truncate">{item.name}</p>
                {item.description && (
                  <p className="text-[10px] text-muted-foreground truncate">{item.description}</p>
                )}
                <div className="mt-2 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-[9px] text-muted-foreground">
                    {t('tpvConfig.catalog.visible', { defaultValue: 'Visible' })}
                  </span>
                </div>
              </div>
            ))}

            {/* Add button placeholder */}
            <div
              className={cn(
                'border-2 border-dashed border-border/50 hover:border-muted-foreground',
                'rounded-xl p-3 w-40 flex flex-col items-center justify-center cursor-pointer transition-colors'
              )}
              onClick={onAdd}
            >
              <Plus className="w-6 h-6 text-muted-foreground mb-1" />
              <p className="text-xs font-semibold text-muted-foreground">
                {t('tpvConfig.catalog.addButton', { defaultValue: 'Anadir Boton' })}
              </p>
            </div>
          </div>
        </div>

        {/* Plans / Recargas */}
        {plans.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3 border-b border-border/50 pb-2">
              {t('tpvConfig.catalog.plans', { defaultValue: 'Planes / Recargas' })}
            </h4>
            <div className="flex flex-wrap gap-3">
              {plans.map(item => (
                <div
                  key={item.id}
                  className="border border-border/50 rounded-xl p-3 w-40 opacity-75 hover:opacity-100 transition-opacity bg-card/30"
                >
                  <p className="font-semibold text-sm">{item.name}</p>
                  {item.description && (
                    <p className="text-[10px] text-muted-foreground mt-1">{item.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  )
}
