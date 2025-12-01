import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { useUnitTranslation } from '@/hooks/use-unit-translation'
import { updateModifier } from '@/services/menu.service'
import { rawMaterialsApi, type RawMaterial } from '@/services/inventory.service'
import { Currency } from '@/utils/currency'
import { useTranslation } from 'react-i18next'
import { Loader2, Search, Package, X } from 'lucide-react'
import { ModifierInventoryMode, Unit } from '@/types'

// Define form values type
type FormValues = {
  name: string
  price: number
  active: boolean
  // Inventory fields
  trackInventory: boolean
  rawMaterialId: string | null
  quantityPerUnit: number | null
  unit: string | null
  inventoryMode: ModifierInventoryMode | null
}

// Props for the EditModifier component
interface EditModifierProps {
  venueId: string
  modifierId: string
  modifierGroupId: string
  onBack: () => void
  onSuccess: () => void
  initialValues: {
    name: string
    price: number
    active: boolean
    // Inventory fields (optional - may not be present in older modifiers)
    rawMaterialId?: string | null
    rawMaterial?: {
      id: string
      name: string
      sku: string
      unit: string
      currentStock: number
      costPerUnit: number
    } | null
    quantityPerUnit?: number | null
    unit?: string | null
    inventoryMode?: ModifierInventoryMode | null
  }
}

