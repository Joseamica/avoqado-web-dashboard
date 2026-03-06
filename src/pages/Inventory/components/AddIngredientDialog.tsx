import { useState, useEffect, useMemo } from 'react'
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
import { Switch } from '@/components/ui/switch'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useDebounce } from '@/hooks/useDebounce'
import { useToast } from '@/hooks/use-toast'
import { useUnitTranslation } from '@/hooks/use-unit-translation'
import { recipesApi, rawMaterialsApi, type RawMaterial } from '@/services/inventory.service'
import { getModifierGroups } from '@/services/menu.service'
import { Loader2, Search, RefreshCw, Plus, Package, ChevronDown, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Currency } from '@/utils/currency'
import { ScrollArea } from '@/components/ui/scroll-area'
import { QuickCreateRawMaterialSheet } from './QuickCreateRawMaterialSheet'
import { FilterPill } from '@/components/filters/FilterPill'
import { CheckboxFilterContent } from '@/components/filters/CheckboxFilterContent'

interface ProductWithRecipe {
  id: string
  name: string
}

interface ModifierGroup {
  id: string
  name: string
  modifiers?: Array<{
    id: string
    name: string
    rawMaterialId?: string | null
    inventoryMode?: string | null
  }>
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
    isVariable?: boolean
    linkedModifierGroupId?: string | null
    linkedModifierGroupName?: string
  }) => void
}

interface AddIngredientForm {
  rawMaterialId: string
  quantity: number
  unit: string
  isOptional: boolean
  substituteNotes?: string
  isVariable: boolean
  linkedModifierGroupId: string | null
}

// Emoji map for raw material categories
const CATEGORY_EMOJIS: Record<string, string> = {
  MEAT: '🥩',
  POULTRY: '🍗',
  SEAFOOD: '🦐',
  DAIRY: '🥛',
  CHEESE: '🧀',
  EGGS: '🥚',
  VEGETABLES: '🥬',
  FRUITS: '🍎',
  GRAINS: '🌾',
  BREAD: '🍞',
  PASTA: '🍝',
  RICE: '🍚',
  BEANS: '🫘',
  SPICES: '🧂',
  HERBS: '🌿',
  OILS: '🫒',
  SAUCES: '🥫',
  CONDIMENTS: '🍯',
  BEVERAGES: '🥤',
  ALCOHOL: '🍷',
  CLEANING: '🧹',
  PACKAGING: '📦',
  OTHER: '📋',
}

const getCategoryEmoji = (category: string | null | undefined): string => {
  if (!category) return '📋'
  return CATEGORY_EMOJIS[category] || '📋'
}

