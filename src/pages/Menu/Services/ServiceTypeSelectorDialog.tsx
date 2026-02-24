import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Calendar, Users } from 'lucide-react'
import { type ProductType } from '@/services/inventory.service'

interface ServiceTypeSelectorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (type: ProductType) => void
}

const SERVICE_OPTIONS: Array<{
  type: ProductType
  icon: typeof Calendar
  titleKey: string
  descKey: string
}> = [
  {
    type: 'APPOINTMENTS_SERVICE',
    icon: Calendar,
    titleKey: 'services.typeSelector.serviceTitle',
    descKey: 'services.typeSelector.serviceDesc',
  },
  {
    type: 'CLASS',
    icon: Users,
    titleKey: 'services.typeSelector.classTitle',
    descKey: 'services.typeSelector.classDesc',
  },
]

export function ServiceTypeSelectorDialog({ open, onOpenChange, onSelect }: ServiceTypeSelectorDialogProps) {
  const { t } = useTranslation('menu')
  const { t: tCommon } = useTranslation('common')
  const [selectedType, setSelectedType] = useState<ProductType | null>(null)

  useEffect(() => {
    if (open) {
      setSelectedType(null)
    }
  }, [open])

  const handleNext = () => {
    if (selectedType) {
      onSelect(selectedType)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('services.typeSelector.title')}</DialogTitle>
          <DialogDescription>{t('services.typeSelector.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {SERVICE_OPTIONS.map(({ type, icon: Icon, titleKey, descKey }) => {
            const isSelected = selectedType === type
            return (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType(type)}
                className={cn(
                  'w-full text-left p-3 rounded-lg border transition-all',
                  'hover:bg-muted/50',
                  isSelected
                    ? 'border-foreground bg-muted/50 shadow-sm'
                    : 'border-border hover:border-muted-foreground/30',
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'p-2 rounded-lg shrink-0',
                      isSelected ? 'bg-foreground text-background' : 'bg-muted',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm">{t(titleKey)}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{t(descKey)}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button onClick={handleNext} disabled={!selectedType}>
            {tCommon('next')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
