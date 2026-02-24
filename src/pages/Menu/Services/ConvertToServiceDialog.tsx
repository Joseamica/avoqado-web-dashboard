import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, Users, AlertTriangle, Loader2 } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { updateProduct } from '@/services/menu.service'
import { type ProductType } from '@/services/inventory.service'

interface ConvertToServiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string | null
  productName: string
  onSuccess?: () => void
}

const SERVICE_OPTIONS: Array<{
  type: ProductType
  icon: typeof Calendar
  titleKey: string
}> = [
  {
    type: 'APPOINTMENTS_SERVICE',
    icon: Calendar,
    titleKey: 'services.typeSelector.serviceTitle',
  },
  {
    type: 'CLASS',
    icon: Users,
    titleKey: 'services.typeSelector.classTitle',
  },
]

export function ConvertToServiceDialog({
  open,
  onOpenChange,
  productId,
  productName,
  onSuccess,
}: ConvertToServiceDialogProps) {
  const { t } = useTranslation('menu')
  const { t: tCommon } = useTranslation('common')
  const { venueId, fullBasePath } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [selectedType, setSelectedType] = useState<ProductType | null>(null)

  const convertMutation = useMutation({
    mutationFn: async () => {
      if (!productId || !selectedType) throw new Error('Missing data')
      return updateProduct(venueId!, productId, {
        type: selectedType,
        trackInventory: false,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
      onOpenChange(false)
      setSelectedType(null)

      toast({
        title: t('services.convert.success'),
        description: productName,
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.href = `${fullBasePath}/menumaker/services`
            }}
          >
            {t('services.convert.viewServices')}
          </Button>
        ),
      })
      onSuccess?.()
    },
    onError: () => {
      toast({
        title: tCommon('error'),
        description: t('services.toasts.errorDesc'),
        variant: 'destructive',
      })
    },
  })

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen)
      if (!isOpen) setSelectedType(null)
    }}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('services.convert.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('services.convert.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          {SERVICE_OPTIONS.map(({ type, icon: Icon, titleKey }) => {
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
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'p-2 rounded-lg shrink-0',
                      isSelected ? 'bg-foreground text-background' : 'bg-muted',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-sm">{t(titleKey)}</span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            {t('services.convert.warning')}
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
          <Button
            onClick={() => convertMutation.mutate()}
            disabled={!selectedType || convertMutation.isPending}
          >
            {convertMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {convertMutation.isPending
              ? t('services.convert.converting')
              : t('services.convert.confirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
