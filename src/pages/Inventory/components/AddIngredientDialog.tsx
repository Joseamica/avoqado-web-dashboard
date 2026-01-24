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
import { useToast } from '@/hooks/use-toast'
import { useUnitTranslation } from '@/hooks/use-unit-translation'
import { recipesApi, rawMaterialsApi, type RawMaterial } from '@/services/inventory.service'
import { getModifierGroups } from '@/services/menu.service'
import { Loader2, Search, RefreshCw, Plus, Package, ChevronDown, X, ArrowUpDown, ArrowUp, ArrowDown, Sparkles, Layers, Box } from 'lucide-react'
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
  const { t: tMenu } = useTranslation('menu')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { formatUnit } = useUnitTranslation()
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
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
      setDebouncedSearchTerm('')
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
    setValue('quantity', undefined as any)
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
              <div className="flex-1 space-y-4">
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

                {/* Quantity Input - Main Focus */}
                <div className="space-y-2">
                  <Label htmlFor="quantity">{t('recipes.ingredients.quantity')} *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="quantity"
                      type="number"
                      step="0.01"
                      placeholder="0"
                      className="flex-1 text-lg h-11"
                      autoFocus
                      {...register('quantity', { required: true, valueAsNumber: true, min: 0.01 })}
                    />
                    <div className="flex items-center px-4 rounded-md border border-input bg-muted text-sm font-medium min-w-[100px] justify-center h-11">
                      {formatUnit(selectedRawMaterial.unit)}
                    </div>
                  </div>
                  {errors.quantity && <p className="text-xs text-destructive">{t('validation.requiredMinValue', { value: '0.01' })}</p>}
                </div>

                {/* Optional Checkbox */}
                <div className="flex items-center space-x-2 py-1 cursor-pointer" onClick={() => setValue('isOptional', !isOptional)}>
                  <Checkbox
                    id="isOptional"
                    checked={isOptional}
                    onCheckedChange={checked => setValue('isOptional', checked as boolean)}
                    onClick={e => e.stopPropagation()}
                    className="cursor-pointer"
                  />
                  <Label htmlFor="isOptional" className="cursor-pointer text-sm">
                    {t('recipes.ingredients.optional')}
                  </Label>
                </div>

                {/* Advanced Options - Collapsible */}
                <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
                      <span>{t('common:advancedOptions', { defaultValue: 'Opciones avanzadas' })}</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 pt-2">
                    {/* Variable Ingredient */}
                    <div className="space-y-3 p-3 rounded-lg border border-border">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="isVariable" className="text-sm font-medium flex items-center gap-2">
                            <RefreshCw className="h-4 w-4" />
                            {t('recipes.ingredients.variableIngredient', 'Ingrediente Variable')}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {t('recipes.ingredients.variableIngredientDesc', 'Permite a los clientes sustituir este ingrediente')}
                          </p>
                        </div>
                        <Switch id="isVariable" checked={isVariable} onCheckedChange={checked => setValue('isVariable', checked)} />
                      </div>

                      {isVariable && (
                        <div className="space-y-2 pt-2 border-t">
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
                    </div>

                    {/* Substitute Notes */}
                    <div className="space-y-2">
                      <Label htmlFor="substituteNotes" className="text-sm">
                        {t('recipes.ingredients.substituteNotes')}
                      </Label>
                      <Textarea id="substituteNotes" rows={2} {...register('substituteNotes')} placeholder={t('recipes.ingredients.substituteNotes')} />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Live Preview Card */}
                <div className="rounded-xl border border-dashed bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                    <Sparkles className="h-4 w-4" />
                    <span>{t('recipes.preview.title', 'Vista previa')}</span>
                  </div>

                  <div className="space-y-3">
                    {/* Ingredient preview */}
                    <div className="flex items-start gap-3">
                      <span className="text-xl">{getCategoryEmoji(selectedRawMaterial.category)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{selectedRawMaterial.name}</p>
                        {quantity > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t('recipes.preview.uses', 'Usa')} {quantity} {formatUnit(selectedRawMaterial.unit)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Stock info */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/50 border border-border/50">
                      <Box className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{t('recipes.preview.currentStock', 'Stock actual')}:</span>
                      <span className="text-xs font-semibold">
                        {Number(selectedRawMaterial.currentStock).toFixed(2)} {formatUnit(selectedRawMaterial.unit)}
                      </span>
                      {quantity > 0 && Number(selectedRawMaterial.currentStock) < quantity && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium ml-auto">
                          ⚠️ {t('recipes.preview.lowStock', 'Stock bajo')}
                        </span>
                      )}
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-2">
                      {isOptional && (
                        <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                          {t('recipes.ingredients.optional')}
                        </span>
                      )}
                      {isVariable && (
                        <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <RefreshCw className="h-3 w-3" />
                          {t('recipes.ingredients.variableIngredient', 'Variable')}
                        </span>
                      )}
                    </div>

                    {/* Linked modifier group preview */}
                    {isVariable && linkedModifierGroupId && (
                      <div className="space-y-2 pt-2 border-t border-dashed">
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5" />
                          {t('recipes.preview.linkedGroup', 'Grupo vinculado')}:
                        </p>
                        <div className="rounded-lg border px-3 py-2 bg-background/50">
                          <p className="text-sm font-medium">
                            {modifierGroups?.find(g => g.id === linkedModifierGroupId)?.name || '...'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t('recipes.preview.customerCanSubstitute', 'El cliente podrá sustituir este ingrediente')}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Cost preview */}
                    {estimatedCost > 0 && (
                      <div className="flex items-center justify-between pt-2 border-t border-dashed">
                        <span className="text-xs text-muted-foreground">{t('recipes.ingredients.cost')}</span>
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{Currency(estimatedCost)}</span>
                      </div>
                    )}
                  </div>
                </div>
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
          setDebouncedSearchTerm('')
        }}
      />
    </>
  )
}
