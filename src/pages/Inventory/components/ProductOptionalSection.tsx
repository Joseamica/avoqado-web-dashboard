import type { ElementType, ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

interface Props {
  id: string
  title: string
  description: string
  icon: ElementType
  open: boolean
  onOpen: () => void
  disabledReason?: string
  tierBadge?: ReactNode
  onRemove?: () => void
  children: ReactNode
}

/** Sólo presentación: el asistente conserva los valores y decide qué significa quitar. */
export function ProductOptionalSection({ id, title, description, icon: Icon, open, onOpen, disabledReason, tierBadge, onRemove, children }: Props) {
  const { t } = useTranslation('inventory')
  return (
    <section data-tour={`product-wizard-optional-${id}`} className="min-w-0 scroll-mt-20 rounded-2xl border border-input bg-card">
      <div className="flex min-w-0 items-start gap-2 p-3 sm:p-4">
        {open ? (
          <div className="flex min-w-0 flex-1 items-start gap-3 py-2">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0"><h2 className="flex flex-wrap items-center gap-2 font-semibold">{title}{tierBadge}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>
          </div>
        ) : (
          <button type="button" data-tour={`product-wizard-add-${id}`} aria-expanded={false}
            aria-controls={`product-wizard-content-${id}`} disabled={!!disabledReason} onClick={onOpen}
            className="flex min-h-12 w-full min-w-0 cursor-pointer items-start gap-3 rounded-lg p-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed">
            <Plus className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0"><span className="flex flex-wrap items-center gap-2 font-medium">{title}{tierBadge}</span><span className="mt-1 block text-sm text-muted-foreground">{disabledReason || description}</span></span>
          </button>
        )}
        {open && onRemove && <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 cursor-pointer" aria-label={t('wizard.optional.remove')} onClick={onRemove}><X className="h-5 w-5" /></Button>}
      </div>
      {open && <div id={`product-wizard-content-${id}`} className="min-w-0 space-y-4 border-t border-input p-3 sm:p-5">{children}</div>}
    </section>
  )
}