export default function EditModifier({ venueId, modifierId, modifierGroupId, onBack, onSuccess, initialValues }: EditModifierProps) {
  const { t } = useTranslation('menu')
  const { t: tInventory } = useTranslation('inventory')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { formatUnit } = useUnitTranslation()

  // State for raw material selection
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedRawMaterial, setSelectedRawMaterial] = useState<RawMaterial | null>(null)

  // Determine if inventory tracking is enabled based on initial values
  const hasInventoryTracking = Boolean(initialValues.rawMaterialId)

  // Setup the form
  const form = useForm<FormValues>({
    defaultValues: {
      name: initialValues.name,
      price: initialValues.price,
      active: initialValues.active,
      trackInventory: hasInventoryTracking,
      rawMaterialId: initialValues.rawMaterialId || null,
      quantityPerUnit: initialValues.quantityPerUnit || null,
      unit: initialValues.unit || null,
      inventoryMode: initialValues.inventoryMode || null,
    },
  })

  const trackInventory = form.watch('trackInventory')

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Initialize form and selectedRawMaterial with the provided initial values
  useEffect(() => {
    form.reset({
      name: initialValues.name,
      price: initialValues.price,
      active: initialValues.active,
      trackInventory: Boolean(initialValues.rawMaterialId),
      rawMaterialId: initialValues.rawMaterialId || null,
      quantityPerUnit: initialValues.quantityPerUnit || null,
      unit: initialValues.unit || null,
      inventoryMode: initialValues.inventoryMode || null,
    })

    // Set selected raw material from initial values
    if (initialValues.rawMaterial) {
      setSelectedRawMaterial(initialValues.rawMaterial as RawMaterial)
    } else {
      setSelectedRawMaterial(null)
    }
  }, [initialValues, form])

  // Fetch raw materials
  const { data: rawMaterials, isLoading: materialsLoading } = useQuery({
    queryKey: ['rawMaterials', venueId, debouncedSearchTerm],
    queryFn: async () => {
      const response = await rawMaterialsApi.getAll(venueId, {
        active: true,
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
      })
      return response.data.data as RawMaterial[]
    },
    enabled: !!venueId && trackInventory,
  })

  // Reset inventory fields when tracking is disabled
  useEffect(() => {
    if (!trackInventory) {
      form.setValue('rawMaterialId', null)
      form.setValue('quantityPerUnit', null)
      form.setValue('unit', null)
      form.setValue('inventoryMode', null)
      setSelectedRawMaterial(null)
      setSearchTerm('')
    }
  }, [trackInventory, form])

  // Mutation for updating the modifier
  const updateModifierMutation = useMutation<unknown, Error, FormValues>({
    mutationFn: async formValues => {
      const payload: any = {
        name: formValues.name,
        price: formValues.price,
        active: formValues.active,
      }

      // Add inventory fields if tracking is enabled
      if (formValues.trackInventory && formValues.rawMaterialId) {
        payload.rawMaterialId = formValues.rawMaterialId
        payload.quantityPerUnit = formValues.quantityPerUnit
        payload.unit = formValues.unit
        payload.inventoryMode = formValues.inventoryMode
      } else {
        // Clear inventory fields if tracking is disabled
        payload.rawMaterialId = null
        payload.quantityPerUnit = null
        payload.unit = null
        payload.inventoryMode = null
      }

      return await updateModifier(venueId, modifierGroupId, modifierId, payload)
    },
    onSuccess: () => {
      toast({
        title: t('modifiers.editModifier.toast.updated'),
        description: t('modifiers.editModifier.toast.updatedDesc'),
      })

      // Invalidate and force refetch the relevant queries
      queryClient.invalidateQueries({
        queryKey: ['modifier-groups', venueId],
        refetchType: 'all',
      })

      queryClient.invalidateQueries({
        queryKey: ['modifier-group', modifierGroupId, venueId],
        refetchType: 'all',
      })

      queryClient.invalidateQueries({
        queryKey: ['modifiers', venueId],
        refetchType: 'all',
      })

      // Call the success callback
      onSuccess()
    },
    onError: error => {
      toast({
        title: t('modifiers.editModifier.toast.error'),
        description: t('modifiers.editModifier.toast.errorDesc', { message: error.message }),
        variant: 'destructive',
      })
    },
  })

  // Submit handler
  function onSubmit(values: FormValues) {
    updateModifierMutation.mutate(values)
  }

  const handleSelectRawMaterial = (material: RawMaterial) => {
    setSelectedRawMaterial(material)
    form.setValue('rawMaterialId', material.id)
    form.setValue('unit', material.unit)
  }

  const handleClearRawMaterial = () => {
    setSelectedRawMaterial(null)
    form.setValue('rawMaterialId', null)
    form.setValue('unit', null)
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t('modifiers.editModifier.title', 'Edit Modifier')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                rules={{ required: t('modifiers.editModifier.validation.nameRequired') }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('modifiers.editModifier.fields.name')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('modifiers.editModifier.fields.namePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="price"
                rules={{ required: t('modifiers.editModifier.validation.priceRequired') }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('modifiers.editModifier.fields.price')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={field.value}
                        onChange={e => {
                          const value = e.target.value
                          field.onChange(value === '' ? '' : parseFloat(value))
                        }}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">{t('modifiers.editModifier.fields.active')}</FormLabel>
                      <FormDescription>{t('modifiers.editModifier.fields.activeDesc')}</FormDescription>
                    </div>
                    <FormControl>
                      <div>
                        <Switch checked={field.value} onCheckedChange={field.onChange} name={field.name} ref={field.ref} />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Inventory Tracking Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {t('modifiers.inventory.title', 'Inventory Tracking')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Track Inventory Toggle */}
              <FormField
                control={form.control}
                name="trackInventory"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>{t('modifiers.inventory.trackInventory', 'Track Inventory')}</FormLabel>
                      <FormDescription>{t('modifiers.inventory.trackInventoryDesc', 'Automatically deduct raw materials when this modifier is used')}</FormDescription>
                    </div>
                    <FormControl>
                      <div>
                        <Switch checked={field.value} onCheckedChange={field.onChange} name={field.name} ref={field.ref} />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Inventory Fields - Only show when tracking is enabled */}
              {trackInventory && (
                <>
                  {/* Inventory Mode Selection */}
                  <FormField
                    control={form.control}
                    name="inventoryMode"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>{t('modifiers.inventory.mode', 'Inventory Mode')}</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value || undefined}
                            className="flex flex-col space-y-1"
                          >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value={ModifierInventoryMode.ADDITION} />
                              </FormControl>
                              <div className="space-y-0.5">
                                <FormLabel className="font-normal">{t('modifiers.inventory.modeAddition', 'Addition (Extra)')}</FormLabel>
                                <FormDescription className="text-xs">
                                  {t('modifiers.inventory.modeAdditionDesc', 'Adds extra ingredients to the order (e.g., "Extra Bacon")')}
                                </FormDescription>
                              </div>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value={ModifierInventoryMode.SUBSTITUTION} />
                              </FormControl>
                              <div className="space-y-0.5">
                                <FormLabel className="font-normal">{t('modifiers.inventory.modeSubstitution', 'Substitution')}</FormLabel>
                                <FormDescription className="text-xs">
                                  {t('modifiers.inventory.modeSubstitutionDesc', 'Replaces a recipe ingredient (e.g., "Almond Milk" instead of regular milk)')}
                                </FormDescription>
                              </div>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Raw Material Selection */}
                  <div className="space-y-2">
                    <FormLabel>{t('modifiers.inventory.rawMaterial', 'Raw Material')} *</FormLabel>

                    {/* Selected Raw Material Display */}
                    {selectedRawMaterial ? (
                      <div className="p-3 rounded-lg border border-border bg-primary/5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">{selectedRawMaterial.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {tInventory('rawMaterials.fields.currentStock')}: {Number(selectedRawMaterial.currentStock).toFixed(2)} {formatUnit(selectedRawMaterial.unit)} · {Currency(Number(selectedRawMaterial.costPerUnit))} / {formatUnit(selectedRawMaterial.unit)}
                            </p>
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={handleClearRawMaterial}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Search Input */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder={tInventory('rawMaterials.filters.search')}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                          {searchTerm !== debouncedSearchTerm && (
                            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                        </div>

                        {/* Raw Materials List */}
                        <ScrollArea className="h-[200px] rounded-lg border border-border">
                          {materialsLoading ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                          ) : rawMaterials && rawMaterials.length > 0 ? (
                            <div className="p-2 space-y-1">
                              {rawMaterials.map(material => (
                                <button
                                  key={material.id}
                                  type="button"
                                  onClick={() => handleSelectRawMaterial(material)}
                                  className="w-full p-3 rounded-lg border border-transparent hover:border-border hover:bg-accent/50 transition-colors text-left"
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium text-foreground">{material.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {material.sku} · {formatUnit(material.unit)}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-medium text-foreground">{Currency(Number(material.costPerUnit))}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {Number(material.currentStock).toFixed(2)} {formatUnit(material.unit)}
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center py-8">
                              <p className="text-sm text-muted-foreground">{tInventory('common.noData')}</p>
                            </div>
                          )}
                        </ScrollArea>
                      </>
                    )}
                  </div>

                  {/* Quantity and Unit - Only show when raw material is selected */}
                  {selectedRawMaterial && (
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="quantityPerUnit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('modifiers.inventory.quantityPerUnit', 'Quantity per modifier')}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="0.00"
                                value={field.value ?? ''}
                                onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              {t('modifiers.inventory.quantityPerUnitDesc', 'How much raw material is used per modifier')}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="unit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('modifiers.inventory.unit', 'Unit')}</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || undefined}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={t('modifiers.inventory.selectUnit', 'Select unit')} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {Object.values(Unit).map(unit => (
                                  <SelectItem key={unit} value={unit}>
                                    {formatUnit(unit)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={onBack}>
              {t('modifiers.editModifier.buttons.cancel')}
            </Button>
            <Button type="submit" disabled={updateModifierMutation.isPending || !form.formState.isDirty}>
              {updateModifierMutation.isPending ? t('modifiers.editModifier.buttons.saving') : t('modifiers.editModifier.buttons.save')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
