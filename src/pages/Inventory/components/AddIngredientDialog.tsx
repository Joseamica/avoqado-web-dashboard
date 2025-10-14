import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { recipesApi, rawMaterialsApi, type RawMaterial } from '@/services/inventory.service'
import { Loader2, Search } from 'lucide-react'
import { Currency } from '@/utils/currency'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ProductWithRecipe {
  id: string
  name: string
}

interface AddIngredientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: ProductWithRecipe
  mode: 'create' | 'edit'
  onAddTempIngredient?: (ingredient: {
    rawMaterialId: string
    rawMaterialName?: string
    quantity: number
    unit: string
    isOptional?: boolean
    substituteNotes?: string
  }) => void
}

interface AddIngredientForm {
  rawMaterialId: string
  quantity: number
  unit: string
  isOptional: boolean
  substituteNotes?: string
}

export function AddIngredientDialog({ open, onOpenChange, product, mode, onAddTempIngredient }: AddIngredientDialogProps) {
  const { t } = useTranslation('inventory')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedRawMaterial, setSelectedRawMaterial] = useState<RawMaterial | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AddIngredientForm>({
    defaultValues: {
      rawMaterialId: '',
      quantity: 0,
      unit: '',
      isOptional: false,
      substituteNotes: '',
    },
  })

  const isOptional = watch('isOptional')

  // Debounce search term to reduce API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 400) // Wait 400ms after user stops typing

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
    enabled: !!venueId && open,
  })

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      reset({
        rawMaterialId: '',
        quantity: 0,
        unit: '',
        isOptional: false,
        substituteNotes: '',
      })
      setSelectedRawMaterial(null)
      setSearchTerm('')
      setDebouncedSearchTerm('')
    }
  }, [open, reset])

  // Update unit when raw material is selected
  useEffect(() => {
    if (selectedRawMaterial) {
      setValue('unit', selectedRawMaterial.unit)
    }
  }, [selectedRawMaterial, setValue])

  // Add ingredient mutation
  const addIngredientMutation = useMutation({
    mutationFn: (data: Omit<AddIngredientForm, 'rawMaterialId'> & { rawMaterialId: string }) =>
      recipesApi.addLine(venueId, product.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-with-recipes', venueId] })
      queryClient.invalidateQueries({ queryKey: ['recipe', venueId, product.id] })
      // Invalidate raw materials to update usage count
      queryClient.invalidateQueries({ queryKey: ['rawMaterials', venueId] })
      toast({
        title: t('recipes.messages.ingredientAdded'),
        variant: 'default',
      })
      onOpenChange(false)
      reset()
      setSelectedRawMaterial(null)
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to add ingredient',
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (data: AddIngredientForm) => {
    if (!selectedRawMaterial) {
      toast({
        title: 'Error',
        description: 'Please select a raw material',
        variant: 'destructive',
      })
      return
    }

    const ingredientData = {
      rawMaterialId: selectedRawMaterial.id,
      quantity: data.quantity,
      unit: data.unit,
      isOptional: data.isOptional,
      substituteNotes: data.substituteNotes || undefined,
    }

    if (mode === 'create') {
      // For create mode, just add to temp array with raw material name
      onAddTempIngredient?.({
        ...ingredientData,
        rawMaterialName: selectedRawMaterial.name,
      })
      toast({
        title: t('recipes.messages.ingredientAdded'),
        variant: 'default',
      })
      onOpenChange(false)
      reset()
      setSelectedRawMaterial(null)
    } else {
      // For edit mode, call API
      addIngredientMutation.mutate(ingredientData)
    }
  }

  const handleSelectRawMaterial = (material: RawMaterial) => {
    setSelectedRawMaterial(material)
    setValue('rawMaterialId', material.id)
    setValue('unit', material.unit)
  }

  const estimatedCost = selectedRawMaterial && watch('quantity')
    ? Number(selectedRawMaterial.costPerUnit) * Number(watch('quantity'))
    : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{t('recipes.addIngredient')}</DialogTitle>
          <DialogDescription>{product.name}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Search Raw Materials */}
          <div className="space-y-2">
            <Label>{t('recipes.ingredients.ingredient')} *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('rawMaterials.filters.search')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              {searchTerm !== debouncedSearchTerm && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Selected Raw Material Display */}
            {selectedRawMaterial && (
              <div className="p-3 rounded-lg border border-border bg-primary/5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{selectedRawMaterial.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('rawMaterials.fields.currentStock')}: {Number(selectedRawMaterial.currentStock).toFixed(2)} {selectedRawMaterial.unit} · {Currency(Number(selectedRawMaterial.costPerUnit))} / {selectedRawMaterial.unit}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedRawMaterial(null)
                      setValue('rawMaterialId', '')
                    }}
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            )}

            {/* Raw Materials List */}
            {!selectedRawMaterial && (
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
                            <p className="text-xs text-muted-foreground">{material.sku} · {material.unit}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-foreground">{Currency(Number(material.costPerUnit))}</p>
                            <p className="text-xs text-muted-foreground">{Number(material.currentStock).toFixed(2)} {material.unit}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
                  </div>
                )}
              </ScrollArea>
            )}
          </div>

          {/* Quantity and Unit */}
          {selectedRawMaterial && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">{t('recipes.ingredients.quantity')} *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    {...register('quantity', { required: true, valueAsNumber: true, min: 0.01 })}
                  />
                  {errors.quantity && <p className="text-xs text-destructive">Required (min: 0.01)</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit">{t('recipes.ingredients.unit')} *</Label>
                  <Input id="unit" {...register('unit', { required: true })} readOnly />
                </div>
              </div>

              {/* Estimated Cost */}
              {estimatedCost > 0 && (
                <div className="p-3 rounded-lg bg-muted border border-border">
                  <p className="text-xs text-muted-foreground">{t('recipes.ingredients.cost')}</p>
                  <p className="text-lg font-bold text-foreground">{Currency(estimatedCost)}</p>
                </div>
              )}

              {/* Optional Ingredient */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isOptional"
                  checked={isOptional}
                  onCheckedChange={checked => setValue('isOptional', checked as boolean)}
                />
                <Label htmlFor="isOptional" className="cursor-pointer">
                  {t('recipes.ingredients.optional')}
                </Label>
              </div>

              {/* Substitute Notes */}
              <div className="space-y-2">
                <Label htmlFor="substituteNotes">{t('recipes.ingredients.substituteNotes')}</Label>
                <Textarea
                  id="substituteNotes"
                  rows={2}
                  {...register('substituteNotes')}
                  placeholder={t('recipes.ingredients.substituteNotes')}
                />
              </div>
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={addIngredientMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!selectedRawMaterial || addIngredientMutation.isPending}>
              {addIngredientMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