export function AddIngredientDialog({ open, onOpenChange, product, mode, onAddTempIngredient }: AddIngredientDialogProps) {
  const { t } = useTranslation('inventory')
  const { t: tCommon } = useTranslation('common')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { formatUnit } = useUnitTranslation()
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [selectedRawMaterial, setSelectedRawMaterial] = useState<RawMaterial | null>(null)
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'price-asc' | 'price-desc'>('name-asc')

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
      quantity: undefined,
      unit: '',
      isOptional: false,
      substituteNotes: '',
      isVariable: false,
      linkedModifierGroupId: null,
    },
  })

  const isOptional = watch('isOptional')
  const isVariable = watch('isVariable')
  const linkedModifierGroupId = watch('linkedModifierGroupId')
  const quantity = watch('quantity')

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

  // Get unique categories from raw materials
  const categoryOptions = useMemo(() => {
    if (!rawMaterials) return []
    const categories = [...new Set(rawMaterials.map(m => m.category).filter(Boolean))]
    return categories.map(cat => ({
      value: cat,
      label: t(`rawMaterials.categories.${cat}`, cat),
    }))
  }, [rawMaterials, t])

  // Filter and sort raw materials
  const filteredRawMaterials = useMemo(() => {
    if (!rawMaterials) return []

    // Filter by category
    const filtered = categoryFilter.length === 0
      ? rawMaterials
      : rawMaterials.filter(m => categoryFilter.includes(m.category))

    // Sort
    const sortedMaterials = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name)
        case 'name-desc':
          return b.name.localeCompare(a.name)
        case 'price-asc':
          return Number(a.costPerUnit) - Number(b.costPerUnit)
        case 'price-desc':
          return Number(b.costPerUnit) - Number(a.costPerUnit)
        default:
          return 0
      }
    })

    return sortedMaterials
  }, [rawMaterials, categoryFilter, sortBy])

  // Get active category label for FilterPill
  const activeCategoryLabel = useMemo(() => {
    if (categoryFilter.length === 0) return null
    if (categoryFilter.length === 1) {
      return t(`rawMaterials.categories.${categoryFilter[0]}`, categoryFilter[0])
    }
    return `${categoryFilter.length} ${t('rawMaterials.filters.selected', 'seleccionadas')}`
  }, [categoryFilter, t])

  // Fetch modifier groups for variable ingredient linking
  const { data: modifierGroups, isLoading: modifierGroupsLoading } = useQuery({
    queryKey: ['modifier-groups', venueId],
    queryFn: async () => {
      const response = await getModifierGroups(venueId)
      return response as ModifierGroup[]
    },
    enabled: !!venueId && open && isVariable,
  })

  const substitutionModifierGroups =
    modifierGroups?.filter(group => group.modifiers?.some(m => m.inventoryMode === 'SUBSTITUTION' && m.rawMaterialId)) || []

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      reset({
        rawMaterialId: '',
        quantity: undefined,
        unit: '',
        isOptional: false,
        substituteNotes: '',
        isVariable: false,
        linkedModifierGroupId: null,
      })
      setSelectedRawMaterial(null)
      setSearchTerm('')
      setAdvancedOpen(false)
      setCategoryFilter([])
      setSortBy('name-asc')
    }
  }, [open, reset])

  // Update unit when raw material is selected
  useEffect(() => {
    if (selectedRawMaterial) {
      setValue('unit', selectedRawMaterial.unit)
    }
  }, [selectedRawMaterial, setValue])

  // Reset linkedModifierGroupId when isVariable is turned off
  useEffect(() => {
    if (!isVariable) {
      setValue('linkedModifierGroupId', null)
    }
  }, [isVariable, setValue])

  // Add ingredient mutation
  const addIngredientMutation = useMutation({
    mutationFn: (data: Omit<AddIngredientForm, 'rawMaterialId'> & { rawMaterialId: string }) =>
      recipesApi.addLine(venueId, product.id, {
        ...data,
        linkedModifierGroupId: data.linkedModifierGroupId || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-with-recipes', venueId] })
      queryClient.invalidateQueries({ queryKey: ['recipe', venueId, product.id] })
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

    const selectedGroup = modifierGroups?.find(g => g.id === data.linkedModifierGroupId)

    const ingredientData = {
      rawMaterialId: selectedRawMaterial.id,
      quantity: data.quantity,
      unit: data.unit,
      isOptional: data.isOptional,
      substituteNotes: data.substituteNotes || undefined,
      isVariable: data.isVariable,
      linkedModifierGroupId: data.linkedModifierGroupId || null,
    }

    if (mode === 'create') {
      onAddTempIngredient?.({
        ...ingredientData,
        rawMaterialName: selectedRawMaterial.name,
        linkedModifierGroupName: selectedGroup?.name,
      })
      toast({
        title: t('recipes.messages.ingredientAdded'),
        variant: 'default',
      })
      onOpenChange(false)
      reset()
      setSelectedRawMaterial(null)
    } else {
      addIngredientMutation.mutate(ingredientData)
    }
  }

  const handleSelectRawMaterial = (material: RawMaterial) => {
    setSelectedRawMaterial(material)
    setValue('rawMaterialId', material.id)
    setValue('unit', material.unit)
  }

  const handleClearSelection = () => {
    setSelectedRawMaterial(null)
    setValue('rawMaterialId', '')
    setValue('unit', '')
    setValue('quantity', undefined)
    setSearchTerm('')
  }

  const estimatedCost = selectedRawMaterial && quantity ? Number(selectedRawMaterial.costPerUnit) * Number(quantity) : 0

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('recipes.addIngredient')}</DialogTitle>
            <DialogDescription>{product.name}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 space-y-4">
            {/* Step 1: Select Ingredient */}
            {!selectedRawMaterial ? (
              <div className="flex-1 flex flex-col min-h-0 space-y-3">
                {/* Search and Filters Row */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('rawMaterials.filters.search')}
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-10 h-9"
                      autoFocus
                    />
                    {searchTerm !== debouncedSearchTerm && (
                      <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {/* Category Filter */}
                  {categoryOptions.length > 0 && (
                    <FilterPill
                      label={t('rawMaterials.fields.category')}
                      isActive={categoryFilter.length > 0}
                      activeLabel={activeCategoryLabel}
                      onClear={() => setCategoryFilter([])}
                    >
                      <CheckboxFilterContent
                        title={t('rawMaterials.fields.category')}
                        options={categoryOptions}
                        selectedValues={categoryFilter}
                        onApply={setCategoryFilter}
                        searchable={categoryOptions.length > 6}
                        searchPlaceholder={t('rawMaterials.searchCategory')}
                      />
                    </FilterPill>
                  )}

                  {/* Sort Dropdown */}
                  <Select value={sortBy} onValueChange={(value: typeof sortBy) => setSortBy(value)}>
                    <SelectTrigger className="h-8 w-auto gap-1.5 rounded-full border-dashed px-3 text-sm font-normal">
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="hidden sm:inline">
                        {sortBy === 'name-asc' && 'A → Z'}
                        {sortBy === 'name-desc' && 'Z → A'}
                        {sortBy === 'price-asc' && `${t('rawMaterials.fields.costPerUnit', 'Precio')} ↑`}
                        {sortBy === 'price-desc' && `${t('rawMaterials.fields.costPerUnit', 'Precio')} ↓`}
                      </span>
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectItem value="name-asc">
                        <div className="flex items-center gap-2">
                          <ArrowUp className="h-3.5 w-3.5" />
                          <span>{t('common:sortAZ', 'Nombre A → Z')}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="name-desc">
                        <div className="flex items-center gap-2">
                          <ArrowDown className="h-3.5 w-3.5" />
                          <span>{t('common:sortZA', 'Nombre Z → A')}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="price-asc">
                        <div className="flex items-center gap-2">
                          <ArrowUp className="h-3.5 w-3.5" />
                          <span>{t('common:sortPriceAsc', 'Precio menor a mayor')}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="price-desc">
                        <div className="flex items-center gap-2">
                          <ArrowDown className="h-3.5 w-3.5" />
                          <span>{t('common:sortPriceDesc', 'Precio mayor a menor')}</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Results count */}
                {!materialsLoading && filteredRawMaterials.length > 0 && (
                  <p className="text-xs text-muted-foreground px-1">
                    {filteredRawMaterials.length} {t('rawMaterials.title', 'ingredientes').toLowerCase()}
                    {categoryFilter.length > 0 && ` · ${categoryFilter.length} ${t('rawMaterials.filters.selected', 'categorías')}`}
                  </p>
                )}

                {/* Ingredient List */}
                <div className="flex-1 min-h-0 rounded-lg border border-border overflow-hidden">
                  <ScrollArea className="h-[380px]">
                    {materialsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredRawMaterials.length > 0 ? (
                      <div className="p-1.5">
                        {filteredRawMaterials.map(material => (
                          <button
                            key={material.id}
                            type="button"
                            onClick={() => handleSelectRawMaterial(material)}
                            className="w-full p-3 rounded-lg hover:bg-accent/50 transition-colors text-left group"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                  <span className="mr-1.5">{getCategoryEmoji(material.category)}</span>
                                  {material.name}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span className="font-mono">{material.sku}</span>
                                  <span>·</span>
                                  <span>{formatUnit(material.unit)}</span>
                                  {material.category && (
                                    <>
                                      <span>·</span>
                                      <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">
                                        {t(`rawMaterials.categories.${material.category}`, material.category)}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-semibold">{Currency(Number(material.costPerUnit))}</p>
                                <p className="text-xs text-muted-foreground">
                                  {Number(material.currentStock).toFixed(2)} {formatUnit(material.unit)}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 space-y-3">
                        <div className="p-3 rounded-full bg-muted">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">{t('rawMaterials.notFound')}</p>
                        {debouncedSearchTerm.trim().length > 0 && (
                          <Button type="button" variant="outline" size="sm" onClick={() => setQuickCreateOpen(true)} className="gap-1.5">
                            <Plus className="h-4 w-4" />
                            {t('rawMaterials.quickCreate', { name: debouncedSearchTerm })}
                          </Button>
                        )}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            ) : (
              /* Step 2: Configure Quantity */
              <div className="flex-1 space-y-5">
                {/* Selected Ingredient Card */}
                <div className="flex items-center gap-3 p-4 rounded-xl border border-primary/30 bg-primary/5">
                  <div className="text-2xl">
                    {getCategoryEmoji(selectedRawMaterial.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{selectedRawMaterial.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{Currency(Number(selectedRawMaterial.costPerUnit))} / {formatUnit(selectedRawMaterial.unit)}</span>
                      {selectedRawMaterial.category && (
                        <>
                          <span>·</span>
                          <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">
                            {t(`rawMaterials.categories.${selectedRawMaterial.category}`, selectedRawMaterial.category)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 cursor-pointer" onClick={handleClearSelection}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Quantity + Cost Row */}
                <div className="space-y-2">
                  <Label htmlFor="quantity">{t('recipes.ingredients.quantity')} *</Label>
                  <div className="relative">
                    <Input
                      id="quantity"
                      type="number"
                      step="0.01"
                      placeholder="0"
                      className="text-lg h-11 pr-24"
                      autoFocus
                      {...register('quantity', { required: true, valueAsNumber: true, min: 0.01 })}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground pointer-events-none">
                      {formatUnit(selectedRawMaterial.unit)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {t('recipes.preview.currentStock', 'Stock actual')}: {Number(selectedRawMaterial.currentStock).toFixed(2)} {formatUnit(selectedRawMaterial.unit)}
                      {quantity > 0 && Number(selectedRawMaterial.currentStock) < quantity && (
                        <span className="text-amber-600 dark:text-amber-400 font-medium ml-1.5">
                          — {t('recipes.preview.lowStock', 'Stock bajo')}
                        </span>
                      )}
                    </span>
                    {estimatedCost > 0 && (
                      <span>
                        {t('recipes.ingredients.cost')}: <span className="font-semibold text-foreground">{Currency(estimatedCost)}</span>
                      </span>
                    )}
                  </div>
                  {errors.quantity && <p className="text-xs text-destructive">{t('validation.requiredMinValue', { value: '0.01' })}</p>}
                </div>

                {/* Optional */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isOptional"
                    checked={isOptional}
                    onCheckedChange={checked => setValue('isOptional', checked as boolean)}
                    className="cursor-pointer"
                  />
                  <Label htmlFor="isOptional" className="cursor-pointer text-sm">
                    {t('recipes.ingredients.optional')}
                  </Label>
                </div>

                {/* Substitute Notes */}
                <div className="space-y-2">
                  <Label htmlFor="substituteNotes" className="text-sm">
                    {t('recipes.ingredients.substituteNotes')}
                  </Label>
                  <Textarea id="substituteNotes" rows={2} {...register('substituteNotes')} placeholder={t('recipes.ingredients.substituteNotesPlaceholder', 'Ej: Se puede reemplazar por...')} />
                </div>

                {/* Variable Ingredient — Collapsible */}
                <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>{t('recipes.ingredients.variableIngredient', 'Ingrediente Variable')}</span>
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-input">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">
                          {t('recipes.ingredients.variableIngredient', 'Ingrediente Variable')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('recipes.ingredients.variableIngredientDesc', 'Permite a los clientes sustituir este ingrediente')}
                        </p>
                      </div>
                      <Switch id="isVariable" checked={isVariable} onCheckedChange={checked => setValue('isVariable', checked)} />
                    </div>

                    {isVariable && (
                      <div className="space-y-2">
                        <Label className="text-xs">{t('recipes.ingredients.linkedModifierGroup', 'Grupo de Modificadores')}</Label>
                        <Select value={linkedModifierGroupId || ''} onValueChange={value => setValue('linkedModifierGroupId', value || null)}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder={t('recipes.ingredients.selectModifierGroup', 'Seleccionar grupo...')} />
                          </SelectTrigger>
                          <SelectContent>
                            {modifierGroupsLoading ? (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-4 w-4 animate-spin" />
                              </div>
                            ) : substitutionModifierGroups.length > 0 ? (
                              substitutionModifierGroups.map(group => (
                                <SelectItem key={group.id} value={group.id}>
                                  {group.name}
                                </SelectItem>
                              ))
                            ) : (
                              <div className="px-2 py-4 text-xs text-muted-foreground text-center">
                                {t('recipes.ingredients.noSubstitutionGroups', 'No hay grupos con modificadores de sustitución')}
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}

            <DialogFooter className="mt-4 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={addIngredientMutation.isPending}>
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={!selectedRawMaterial || addIngredientMutation.isPending}>
                {addIngredientMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tCommon('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <QuickCreateRawMaterialSheet
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        initialName={debouncedSearchTerm}
        onSuccess={material => {
          handleSelectRawMaterial(material)
          setSearchTerm('')
        }}
      />
    </>
  )
}
