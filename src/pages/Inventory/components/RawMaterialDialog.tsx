import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { rawMaterialsApi, type RawMaterial, type CreateRawMaterialDto } from '@/services/inventory.service'
import { Loader2, Info, Package, DollarSign, BarChart3, FileText, Wand2 } from 'lucide-react'
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
  const { t: _tCommon } = useTranslation('common')
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
      gtin: '',
      category: 'OTHER',
      currentStock: undefined,
      unit: 'KILOGRAM',
      minimumStock: undefined,
      reorderPoint: undefined,
      maximumStock: undefined,
      costPerUnit: undefined,
      perishable: false,
      shelfLifeDays: undefined,
      description: '',
    },
  })

  const perishable = watch('perishable')
  const selectedCategory = watch('category')
  const selectedUnit = watch('unit')

  // State for SKU generation loading
  const [isGeneratingSku, setIsGeneratingSku] = useState(false)

  // Auto-generate SKU like Square (e.g., "C754889")
  const generateSku = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const randomLetter = letters.charAt(Math.floor(Math.random() * letters.length))
    const randomNumber = Math.floor(100000 + Math.random() * 900000) // 6-digit number
    return `${randomLetter}${randomNumber}`
  }

  const handleGenerateSku = async () => {
    if (!venueId) return

    setIsGeneratingSku(true)
    const maxRetries = 5
    let attempts = 0
    let uniqueSku = ''

    try {
      while (attempts < maxRetries) {
        const candidateSku = generateSku()
        const exists = await rawMaterialsApi.checkSkuExists(venueId, candidateSku, rawMaterial?.id)

        if (!exists) {
          uniqueSku = candidateSku
          break
        }
        attempts++
      }

      if (uniqueSku) {
        setValue('sku', uniqueSku)
      } else {
        toast({
          title: 'Error',
          description: t('rawMaterials.messages.skuGenerationFailed') || 'Could not generate unique SKU. Please try again or enter manually.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error checking SKU uniqueness:', error)
      // Fallback: set the SKU anyway, backend will validate
      setValue('sku', generateSku())
    } finally {
      setIsGeneratingSku(false)
    }
  }

  // Transform options for SearchableSelect
  const categoryOptions = useMemo<SearchableSelectOption[]>(
    () =>
      RAW_MATERIAL_CATEGORY_OPTIONS.map(cat => ({
        value: cat.value,
        label: t(`rawMaterials.categories.${cat.value}`),
        icon: cat.icon,
      })),
    [t]
  )

  const unitOptions = useMemo<SearchableSelectOption[]>(
    () =>
      ALL_UNIT_OPTIONS.map(unit => ({
        value: unit.value,
        label: `${unit.label} (${t(`units.${unit.value}`)})`,
      })),
    [t]
  )

  // Reset form when dialog opens with edit data
  useEffect(() => {
    if (open && mode === 'edit' && rawMaterial) {
      reset({
        name: rawMaterial.name,
        sku: rawMaterial.sku,
        gtin: rawMaterial.gtin || '',
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
        gtin: '',
        category: 'OTHER',
        currentStock: undefined,
        unit: 'KILOGRAM',
        minimumStock: undefined,
        reorderPoint: undefined,
        maximumStock: undefined,
        costPerUnit: undefined,
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
    // Validate minimumStock <= reorderPoint
    if (data.minimumStock > data.reorderPoint) {
      toast({
        title: t('validation.invalidStockLevels'),
        description: t('validation.minimumStockMustBeLessOrEqualToReorderPoint'),
        variant: 'destructive',
      })
      return
    }

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

  // Section header component
  const SectionHeader = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
    <div className="flex items-center gap-3 mb-6">
      <div className="p-2.5 rounded-xl bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  )

  // Field with tooltip component
  const FieldLabel = ({ htmlFor, label, required, helpKey }: { htmlFor: string; label: string; required?: boolean; helpKey?: string }) => (
    <div className="flex items-center gap-2 mb-2">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {helpKey && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-sm bg-popover text-popover-foreground border border-border">
              <p className="text-sm">{t(helpKey)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )

  return (
    <FullScreenModal
      open={open}
      onClose={() => onOpenChange(false)}
      title={mode === 'create' ? t('rawMaterials.add') : t('rawMaterials.edit')}
      actions={
        <Button
          onClick={handleSubmit(onSubmit)}
          disabled={isLoading}
          className="h-10 px-6"
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('save')}
        </Button>
      }
      contentClassName="bg-muted/30"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Basic Information Section */}
        <section className="bg-card rounded-2xl border border-border/50 p-6">
          <SectionHeader icon={Package} title={t('rawMaterials.fields.name')} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Name */}
            <div>
              <FieldLabel htmlFor="name" label={t('rawMaterials.fields.name')} required />
              <Input
                id="name"
                {...register('name', { required: true })}
                className="h-12 text-base"
                placeholder={t('rawMaterials.fields.name')}
              />
              {errors.name && <p className="text-xs text-destructive mt-1">{t('validation.required')}</p>}
            </div>

            {/* SKU */}
            <div>
              <FieldLabel htmlFor="sku" label={t('rawMaterials.fields.sku')} required helpKey="rawMaterials.fieldHelp.sku" />
              <div className="flex gap-2">
                <Input
                  id="sku"
                  {...register('sku', { required: true })}
                  className="h-12 text-base flex-1"
                  placeholder="TOM-001"
                />
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-12 w-12 shrink-0"
                        onClick={handleGenerateSku}
                        disabled={isGeneratingSku}
                      >
                        {isGeneratingSku ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Wand2 className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-popover text-popover-foreground border border-border">
                      <p className="text-sm">{t('rawMaterials.autoGenerateSkuTooltip')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              {errors.sku && <p className="text-xs text-destructive mt-1">{t('validation.required')}</p>}
            </div>

            {/* GTIN */}
            <div>
              <FieldLabel htmlFor="gtin" label={t('rawMaterials.fields.gtin')} helpKey="rawMaterials.fieldHelp.gtin" />
              <Input
                id="gtin"
                {...register('gtin')}
                className="h-12 text-base"
                placeholder={t('rawMaterials.fields.gtinPlaceholder')}
              />
            </div>

            {/* Category */}
            <div>
              <FieldLabel htmlFor="category" label={t('rawMaterials.fields.category')} required />
              <SearchableSelect
                options={categoryOptions}
                value={selectedCategory}
                onValueChange={value => setValue('category', value as any)}
                placeholder={t('rawMaterials.selectCategory')}
                searchPlaceholder={t('rawMaterials.searchCategory')}
                emptyMessage={t('rawMaterials.noCategoryFound')}
                size="lg"
              />
            </div>

            {/* Unit */}
            <div>
              <FieldLabel htmlFor="unit" label={t('rawMaterials.fields.unit')} required helpKey="rawMaterials.fieldHelp.unit" />
              <SearchableSelect
                options={unitOptions}
                value={selectedUnit}
                onValueChange={value => setValue('unit', value as any)}
                placeholder={t('rawMaterials.selectUnit')}
                searchPlaceholder={t('rawMaterials.searchUnit')}
                emptyMessage={t('rawMaterials.noUnitFound')}
                size="lg"
              />
            </div>
          </div>
        </section>

        {/* Stock Levels Section */}
        <section className="bg-card rounded-2xl border border-border/50 p-6">
          <SectionHeader icon={BarChart3} title={t('rawMaterials.fields.currentStock')} />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Current Stock */}
            <div>
              <FieldLabel htmlFor="currentStock" label={t('rawMaterials.fields.currentStock')} required helpKey="rawMaterials.fieldHelp.currentStock" />
              <Input
                id="currentStock"
                type="number"
                step="0.01"
                {...register('currentStock', { required: true, valueAsNumber: true })}
                className="h-12 text-base"
                placeholder="0"
              />
              {errors.currentStock && <p className="text-xs text-destructive mt-1">{t('validation.required')}</p>}
            </div>

            {/* Minimum Stock */}
            <div>
              <FieldLabel htmlFor="minimumStock" label={t('rawMaterials.fields.minimumStock')} required helpKey="rawMaterials.fieldHelp.minimumStock" />
              <Input
                id="minimumStock"
                type="number"
                step="0.01"
                {...register('minimumStock', { required: true, valueAsNumber: true })}
                className="h-12 text-base"
                placeholder="0"
              />
              {errors.minimumStock && <p className="text-xs text-destructive mt-1">{t('validation.required')}</p>}
            </div>

            {/* Reorder Point */}
            <div>
              <FieldLabel htmlFor="reorderPoint" label={t('rawMaterials.fields.reorderPoint')} required helpKey="rawMaterials.fieldHelp.reorderPoint" />
              <Input
                id="reorderPoint"
                type="number"
                step="0.01"
                {...register('reorderPoint', { required: true, valueAsNumber: true })}
                className="h-12 text-base"
                placeholder="0"
              />
              {errors.reorderPoint && <p className="text-xs text-destructive mt-1">{t('validation.required')}</p>}
            </div>

            {/* Maximum Stock */}
            <div>
              <FieldLabel htmlFor="maximumStock" label={t('rawMaterials.fields.maximumStock')} helpKey="rawMaterials.fieldHelp.maximumStock" />
              <Input
                id="maximumStock"
                type="number"
                step="0.01"
                {...register('maximumStock', { valueAsNumber: true })}
                className="h-12 text-base"
                placeholder={t('rawMaterials.fields.maximumStock')}
              />
            </div>
          </div>
        </section>

        {/* Cost Section */}
        <section className="bg-card rounded-2xl border border-border/50 p-6">
          <SectionHeader icon={DollarSign} title={t('rawMaterials.fields.costPerUnit')} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cost Per Unit */}
            <div>
              <FieldLabel htmlFor="costPerUnit" label={t('rawMaterials.fields.costPerUnit')} required helpKey="rawMaterials.fieldHelp.costPerUnit" />
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-base">$</span>
                <Input
                  id="costPerUnit"
                  type="number"
                  step="0.01"
                  {...register('costPerUnit', { required: true, valueAsNumber: true })}
                  className="h-12 text-base pl-8"
                  placeholder="0.00"
                />
              </div>
              {errors.costPerUnit && <p className="text-xs text-destructive mt-1">{t('validation.required')}</p>}
            </div>

            {/* Perishable Toggle */}
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border border-border/50">
                <Checkbox
                  id="perishable"
                  checked={perishable}
                  onCheckedChange={checked => setValue('perishable', checked as boolean)}
                  className="h-5 w-5"
                />
                <div className="flex-1">
                  <Label htmlFor="perishable" className="cursor-pointer text-base font-medium">
                    {t('rawMaterials.fields.perishable')}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('rawMaterials.fieldHelp.perishable')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Shelf Life Days - Only shown when perishable is checked */}
          {perishable && (
            <div className="mt-6 pt-6 border-t border-border/50">
              <div className="max-w-md">
                <FieldLabel htmlFor="shelfLifeDays" label={t('rawMaterials.fields.shelfLifeDays')} required />
                <Input
                  id="shelfLifeDays"
                  type="number"
                  {...register('shelfLifeDays', { valueAsNumber: true, required: perishable })}
                  className="h-12 text-base"
                  placeholder="7"
                />
                {errors.shelfLifeDays && <p className="text-xs text-destructive mt-1">{t('validation.required')}</p>}
                <p className="text-sm text-muted-foreground mt-2">
                  {t('rawMaterials.fieldHelp.shelfLifeDays')}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Description Section */}
        <section className="bg-card rounded-2xl border border-border/50 p-6">
          <SectionHeader icon={FileText} title={t('rawMaterials.fields.description')} />

          <div>
            <Textarea
              id="description"
              rows={4}
              {...register('description')}
              className="text-base resize-none"
              placeholder={t('rawMaterials.fields.description')}
            />
          </div>
        </section>

        {/* Bottom padding for scroll */}
        <div className="h-8" />
      </form>
    </FullScreenModal>
  )
}
