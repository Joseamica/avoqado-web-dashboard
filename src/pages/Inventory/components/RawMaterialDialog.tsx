import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select'
import { MultiSelectCombobox } from '@/components/multi-select-combobox'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { rawMaterialsApi, type RawMaterial, type CreateRawMaterialDto } from '@/services/inventory.service'
import { supplierService } from '@/services/supplier.service'
import { Loader2, Info, Package, DollarSign, BarChart3, FileText, Wand2, Sparkles, Timer, Truck } from 'lucide-react'
import { ALL_UNIT_OPTIONS, RAW_MATERIAL_CATEGORY_OPTIONS } from '@/lib/inventory-constants'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// Maps base unit → purchase sub-unit options with conversion factors
const PURCHASE_UNIT_OPTIONS: Record<string, { label: string; toBase: number }[]> = {
  KILOGRAM: [
    { label: 'g', toBase: 0.001 },
    { label: 'kg', toBase: 1 },
  ],
  GRAM: [
    { label: 'g', toBase: 1 },
    { label: 'kg', toBase: 1000 },
  ],
  POUND: [
    { label: 'lb', toBase: 1 },
    { label: 'oz', toBase: 0.0625 },
  ],
  OUNCE: [
    { label: 'oz', toBase: 1 },
    { label: 'lb', toBase: 16 },
  ],
  LITER: [
    { label: 'ml', toBase: 0.001 },
    { label: 'L', toBase: 1 },
  ],
  MILLILITER: [
    { label: 'ml', toBase: 1 },
    { label: 'L', toBase: 1000 },
  ],
  UNIT: [{ label: 'pzas', toBase: 1 }],
  PIECE: [{ label: 'pzas', toBase: 1 }],
  DOZEN: [
    { label: 'pzas', toBase: 1 / 12 },
    { label: 'dz', toBase: 1 },
  ],
}

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
    setError,
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
      notifyOnLowStock: true,
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

  // Supplier selection state
  const [selectedSuppliers, setSelectedSuppliers] = useState<{ label: string; value: string }[]>([])

  // Fetch raw material detail (includes supplierPricing) when editing
  const { data: rawMaterialDetail } = useQuery({
    queryKey: ['rawMaterial', venueId, rawMaterial?.id],
    queryFn: () => rawMaterialsApi.getById(venueId, rawMaterial!.id),
    enabled: !!venueId && open && mode === 'edit' && !!rawMaterial?.id,
  })

  // Fetch suppliers
  const { data: suppliersData, isLoading: isSuppliersLoading } = useQuery({
    queryKey: ['suppliers', venueId],
    queryFn: () => supplierService.getSuppliers(venueId, { active: true }),
    enabled: !!venueId && open,
  })

  const supplierOptions = useMemo(() => {
    const list = suppliersData?.data ?? suppliersData ?? []
    if (!Array.isArray(list)) return []
    return list.map((s: { id: string; name: string }) => ({
      value: s.id,
      label: s.name,
    }))
  }, [suppliersData])

  // Purchase cost calculator state
  const [purchasePrice, setPurchasePrice] = useState('')
  const [purchaseQty, setPurchaseQty] = useState('')
  const [purchaseUnit, setPurchaseUnit] = useState('')
  const [manualCostMode, setManualCostMode] = useState(false)

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
          description:
            t('rawMaterials.messages.skuGenerationFailed') || 'Could not generate unique SKU. Please try again or enter manually.',
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
    [t],
  )

  const unitOptions = useMemo<SearchableSelectOption[]>(
    () =>
      ALL_UNIT_OPTIONS.map(unit => ({
        value: unit.value,
        label: `${unit.label} (${t(`units.${unit.value}`)})`,
      })),
    [t],
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
        notifyOnLowStock: rawMaterial.notifyOnLowStock ?? true,
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
        notifyOnLowStock: true,
        perishable: false,
        shelfLifeDays: undefined,
        description: '',
      })
    }
    if (open) {
      setPurchasePrice('')
      setPurchaseQty('')
      setPurchaseUnit('')
      setManualCostMode(false)

      // Suppliers are pre-populated via the detail query effect below
      if (mode === 'create') {
        setSelectedSuppliers([])
      }
    }
  }, [open, mode, rawMaterial, reset])

  // Pre-populate suppliers when raw material detail loads (has supplierPricing)
  useEffect(() => {
    if (mode === 'edit' && rawMaterialDetail) {
      const detail = rawMaterialDetail?.data?.data || rawMaterialDetail?.data || rawMaterialDetail
      if (detail?.supplierPricing && Array.isArray(detail.supplierPricing)) {
        const existing = detail.supplierPricing
          .filter((sp: any) => sp.active && sp.supplier)
          .map((sp: any) => ({ value: sp.supplier.id, label: sp.supplier.name }))
        setSelectedSuppliers(existing)
      }
    }
  }, [mode, rawMaterialDetail])

  // Reset purchase unit when base unit changes or dialog opens — default to the base unit (toBase === 1)
  useEffect(() => {
    const options = PURCHASE_UNIT_OPTIONS[selectedUnit]
    if (options?.length) {
      const baseOption = options.find(o => o.toBase === 1)
      setPurchaseUnit(baseOption ? baseOption.label : options[0].label)
    }
  }, [selectedUnit, open])

  // Auto-calculate cost per unit from purchase inputs
  useEffect(() => {
    const price = parseFloat(purchasePrice)
    const qty = parseFloat(purchaseQty)
    const selectedOpt = PURCHASE_UNIT_OPTIONS[selectedUnit]?.find(o => o.label === purchaseUnit)
    if (price > 0 && qty > 0 && selectedOpt) {
      const result = price / (qty * selectedOpt.toBase)
      setValue('costPerUnit', Math.round(result * 100) / 100)
    }
  }, [purchasePrice, purchaseQty, purchaseUnit, selectedUnit, setValue])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateRawMaterialDto & { supplierIds?: string[] }) => rawMaterialsApi.create(venueId, data),
    onSuccess: async (result: any) => {
      const newId = result?.data?.data?.id || result?.data?.id || result?.id
      if (newId && selectedSuppliers.length > 0) {
        await linkSuppliers(newId, watch('costPerUnit'), watch('unit'))
      }
      queryClient.invalidateQueries({ queryKey: ['rawMaterials', venueId] })
      toast({
        title: t('rawMaterials.messages.created'),
        variant: 'default',
      })
      onOpenChange(false)
      reset()
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || ''
      if (msg.toLowerCase().includes('unique') && msg.toLowerCase().includes('gtin')) {
        setError('gtin', { type: 'server', message: t('rawMaterials.validation.gtinDuplicate') })
        scrollToField('gtin')
      } else if (msg.toLowerCase().includes('unique') && msg.toLowerCase().includes('sku')) {
        setError('sku', { type: 'server', message: t('rawMaterials.validation.skuDuplicate') })
        scrollToField('sku')
      } else {
        toast({ title: 'Error', description: msg || 'Failed to create raw material', variant: 'destructive' })
      }
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: CreateRawMaterialDto & { supplierIds?: string[] }) => rawMaterialsApi.update(venueId, rawMaterial!.id, data),
    onSuccess: async () => {
      if (selectedSuppliers.length > 0) {
        await linkSuppliers(rawMaterial!.id, watch('costPerUnit'), watch('unit'))
      }
      queryClient.invalidateQueries({ queryKey: ['rawMaterials', venueId] })
      toast({
        title: t('rawMaterials.messages.updated'),
        variant: 'default',
      })
      onOpenChange(false)
      reset()
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || ''
      if (msg.toLowerCase().includes('unique') && msg.toLowerCase().includes('gtin')) {
        setError('gtin', { type: 'server', message: t('rawMaterials.validation.gtinDuplicate') })
        scrollToField('gtin')
      } else if (msg.toLowerCase().includes('unique') && msg.toLowerCase().includes('sku')) {
        setError('sku', { type: 'server', message: t('rawMaterials.validation.skuDuplicate') })
        scrollToField('sku')
      } else {
        toast({ title: 'Error', description: msg || 'Failed to update raw material', variant: 'destructive' })
      }
    },
  })

  // Link suppliers after creating/updating a raw material
  const linkSuppliers = async (rawMaterialId: string, costPerUnit: number, unit: string) => {
    if (!venueId || selectedSuppliers.length === 0) return

    try {
      await Promise.all(
        selectedSuppliers.map(supplier =>
          supplierService.addPricing(venueId, supplier.value, {
            rawMaterialId,
            pricePerUnit: costPerUnit,
            unit,
            minimumQuantity: 1,
            effectiveFrom: new Date().toISOString(),
          }),
        ),
      )
    } catch (error) {
      console.error('Error linking suppliers:', error)
      // Non-blocking — the raw material is already saved
    }
  }

  // Scroll to the first field with an error
  const scrollToField = (fieldName: string) => {
    setTimeout(() => {
      const el = document.getElementById(fieldName)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.focus()
    }, 50)
  }

  const onSubmit = (data: CreateRawMaterialDto) => {
    // Validate minimumStock <= reorderPoint — show inline on the field
    if (data.minimumStock > data.reorderPoint) {
      setError('minimumStock', {
        type: 'validate',
        message: t('validation.minimumStockMustBeLessOrEqualToReorderPoint'),
      })
      scrollToField('minimumStock')
      return
    }

    const payload = {
      ...data,
      gtin: data.gtin?.trim() || undefined, // Omit empty GTIN — backend Zod rejects null
      avgCostPerUnit: data.costPerUnit,
      supplierIds: selectedSuppliers.map(s => s.value),
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
          data-tour="ingredient-dialog-save"
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
            <div data-tour="ingredient-dialog-name">
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
            <div data-tour="ingredient-dialog-sku">
              <FieldLabel htmlFor="sku" label={t('rawMaterials.fields.sku')} required helpKey="rawMaterials.fieldHelp.sku" />
              <div className="flex gap-2">
                <Input id="sku" {...register('sku', { required: true })} className="h-12 text-base flex-1" placeholder="TOM-001" />
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
                        {isGeneratingSku ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-popover text-popover-foreground border border-border">
                      <p className="text-sm">{t('rawMaterials.autoGenerateSkuTooltip')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              {errors.sku && <p className="text-xs text-destructive mt-1">{errors.sku.message || t('validation.required')}</p>}
            </div>

            {/* GTIN */}
            <div>
              <FieldLabel htmlFor="gtin" label={t('rawMaterials.fields.gtin')} helpKey="rawMaterials.fieldHelp.gtin" />
              <Input id="gtin" {...register('gtin')} className="h-12 text-base" placeholder={t('rawMaterials.fields.gtinPlaceholder')} />
              {errors.gtin && <p className="text-xs text-destructive mt-1">{errors.gtin.message}</p>}
            </div>

            {/* Category */}
            <div data-tour="ingredient-dialog-category">
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
            <div data-tour="ingredient-dialog-unit">
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

        {/* Suppliers Section */}
        <section className="bg-card rounded-2xl border border-border/50 p-6">
          <SectionHeader icon={Truck} title={t('rawMaterials.fields.suppliers')} />
          <MultiSelectCombobox
            options={supplierOptions}
            selected={selectedSuppliers}
            onChange={setSelectedSuppliers}
            placeholder={t('rawMaterials.fields.suppliersPlaceholder')}
            emptyText={t('rawMaterials.fields.noSuppliersFound')}
            isLoading={isSuppliersLoading}
          />
          <p className="text-xs text-muted-foreground mt-2">{t('rawMaterials.fields.suppliersHint')}</p>
        </section>

        {/* Stock Levels Section */}
        <section className="bg-card rounded-2xl border border-border/50 p-6" data-tour="ingredient-dialog-stock">
          <SectionHeader icon={BarChart3} title={t('rawMaterials.fields.currentStock')} />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Current Stock */}
            <div>
              <FieldLabel
                htmlFor="currentStock"
                label={t('rawMaterials.fields.currentStock')}
                required
                helpKey="rawMaterials.fieldHelp.currentStock"
              />
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
              <FieldLabel
                htmlFor="minimumStock"
                label={t('rawMaterials.fields.minimumStock')}
                required
                helpKey="rawMaterials.fieldHelp.minimumStock"
              />
              <Input
                id="minimumStock"
                type="number"
                step="0.01"
                {...register('minimumStock', { required: true, valueAsNumber: true })}
                className="h-12 text-base"
                placeholder="0"
              />
              {errors.minimumStock && (
                <p className="text-xs text-destructive mt-1">
                  {errors.minimumStock.message || t('validation.required')}
                </p>
              )}
            </div>

            {/* Reorder Point */}
            <div>
              <FieldLabel
                htmlFor="reorderPoint"
                label={t('rawMaterials.fields.reorderPoint')}
                required
                helpKey="rawMaterials.fieldHelp.reorderPoint"
              />
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

            {/* Notify on Low Stock */}
            <div className="flex items-start gap-3 col-span-full">
              <Checkbox
                id="notifyOnLowStock"
                checked={watch('notifyOnLowStock') ?? true}
                onCheckedChange={(checked: boolean) => setValue('notifyOnLowStock', checked)}
              />
              <div className="space-y-1">
                <Label htmlFor="notifyOnLowStock" className="text-sm font-medium cursor-pointer">
                  {t('rawMaterials.fields.notifyOnLowStock')}
                </Label>
                <p className="text-xs text-muted-foreground">{t('rawMaterials.fieldHelp.notifyOnLowStock')}</p>
              </div>
            </div>

            {/* Maximum Stock */}
            <div>
              <FieldLabel
                htmlFor="maximumStock"
                label={t('rawMaterials.fields.maximumStock')}
                helpKey="rawMaterials.fieldHelp.maximumStock"
              />
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
          <SectionHeader icon={DollarSign} title={t('rawMaterials.costCalculator.sectionTitle')} />

          {/* Cost calculator — guided steps (hidden in manual mode) */}
          {PURCHASE_UNIT_OPTIONS[selectedUnit] && !manualCostMode && (
            <div className="p-5 rounded-xl border border-border/50 bg-muted/30 space-y-4">
              <p className="text-xs text-muted-foreground">{t('rawMaterials.costCalculator.hint')}</p>
              <div className="grid grid-cols-[1fr_1fr_auto] gap-4 items-end">
                {/* Step 1: How much did you pay? */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/15 text-primary text-[11px] font-bold shrink-0">
                      1
                    </span>
                    <Label className="text-sm font-medium">{t('rawMaterials.costCalculator.pricePaid')}</Label>
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-base">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={purchasePrice}
                      onChange={e => setPurchasePrice(e.target.value)}
                      className="h-12 text-base pl-8"
                      placeholder="Ej: 203.57"
                    />
                  </div>
                </div>

                {/* Step 2: How much did you buy? */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/15 text-primary text-[11px] font-bold shrink-0">
                      2
                    </span>
                    <Label className="text-sm font-medium">{t('rawMaterials.costCalculator.quantity')}</Label>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    value={purchaseQty}
                    onChange={e => setPurchaseQty(e.target.value)}
                    className="h-12 text-base"
                    placeholder="Ej: 908"
                  />
                </div>

                {/* Step 3: Unit selector as badges */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/15 text-primary text-[11px] font-bold shrink-0">
                      3
                    </span>
                    <Label className="text-sm font-medium">{t('rawMaterials.costCalculator.unit')}</Label>
                  </div>
                  <div className="flex gap-2">
                    {PURCHASE_UNIT_OPTIONS[selectedUnit]?.map(opt => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setPurchaseUnit(opt.label)}
                        className={`h-10 min-w-10 px-3 rounded-lg text-sm font-medium transition-colors border ${
                          purchaseUnit === opt.label
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-transparent text-muted-foreground border-input hover:text-foreground hover:border-foreground/30'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cost Per Unit */}
          {(() => {
            const calculatorActive = parseFloat(purchasePrice) > 0 && parseFloat(purchaseQty) > 0 && !manualCostMode
            const unitAbbr = selectedUnit ? t(`units.${selectedUnit}_abbr`, { defaultValue: selectedUnit?.toLowerCase() }) : ''
            return (
              <div className="mt-5" data-tour="ingredient-dialog-cost">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FieldLabel
                      htmlFor="costPerUnit"
                      label={t('rawMaterials.fields.costPerUnit')}
                      required
                      helpKey="rawMaterials.fieldHelp.costPerUnit"
                    />
                    {calculatorActive && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full -mt-1.5">
                        <Sparkles className="h-3 w-3" />
                        {t('rawMaterials.costCalculator.applied')}
                      </span>
                    )}
                  </div>
                  {calculatorActive && (
                    <button
                      type="button"
                      onClick={() => {
                        setManualCostMode(true)
                        setPurchasePrice('')
                        setPurchaseQty('')
                      }}
                      className="text-xs px-3 py-1 rounded-full border border-input text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                    >
                      {t('rawMaterials.costCalculator.manualEdit')}
                    </button>
                  )}
                  {manualCostMode && PURCHASE_UNIT_OPTIONS[selectedUnit] && (
                    <button
                      type="button"
                      onClick={() => setManualCostMode(false)}
                      className="text-xs px-3 py-1 rounded-full border border-primary/50 text-primary hover:bg-primary/10 transition-colors"
                    >
                      {t('rawMaterials.costCalculator.useCalculator')}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-base">$</span>
                  <Input
                    id="costPerUnit"
                    type="number"
                    step="0.01"
                    {...register('costPerUnit', { required: true, valueAsNumber: true })}
                    readOnly={calculatorActive}
                    className={`h-12 text-base pl-8 ${unitAbbr ? 'pr-16' : ''} ${
                      calculatorActive ? 'border-primary/50 ring-1 ring-primary/20 bg-primary/5 text-foreground font-semibold' : ''
                    }`}
                    placeholder="0.00"
                  />
                  {unitAbbr && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">/ {unitAbbr}</span>
                  )}
                </div>
                {errors.costPerUnit && <p className="text-xs text-destructive mt-1">{t('validation.required')}</p>}
                {/* Sanity check for unit confusion: $X/g > $1 almost always means
                    the user meant $X/kg. Same for ml vs liter. Surfaces the bug
                    that took us all day to track down (Dátiles $224.20/g). */}
                {(() => {
                  const cost = Number(watch('costPerUnit') || 0)
                  if (cost <= 1) return null
                  const isPerGram = selectedUnit === 'GRAM'
                  const isPerMl = selectedUnit === 'MILLILITER'
                  if (!isPerGram && !isPerMl) return null
                  const bigUnit = isPerGram ? 'kilogramo' : 'litro'
                  const bigUnitTotal = (cost * 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })
                  const smallUnit = isPerGram ? 'gramo' : 'mililitro'
                  return (
                    <div className="mt-2 rounded-md border border-amber-300 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2">
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        <strong>¿Estás seguro?</strong> ${cost.toFixed(2)} por {smallUnit} = ${bigUnitTotal} por {bigUnit}.
                        Si lo compras por {bigUnit}, divide entre 1000 (ej: ${cost.toFixed(2)}/kg → ${(cost / 1000).toFixed(4)}/g).
                      </p>
                    </div>
                  )
                })()}
              </div>
            )
          })()}

        </section>

        {/* Perishable Section */}
        <section className="bg-card rounded-2xl border border-border/50 p-6">
          <SectionHeader icon={Timer} title={t('rawMaterials.fields.perishable')} />

          <div className="flex items-start gap-6">
            <div className="flex items-center gap-3 flex-1">
              <Checkbox
                id="perishable"
                checked={perishable}
                onCheckedChange={checked => setValue('perishable', checked as boolean)}
                className="h-5 w-5 mt-0.5"
              />
              <div className="flex-1">
                <Label htmlFor="perishable" className="cursor-pointer text-base font-medium">
                  {t('rawMaterials.fields.perishable')}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">{t('rawMaterials.fieldHelp.perishable')}</p>
              </div>
            </div>

            {perishable && (
              <div className="w-48 shrink-0">
                <FieldLabel htmlFor="shelfLifeDays" label={t('rawMaterials.fields.shelfLifeDays')} required />
                <Input
                  id="shelfLifeDays"
                  type="number"
                  {...register('shelfLifeDays', { valueAsNumber: true, required: perishable })}
                  className="h-12 text-base"
                  placeholder="7"
                />
                {errors.shelfLifeDays && <p className="text-xs text-destructive mt-1">{t('validation.required')}</p>}
              </div>
            )}
          </div>
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
