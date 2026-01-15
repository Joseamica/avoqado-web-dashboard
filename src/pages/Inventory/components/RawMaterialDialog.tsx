import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { rawMaterialsApi, type RawMaterial, type CreateRawMaterialDto } from '@/services/inventory.service'
import { Loader2, Info } from 'lucide-react'
import { ALL_UNIT_OPTIONS, RAW_MATERIAL_CATEGORY_OPTIONS } from '@/lib/inventory-constants'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface RawMaterialDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  rawMaterial?: RawMaterial | null
}

export function RawMaterialDialog({ open, onOpenChange, mode, rawMaterial }: RawMaterialDialogProps) {
  const { t } = useTranslation('inventory')
  const { t: tCommon } = useTranslation('common')
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
  } = useForm<CreateRawMaterialDto>({
    defaultValues: {
      name: '',
      sku: '',
      category: 'OTHER',
      currentStock: 0,
      unit: 'KILOGRAM', // Store as enum
      minimumStock: 0,
      reorderPoint: 0,
      maximumStock: undefined,
      costPerUnit: 0,
      perishable: false,
      shelfLifeDays: undefined,
      description: '',
    },
  })

  const perishable = watch('perishable')

  // Reset form when dialog opens with edit data
  useEffect(() => {
    if (open && mode === 'edit' && rawMaterial) {
      reset({
        name: rawMaterial.name,
        sku: rawMaterial.sku,
        category: rawMaterial.category,
        currentStock: Number(rawMaterial.currentStock),
        unit: rawMaterial.unit,
        minimumStock: Number(rawMaterial.minimumStock),
        reorderPoint: Number(rawMaterial.reorderPoint),
        maximumStock: rawMaterial.maximumStock ? Number(rawMaterial.maximumStock) : undefined,
        costPerUnit: Number(rawMaterial.costPerUnit),
        perishable: rawMaterial.perishable,
        shelfLifeDays: rawMaterial.shelfLifeDays || undefined,
        description: rawMaterial.description || '',
      })
    } else if (open && mode === 'create') {
      reset({
        name: '',
        sku: '',
        category: 'OTHER',
        currentStock: 0,
        unit: 'KILOGRAM',
        minimumStock: 0,
        reorderPoint: 0,
        maximumStock: undefined,
        costPerUnit: 0,
        perishable: false,
        shelfLifeDays: undefined,
        description: '',
      })
    }
  }, [open, mode, rawMaterial, reset])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateRawMaterialDto) => rawMaterialsApi.create(venueId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rawMaterials', venueId] })
      toast({
        title: t('rawMaterials.messages.created'),
        variant: 'default',
      })
      onOpenChange(false)
      reset()
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create raw material',
        variant: 'destructive',
      })
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: CreateRawMaterialDto) => rawMaterialsApi.update(venueId, rawMaterial!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rawMaterials', venueId] })
      toast({
        title: t('rawMaterials.messages.updated'),
        variant: 'default',
      })
      onOpenChange(false)
      reset()
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update raw material',
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (data: CreateRawMaterialDto) => {
    // Unit is already in enum format - no conversion needed
    const payload = {
      ...data,
      avgCostPerUnit: data.costPerUnit,
    }

    if (mode === 'create') {
      createMutation.mutate(payload)
    } else {
      updateMutation.mutate(payload)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? t('rawMaterials.add') : t('rawMaterials.edit')}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? t('rawMaterials.subtitle') : `${tCommon('edit')} ${rawMaterial?.name}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('rawMaterials.fields.name')} *</Label>
              <Input id="name" {...register('name', { required: true })} />
              {errors.name && <p className="text-xs text-destructive">{t('validation.required')}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="sku">{t('rawMaterials.fields.sku')} *</Label>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm bg-popover text-popover-foreground border border-border">
                      <p className="text-sm">{t('rawMaterials.fieldHelp.sku')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input id="sku" {...register('sku', { required: true })} />
              {errors.sku && <p className="text-xs text-destructive">{t('validation.required')}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">{t('rawMaterials.fields.category')} *</Label>
              <Select
                value={watch('category')}
                onValueChange={value => setValue('category', value as any)}
              >
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

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="unit">{t('rawMaterials.fields.unit')} *</Label>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm bg-popover text-popover-foreground border border-border">
                      <p className="text-sm">{t('rawMaterials.fieldHelp.unit')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select
                value={watch('unit')}
                onValueChange={value => setValue('unit', value)}
              >
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
          </div>

          {/* Stock Levels */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="currentStock">{t('rawMaterials.fields.currentStock')} *</Label>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm bg-popover text-popover-foreground border border-border">
                      <p className="text-sm">{t('rawMaterials.fieldHelp.currentStock')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="currentStock"
                type="number"
                step="0.01"
                {...register('currentStock', { required: true, valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="minimumStock">{t('rawMaterials.fields.minimumStock')} *</Label>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm bg-popover text-popover-foreground border border-border">
                      <p className="text-sm">{t('rawMaterials.fieldHelp.minimumStock')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="minimumStock"
                type="number"
                step="0.01"
                {...register('minimumStock', { required: true, valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="reorderPoint">{t('rawMaterials.fields.reorderPoint')} *</Label>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm bg-popover text-popover-foreground border border-border">
                      <p className="text-sm">{t('rawMaterials.fieldHelp.reorderPoint')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="reorderPoint"
                type="number"
                step="0.01"
                {...register('reorderPoint', { required: true, valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="maximumStock">{t('rawMaterials.fields.maximumStock')}</Label>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm bg-popover text-popover-foreground border border-border">
                      <p className="text-sm">{t('rawMaterials.fieldHelp.maximumStock')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="maximumStock"
                type="number"
                step="0.01"
                {...register('maximumStock', { valueAsNumber: true })}
              />
            </div>
          </div>

          {/* Cost Information */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="costPerUnit">{t('rawMaterials.fields.costPerUnit')} *</Label>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm bg-popover text-popover-foreground border border-border">
                    <p className="text-sm">{t('rawMaterials.fieldHelp.costPerUnit')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              id="costPerUnit"
              type="number"
              step="0.01"
              {...register('costPerUnit', { required: true, valueAsNumber: true })}
            />
          </div>

          {/* Perishable Information */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="perishable"
                checked={perishable}
                onCheckedChange={checked => setValue('perishable', checked as boolean)}
              />
              <Label htmlFor="perishable" className="cursor-pointer">
                {t('rawMaterials.fields.perishable')}
              </Label>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm bg-popover text-popover-foreground border border-border">
                    <p className="text-sm">{t('rawMaterials.fieldHelp.perishable')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {perishable && (
              <div className="pl-6">
                <div className="space-y-2">
                  <Label htmlFor="shelfLifeDays">{t('rawMaterials.fields.shelfLifeDays')} *</Label>
                  <Input
                    id="shelfLifeDays"
                    type="number"
                    {...register('shelfLifeDays', { valueAsNumber: true, required: perishable })}
                  />
                  <p className="text-xs text-muted-foreground">{t('rawMaterials.fieldHelp.shelfLifeDays')}</p>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">{t('rawMaterials.fields.description')}</Label>
            <Textarea id="description" rows={3} {...register('description')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
