import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { productTypesApi, type ProductType, type ProductTypeConfig } from '@/services/inventory.service'
import { cn } from '@/lib/utils'
import {
  Package,
  UtensilsCrossed,
  Calendar,
  Ticket,
  Download,
  Heart,
  Users,
  Star,
  Loader2,
} from 'lucide-react'

interface ProductTypeSelectorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (type: ProductType) => void
}

// Icon mapping based on backend icon names
const ICON_MAP: Record<string, React.ElementType> = {
  Package: Package,
  UtensilsCrossed: UtensilsCrossed,
  Calendar: Calendar,
  Ticket: Ticket,
  Download: Download,
  Heart: Heart,
  Users: Users,
}

export function ProductTypeSelectorModal({ open, onOpenChange, onSelect }: ProductTypeSelectorModalProps) {
  const { t, i18n } = useTranslation('inventory')
  const { t: tCommon } = useTranslation('common')
  const { venueId } = useCurrentVenue()
  const isSpanish = i18n.language.startsWith('es')

  const [selectedType, setSelectedType] = useState<ProductType | null>(null)

  // Reset selection when modal opens
  useEffect(() => {
    if (open) {
      setSelectedType(null)
    }
  }, [open])

  // Fetch product types for this venue
  const { data: typesData, isLoading } = useQuery({
    queryKey: ['productTypes', venueId],
    queryFn: async () => {
      const response = await productTypesApi.getForVenue(venueId!)
      return response.data.data
    },
    enabled: open && !!venueId,
  })

  // Filter out service types (managed in MenuMaker > Services tab)
  const SERVICE_TYPES: ProductType[] = ['APPOINTMENTS_SERVICE', 'CLASS']
  const filteredTypes = useMemo(() => {
    if (!typesData?.types) return []
    return typesData.types.filter(t => !SERVICE_TYPES.includes(t.code))
  }, [typesData])

  const filteredRecommended = useMemo(() => {
    if (!typesData?.recommended) return []
    return typesData.recommended.filter(r => !SERVICE_TYPES.includes(r))
  }, [typesData])

  // Auto-select recommended type when data loads
  useEffect(() => {
    if (filteredRecommended.length > 0 && !selectedType) {
      setSelectedType(filteredRecommended[0])
    }
  }, [filteredRecommended, selectedType])

  const handleNext = () => {
    if (selectedType) {
      onSelect(selectedType)
      onOpenChange(false)
    }
  }

  const getIcon = (iconName?: string) => {
    if (!iconName) return Package
    return ICON_MAP[iconName] || Package
  }

  const isRecommended = (code: ProductType) => {
    return filteredRecommended.includes(code)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {t('productTypes.title', { defaultValue: '¿Qué tipo de artículo quieres crear?' })}
          </DialogTitle>
          <DialogDescription>
            {t('productTypes.description', {
              defaultValue: 'Selecciona el tipo que mejor describe lo que quieres vender.',
            })}
          </DialogDescription>
        </DialogHeader>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Product types list */}
        {!isLoading && filteredTypes.length > 0 && (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-2 py-2">
              {filteredTypes.map((type: ProductTypeConfig) => {
                const Icon = getIcon(type.icon)
                const isSelected = selectedType === type.code
                const recommended = isRecommended(type.code)

                return (
                  <button
                    key={type.code}
                    type="button"
                    onClick={() => setSelectedType(type.code)}
                    className={cn(
                      'w-full text-left p-3 rounded-lg border transition-all',
                      'hover:bg-muted/50',
                      isSelected
                        ? 'border-foreground bg-muted/50 shadow-sm'
                        : 'border-border hover:border-muted-foreground/30'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'p-2 rounded-lg shrink-0',
                        isSelected ? 'bg-foreground text-background' : 'bg-muted'
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {isSpanish ? type.labelEs : type.label}
                          </span>
                          {recommended && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs">
                              <Star className="h-3 w-3 fill-current" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {isSpanish ? type.descriptionEs : type.description}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {tCommon('cancel')}
          </Button>
          <Button
            onClick={handleNext}
            disabled={!selectedType}
          >
            {tCommon('next')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
