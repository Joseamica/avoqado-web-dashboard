import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { createModifier as createModifierService } from '@/services/menu.service'
import { rawMaterialsApi, type RawMaterial } from '@/services/inventory.service'
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
import { Currency } from '@/utils/currency'
import { Loader2, Search, Package, X } from 'lucide-react'
import { ModifierInventoryMode, Unit } from '@/types'

// Schema for the form validation
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

// Schema will be created inside component to access t() function
const createFormSchema = (t: any) =>
  z.object({
    name: z.string().min(1, { message: t('modifiers.create.nameRequired') }),
    price: z.number().min(0).default(0),
    active: z.boolean().default(true),
    // Inventory fields
    trackInventory: z.boolean().default(false),
    rawMaterialId: z.string().nullable().default(null),
    quantityPerUnit: z.number().positive().nullable().default(null),
    unit: z.string().nullable().default(null),
    inventoryMode: z.nativeEnum(ModifierInventoryMode).nullable().default(null),
  })

interface CreateModifierProps {
  venueId: string
  modifierGroupId: string
  onBack: () => void
  onSuccess: () => void
}

export default function CreateModifier({ venueId, modifierGroupId, onBack, onSuccess }: CreateModifierProps) {
  const { t } = useTranslation('menu')
  const { t: tInventory } = useTranslation('inventory')
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { formatUnit } = useUnitTranslation()

  // State for raw material selection
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedRawMaterial, setSelectedRawMaterial] = useState<RawMaterial | null>(null)

  // Initialize the form with default values
  const form = useForm<FormValues>({
    resolver: zodResolver(createFormSchema(t)),
    defaultValues: {
      name: '',
      price: 0,
      active: true,
      trackInventory: false,
      rawMaterialId: null,
      quantityPerUnit: null,
      unit: null,
      inventoryMode: null,
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

  // Update unit when raw material is selected
  useEffect(() => {
    if (selectedRawMaterial) {
      form.setValue('unit', selectedRawMaterial.unit)
    }
  }, [selectedRawMaterial, form])

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

  // For creating the modifier
  const createModifierMutation = useMutation<unknown, Error, FormValues>({
    mutationFn: async formValues => {
      // Create the modifier with inventory fields
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
      }

      return await createModifierService(venueId, modifierGroupId, payload)
    },
    onSuccess: _data => {
      toast({
        title: t('modifiers.create.toasts.created'),
        description: t('modifiers.create.toasts.createdDesc'),
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

      // Call the success callback (without arguments as defined in the interface)
      onSuccess()
    },
    onError: error => {
      toast({
        title: t('modifiers.create.toasts.createError'),
        description: error.message || t('modifiers.create.toasts.createErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  // Handle form submission
  function onSubmit(values: FormValues) {
    createModifierMutation.mutate(values)
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
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('modifiers.create.cardTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name field */}
              <FormField
                control={form.control}
                name="name"
                rules={{ required: { value: true, message: t('modifiers.create.nameRequired') } }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('forms.name')}</FormLabel>
                    <FormControl>
                      <div>
                        <Input placeholder={t('modifiers.create.namePlaceholder')} {...field} />
                      </div>
                    </FormControl>
                    <FormDescription>{t('modifiers.create.nameDescription')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Price field */}
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('modifiers.editModifier.fields.price')}</FormLabel>
                    <FormControl>
                      <div>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={field.value}
                          onChange={e => field.onChange(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Active field */}
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>{t('modifiers.create.active')}</FormLabel>
                      <FormDescription>{t('modifiers.create.activeDescription')}</FormDescription>
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

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onBack}>
              {t('forms.buttons.cancel')}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
              {form.formState.isSubmitting ? t('modifiers.create.creating') : t('modifiers.create.createButton')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
