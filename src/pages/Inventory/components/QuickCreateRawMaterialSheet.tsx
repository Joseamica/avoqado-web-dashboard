import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { rawMaterialsApi, type RawMaterial, type CreateRawMaterialDto } from '@/services/inventory.service'
import { Loader2, Zap } from 'lucide-react'
import { ALL_UNIT_OPTIONS, RAW_MATERIAL_CATEGORY_OPTIONS } from '@/lib/inventory-constants'

interface QuickCreateRawMaterialSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialName: string
  onSuccess: (material: RawMaterial) => void
}

interface QuickCreateForm {
  name: string
  unit: string
  costPerUnit: number
  category: string
}

/**
 * Generates a unique SKU from the material name.
 * e.g., "Burger Bun" → "BURGER-BUN-A1B2C"
 */
function generateSkuFromName(name: string): string {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '') // Remove special chars
    .trim()
    .replace(/\s+/g, '-') // Spaces to dashes
    .slice(0, 20) // Max 20 chars for base

  // Add random suffix for uniqueness
  const suffix = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `${base}-${suffix}`
}

export function QuickCreateRawMaterialSheet({ open, onOpenChange, initialName, onSuccess }: QuickCreateRawMaterialSheetProps) {
  const { t } = useTranslation('inventory')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<QuickCreateForm>({
    defaultValues: {
      name: '',
      unit: 'PIECE',
      costPerUnit: 0,
      category: 'OTHER',
    },
  })

  // Pre-fill name when dialog opens
  useEffect(() => {
    if (open && initialName) {
      reset({
        name: initialName,
        unit: 'PIECE',
        costPerUnit: 0,
        category: 'OTHER',
      })
    }
  }, [open, initialName, reset])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateRawMaterialDto) => rawMaterialsApi.create(venueId, data),
    onSuccess: response => {
      // Invalidate cache so the ingredient list refreshes
      queryClient.invalidateQueries({ queryKey: ['rawMaterials', venueId] })

      toast({
        title: t('rawMaterials.messages.created'),
        variant: 'default',
      })

      // Pass the created material back to parent
      onSuccess(response.data.data as RawMaterial)
      onOpenChange(false)
      reset()
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || t('rawMaterials.messages.createFailed'),
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (data: QuickCreateForm) => {
    // Build full payload with sensible defaults
    const payload: CreateRawMaterialDto = {
      name: data.name,
      sku: generateSkuFromName(data.name),
      unit: data.unit,
      costPerUnit: data.costPerUnit,
      avgCostPerUnit: data.costPerUnit,
      category: data.category,
      // Sensible defaults for a quick create
      currentStock: 0,
      minimumStock: 0,
      reorderPoint: 0,
      perishable: false,
    }

    createMutation.mutate(payload)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            {t('rawMaterials.quickCreateTitle')}
          </SheetTitle>
          <SheetDescription>{t('rawMaterials.quickCreateDesc')}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">{t('rawMaterials.fields.name')} *</Label>
            <Input id="name" {...register('name', { required: true })} autoFocus />
            {errors.name && <p className="text-xs text-destructive">{t('validation.required')}</p>}
          </div>

          {/* Unit */}
          <div className="space-y-2">
            <Label htmlFor="unit">{t('rawMaterials.fields.unit')} *</Label>
            <Select value={watch('unit')} onValueChange={value => setValue('unit', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_UNIT_OPTIONS.map(unit => (
                  <SelectItem key={unit.value} value={unit.value}>
                    {unit.label} ({t(`units.${unit.value}`)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cost Per Unit */}
          <div className="space-y-2">
            <Label htmlFor="costPerUnit">{t('rawMaterials.fields.costPerUnit')} *</Label>
            <Input
              id="costPerUnit"
              type="number"
              step="0.01"
              min="0"
              {...register('costPerUnit', { required: true, valueAsNumber: true, min: 0 })}
            />
            {errors.costPerUnit && <p className="text-xs text-destructive">{t('validation.required')}</p>}
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">{t('rawMaterials.fields.category')}</Label>
            <Select value={watch('category')} onValueChange={value => setValue('category', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RAW_MATERIAL_CATEGORY_OPTIONS.map(category => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.icon} {t(`rawMaterials.categories.${category.value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('rawMaterials.quickCreateButton', { defaultValue: 'Create & Select' })}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
