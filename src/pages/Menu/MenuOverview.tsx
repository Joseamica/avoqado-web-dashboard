import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import * as menuService from '@/services/menu.service'
import { Menu, MenuCategory, Product } from '@/types'
import { Active, closestCenter, DndContext, DragOverlay, KeyboardSensor, Over, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, GripVertical, Image as ImageIcon, Search, Info } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

// Skeleton Components
function SkeletonProduct() {
  return (
    <div className="flex items-center p-2 my-1 rounded-md animate-pulse">
      <div className="p-1 mr-2">
        <div className="w-4 h-4 bg-muted rounded"></div>
      </div>
      <div className="w-12 h-12 bg-muted rounded-md mr-4"></div>
      <div className="font-medium flex-grow">
        <div className="h-4 bg-muted rounded w-3/4 mb-1"></div>
      </div>
      <div className="ml-auto">
        <div className="w-24 h-8 bg-muted rounded"></div>
      </div>
    </div>
  )
}

function SkeletonCategory() {
  return (
    <div className="p-2 rounded-lg bg-muted/50 animate-pulse">
      <div className="flex items-center mb-2">
        <div className="p-1 mr-2">
          <div className="w-5 h-5 bg-muted rounded"></div>
        </div>
        <div className="h-5 bg-muted rounded w-1/3"></div>
      </div>
      <div className="pl-8 space-y-2">
        <SkeletonProduct />
        <SkeletonProduct />
        <SkeletonProduct />
      </div>
    </div>
  )
}

function SkeletonMenu() {
  return (
    <div className="mb-8 rounded-xl border-border bg-card animate-pulse">
      <header className="flex items-center p-4 rounded-t-xl bg-card">
        <div className="p-1 mr-2">
          <div className="w-6 h-6 bg-muted rounded"></div>
        </div>
        <div className="h-6 bg-muted rounded w-1/4 flex-grow"></div>
        <div className="flex items-center space-x-4">
          <div className="w-10 h-5 bg-muted rounded-full"></div>
          <div className="w-8 h-8 bg-muted rounded"></div>
        </div>
      </header>
      <div className="p-4 border-t-2 border-dashed">
        <SkeletonCategory />
        <SkeletonCategory />
      </div>
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="p-6">
      {/* Header skeleton */}
      <div className="flex justify-between items-center mb-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-1/4"></div>
        <div className="flex items-center space-x-2">
          <div className="w-24 h-10 bg-muted rounded"></div>
          <div className="w-24 h-10 bg-muted rounded"></div>
        </div>
      </div>

      {/* Search and controls skeleton */}
      <div className="flex items-center space-x-4 mb-6 animate-pulse">
        <div className="relative flex-grow">
          <div className="w-full h-10 bg-muted rounded pl-10"></div>
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-muted rounded"></div>
        </div>
        <div className="w-24 h-10 bg-muted rounded"></div>
        <div className="w-24 h-10 bg-muted rounded"></div>
        <div className="w-8 h-10 bg-muted rounded"></div>
      </div>

      {/* Content skeleton */}
      <div className="space-y-4">
        <SkeletonMenu />
        <SkeletonMenu />
        <SkeletonMenu />
      </div>
    </div>
  )
}
function SortableProduct({
  product,
  editedPrices,
  handlePriceChange,
  handlePriceBlur,
  imageErrors,
  setImageErrors,
}: {
  product: Product
  editedPrices: Record<string, string>
  handlePriceChange: (id: string, value: string) => void
  handlePriceBlur: (id: string, value: string) => void
  imageErrors: Record<string, boolean>
  setImageErrors: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: product.id,
    data: { type: 'product', categoryId: product.categoryId },
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center p-2 my-1 rounded-md hover:bg-muted ${
        isDragging ? 'shadow-lg z-30' : 'z-20'
      } cursor-grab active:cursor-grabbing relative pointer-events-auto`}
    >
      <div className="p-1 mr-2 text-muted-foreground hover:text-foreground transition-colors" {...attributes} {...listeners}>
        <GripVertical size={18} />
      </div>
      <div className="w-12 h-12 bg-muted rounded-md mr-4 flex items-center justify-center">
        {product.imageUrl && !imageErrors[product.id] ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover rounded-md"
            onError={() => setImageErrors(prev => ({ ...prev, [product.id]: true }))}
          />
        ) : (
          <ImageIcon className="text-muted-foreground" size={24} />
        )}
      </div>
      <div className="font-medium text-foreground flex-grow">{product.name}</div>
      <div className="ml-auto flex items-center space-x-4 pointer-events-auto">
        <Input
          type="text"
          value={editedPrices[product.id] ?? (product.price / 100).toFixed(2)}
          onChange={e => handlePriceChange(product.id, e.target.value)}
          onBlur={e => handlePriceBlur(product.id, e.target.value)}
          className="w-24 text-right"
          onClick={e => e.stopPropagation()} // Prevent drag from starting on click
        />
        {/* Add more actions if needed */}
      </div>
    </div>
  )
}



export default function Overview() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { venueId, venueSlug } = useCurrentVenue()
  const queryClient = useQueryClient()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [menuOrder, setMenuOrder] = useState<string[]>([])
  const [categoryOrders, setCategoryOrders] = useState<Record<string, string[]>>({})
  const [localProductOrder, setLocalProductOrder] = useState<Record<string, string[]>>({})
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({})
  // New: selection + view level state for Tree + Inspector layout
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  type ViewLevel = 'menus' | 'menu' | 'category'
  const viewLevel: ViewLevel = selectedCategoryId ? 'category' : selectedMenuId ? 'menu' : 'menus'
  const [editedPrices, setEditedPrices] = useState<Record<string, string>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Small distance to prevent conflicts with clicks
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const {
    data: menusData,
    isLoading: menusLoading,
    error: menusError,
  } = useQuery<Menu[], Error, Menu[]>({
    queryKey: ['menus', venueId],
    queryFn: () => menuService.getMenus(venueId!),
    enabled: !!venueId,
  })

  const {
    data: productsData,
    isLoading: productsLoading,
    error: productsError,
  } = useQuery<Product[], Error, Product[]>({
    queryKey: ['products', venueId],
    queryFn: () => menuService.getProducts(venueId!),
    enabled: !!venueId,
  })

  useEffect(() => {
    if (menusData) {
      const initialOrder = menusData.map(menu => menu.id)
      setMenuOrder(initialOrder)

      const initialCategoryOrders: Record<string, string[]> = {}
      const initialExpandedState: Record<string, boolean> = {}
      menusData.forEach(menu => {
        initialExpandedState[menu.id] = true // Default to expanded
        if (menu.categories) {
          const categoriesForMenu = menu.categories.map(mc => mc.category)
          initialCategoryOrders[menu.id] = categoriesForMenu
            .map(cat => cat.id)
            .sort((a, b) => {
              const catA = categoriesForMenu.find(c => c.id === a)
              const catB = categoriesForMenu.find(c => c.id === b)
              return (catA?.displayOrder ?? 0) - (catB?.displayOrder ?? 0)
            })
        }
      })
      setCategoryOrders(initialCategoryOrders)
      setExpandedMenus(initialExpandedState)
    }
  }, [menusData])

  useEffect(() => {
    if (productsData) {
      const initialProductOrders: Record<string, string[]> = {}
      productsData.forEach(product => {
        if (!initialProductOrders[product.categoryId]) {
          initialProductOrders[product.categoryId] = []
        }
        initialProductOrders[product.categoryId].push(product.id)
      })

      // Sort products by displayOrder for each category
      Object.keys(initialProductOrders).forEach(categoryId => {
        initialProductOrders[categoryId].sort((a, b) => {
          const productA = productsData.find(p => p.id === a)
          const productB = productsData.find(p => p.id === b)
          return (productA?.displayOrder ?? 0) - (productB?.displayOrder ?? 0)
        })
      })

      setLocalProductOrder(initialProductOrders)
    }
  }, [productsData])

  const toggleMenuActiveMutation = useMutation({
    mutationFn: ({ menuId, active }: { menuId: string; active: boolean }) => menuService.updateMenu(venueId!, menuId, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menus', venueId] })
    },
  })

  const updateMenuOrderMutation = useMutation({
    mutationFn: (orderData: { id: string; displayOrder: number }[]) => menuService.reorderMenus(venueId!, orderData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menus', venueId] })
    },
  })

  const updateCategoryOrderMutation = useMutation({
    mutationFn: (orderData: { id: string; displayOrder: number }[]) => menuService.reorderMenuCategories(venueId!, orderData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menus', venueId] })
    },
  })

  const updateProductOrderMutation = useMutation({
    mutationFn: (orderData: { id: string; displayOrder: number }[]) => menuService.reorderProducts(venueId!, orderData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
    },
  })

  const updateProductPriceMutation = useMutation({
    mutationFn: ({ productId, price }: { productId: string; price: number }) => menuService.updateProduct(venueId!, productId, { price }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
    },
  })

  const filteredMenus = useMemo(() => {
    if (!menusData) return []

    // Always sort menus by the current menuOrder first
    const sortedMenus = [...menusData].sort((a, b) => {
      const indexA = menuOrder.indexOf(a.id)
      const indexB = menuOrder.indexOf(b.id)
      return indexA - indexB
    })

    if (!searchTerm) return sortedMenus

    const lowercasedFilter = searchTerm.toLowerCase()
    return sortedMenus.filter(menu => {
      const menuNameMatch = menu.name.toLowerCase().includes(lowercasedFilter)
      const categoryMatch = menu.categories?.some(c => c.category.name.toLowerCase().includes(lowercasedFilter))
      return menuNameMatch || categoryMatch
    })
  }, [menusData, searchTerm, menuOrder])

  const getSortedCategories = useCallback(
    (menu: Menu) => {
      if (!menu.categories) return []
      const currentOrder = categoryOrders[menu.id] || []
      return [...menu.categories.map(mc => mc.category)].sort((a, b) => currentOrder.indexOf(a.id) - currentOrder.indexOf(b.id))
    },
    [categoryOrders],
  )

  const getProductsForCategory = useCallback(
    (categoryId: string) => {
      if (!productsData) return []
      const categoryProducts = productsData.filter(p => p.categoryId === categoryId)
      const currentOrder = localProductOrder[categoryId] || []
      return [...categoryProducts].sort((a, b) => currentOrder.indexOf(a.id) - currentOrder.indexOf(b.id))
    },
    [productsData, localProductOrder],
  )

  const handleDragStart = (event: { active: Active }) => {
    setActiveId(event.active.id as string)

    // If dragging a menu, collapse all and set menu drag state
    const activeType = event.active.data.current?.type
    if (activeType === 'menu') {
      // Collapse all menus when dragging
      const allCollapsed = Object.keys(expandedMenus).reduce((acc, key) => ({ ...acc, [key]: false }), {})
      setExpandedMenus(allCollapsed)
    }
  }

  const handleDragEnd = (event: { active: Active; over: Over | null }) => {
    const { active, over } = event
    setActiveId(null)

    if (over && active.id !== over.id) {
      // We use the current view level to determine what we are sorting
      if (viewLevel === 'menus') {
        setMenuOrder(order => {
          const oldIndex = order.indexOf(active.id as string)
          const newIndex = order.indexOf(over.id as string)
          if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return order
          const next = arrayMove(order, oldIndex, newIndex)
          const payload = next.map((id, index) => ({ id, displayOrder: index }))
          updateMenuOrderMutation.mutate(payload)
          return next
        })
      } else if (viewLevel === 'menu' && selectedMenuId) {
        setCategoryOrders(orders => {
          const items = orders[selectedMenuId] || []
          const oldIndex = items.indexOf(active.id as string)
          const newIndex = items.indexOf(over.id as string)
          if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return orders
          const nextItems = arrayMove(items, oldIndex, newIndex)
          const payload = nextItems.map((id, index) => ({ id, displayOrder: index }))
          updateCategoryOrderMutation.mutate(payload)
          return { ...orders, [selectedMenuId]: nextItems }
        })
      } else if (viewLevel === 'category' && selectedCategoryId) {
        setLocalProductOrder(orders => {
          const items = orders[selectedCategoryId] || []
          const oldIndex = items.indexOf(active.id as string)
          const newIndex = items.indexOf(over.id as string)
          if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return orders
          const nextItems = arrayMove(items, oldIndex, newIndex)
          const payload = nextItems.map((id, index) => ({ id, displayOrder: index }))
          updateProductOrderMutation.mutate(payload)
          return { ...orders, [selectedCategoryId]: nextItems }
        })
      }
    }
  }

  const handlePriceChange = (productId: string, value: string) => {
    setEditedPrices(prev => ({ ...prev, [productId]: value }))
  }

  const handlePriceBlur = (productId: string, value: string) => {
    const numericPrice = parseFloat(value)
    if (!isNaN(numericPrice)) {
      updateProductPriceMutation.mutate({ productId, price: Math.round(numericPrice * 100) })
    }
    setEditedPrices(prev => {
      const newPrices = { ...prev }
      delete newPrices[productId]
      return newPrices
    })
  }


  const collapseAll = () => {
    const allCollapsed = Object.keys(expandedMenus).reduce((acc, key) => ({ ...acc, [key]: false }), {})
    setExpandedMenus(allCollapsed)
  }

  const expandAll = () => {
    const allExpanded = Object.keys(expandedMenus).reduce((acc, key) => ({ ...acc, [key]: true }), {})
    setExpandedMenus(allExpanded)
  }

  // Build current center list based on selection (defined before early returns to keep hooks order stable)
  const centerItems = useMemo(() => {
    if (viewLevel === 'menus') return filteredMenus
    if (viewLevel === 'menu') {
      const menu = menusData?.find(m => m.id === selectedMenuId)
      if (!menu) return []
      return getSortedCategories(menu)
    }
    // category view
    return selectedCategoryId ? getProductsForCategory(selectedCategoryId) : []
  }, [viewLevel, filteredMenus, menusData, selectedMenuId, selectedCategoryId, getSortedCategories, getProductsForCategory])

  const centerItemIds = useMemo(() => {
    if (viewLevel === 'menus') return menuOrder
    if (viewLevel === 'menu' && selectedMenuId) return categoryOrders[selectedMenuId] || []
    if (viewLevel === 'category' && selectedCategoryId) return localProductOrder[selectedCategoryId] || []
    return []
  }, [viewLevel, menuOrder, categoryOrders, localProductOrder, selectedMenuId, selectedCategoryId])

  const filteredCenterItems = useMemo(() => {
    if (!searchTerm) return centerItems
    const q = searchTerm.toLowerCase()
    return centerItems.filter((item: any) => (item?.name || '').toLowerCase().includes(q))
  }, [centerItems, searchTerm])

  if (menusLoading || productsLoading) return <OverviewSkeleton />

  if (menusError || productsError) {
    return (
      <div className="text-red-500 p-4">
        <AlertCircle className="inline-block mr-2" />
        {t('menu.overview.errorLoading', { message: menusError?.message || productsError?.message })}
      </div>
    )
  }

  const activeItem = activeId
    ? menusData?.find(m => m.id === activeId) ||
      menusData?.flatMap(m => m.categories?.map(c => c.category)).find(c => c.id === activeId) ||
      productsData?.find(p => p.id === activeId)
    : null

  const handleSelectMenu = (menuId: string) => {
    setSelectedMenuId(menuId)
    setSelectedCategoryId(null)
  }
  const handleSelectCategory = (categoryId: string, menuId: string) => {
    setSelectedMenuId(menuId)
    setSelectedCategoryId(categoryId)
  }

  // no explicit selected item inspector for products yet; we keep simple inspector

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">{t('menu.overview.title')}</h1>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => navigate(`/venues/${venueSlug}/menumaker/categories`)}>
            {t('menu.overview.manageCategories')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>{t('menu.overview.create')}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => navigate(`/venues/${venueSlug}/menumaker/menus/create`)}>{t('menu.overview.newMenu')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/venues/${venueSlug}/menumaker/categories/create`)}>{t('menu.overview.newCategory')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/venues/${venueSlug}/menumaker/products/create`)}>
                {t('menu.overview.createNewProduct')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Global search */}
      <div className="flex items-center space-x-4 mb-4">
        <div className="relative w-full max-w-2xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('menu.overview.searchPlaceholder')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 bg-background border-input w-full"
          />
        </div>
        <Button variant="outline" onClick={expandAll}>{t('menu.overview.expandAll')}</Button>
        <Button variant="outline" onClick={collapseAll}>{t('menu.overview.collapseAll')}</Button>
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left: Tree */}
        <aside className="col-span-3 rounded-lg border p-3 bg-card">
          <div className="text-xs font-medium text-muted-foreground mb-2">Tree</div>
          <ul className="space-y-1">
            {/* All menus root to enable menu-level reordering */}
            <li>
              <button
                className={`w-full text-left px-2 py-1.5 rounded hover:bg-accent ${viewLevel === 'menus' ? 'bg-accent' : ''}`}
                onClick={() => {
                  setSelectedMenuId(null)
                  setSelectedCategoryId(null)
                }}
              >
                <span className="font-medium">All Menus</span>
              </button>
            </li>
            {filteredMenus.map(menu => (
              <li key={menu.id}>
                <button
                  className={`w-full text-left px-2 py-1.5 rounded hover:bg-accent ${selectedMenuId === menu.id && viewLevel !== 'menus' ? 'bg-accent' : ''}`}
                  onClick={() => handleSelectMenu(menu.id)}
                >
                  <span className="font-medium">{menu.name}</span>
                </button>
                {(expandedMenus[menu.id] ?? true) && (
                  <ul className="ml-3 mt-1 space-y-1">
                    {(menu.categories || []).map(mc => (
                      <li key={mc.category.id}>
                        <button
                          className={`w-full text-left px-2 py-1.5 rounded hover:bg-accent ${selectedCategoryId === mc.category.id ? 'bg-accent' : ''}`}
                          onClick={() => handleSelectCategory(mc.category.id, menu.id)}
                        >
                          {mc.category.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </aside>

        {/* Center: List with sorting */}
        <main className="col-span-6 rounded-lg border bg-card">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="text-sm font-medium">
              {viewLevel === 'menus' && 'Menus'}
              {viewLevel === 'menu' && 'Categories'}
              {viewLevel === 'category' && 'Products'}
            </div>
            <div className="text-xs text-muted-foreground">{filteredCenterItems.length} items</div>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <SortableContext items={centerItemIds} strategy={verticalListSortingStrategy}>
              <div className="p-2">
                {filteredCenterItems.map((item: any) => {
                  if (viewLevel === 'menus') {
                    return (
                      <div key={item.id} className="flex items-center p-2 rounded hover:bg-muted">
                        <MenuRow
                          menu={item}
                          onToggleActive={(id, active) => toggleMenuActiveMutation.mutate({ menuId: id, active })}
                          onSelect={() => handleSelectMenu(item.id)}
                        />
                      </div>
                    )
                  } else if (viewLevel === 'menu') {
                    return (
                      <div key={item.id} className="flex items-center p-2 rounded hover:bg-muted">
                        <CategoryRow category={item} menuId={selectedMenuId!} onSelect={() => handleSelectCategory(item.id, selectedMenuId!)} />
                      </div>
                    )
                  } else {
                    return (
                      <SortableProduct
                        key={item.id}
                        product={item}
                        editedPrices={editedPrices}
                        handlePriceChange={handlePriceChange}
                        handlePriceBlur={handlePriceBlur}
                        imageErrors={imageErrors}
                        setImageErrors={setImageErrors}
                      />
                    )
                  }
                })}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeId && activeItem && (
                <div className="p-2 rounded-md shadow-2xl bg-card border-border border bg-opacity-95 backdrop-blur-sm">
                  <div className="flex items-center space-x-2">
                    <GripVertical className="text-muted-foreground" size={18} />
                    <p className="font-semibold text-sm">{'name' in activeItem ? (activeItem as any).name : t('menu.overview.draggedItem')}</p>
                  </div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </main>

        {/* Right: Inspector */}
        <aside className="col-span-3 rounded-lg border p-3 bg-card">
          <div className="flex items-center gap-2 text-sm font-medium mb-2">
            <Info className="h-4 w-4" /> Inspector
          </div>
          {viewLevel === 'menus' && (
            <p className="text-sm text-muted-foreground">Select a menu to see details.</p>
          )}
          {viewLevel === 'menu' && selectedMenuId && (
            <div className="space-y-2 text-sm">
              <div className="font-medium">Menu</div>
              <div className="text-muted-foreground">{menusData?.find(m => m.id === selectedMenuId)?.name}</div>
              <div className="flex items-center gap-2 pt-2">
                <span className="text-muted-foreground">Active</span>
                <Switch
                  checked={!!menusData?.find(m => m.id === selectedMenuId)?.active}
                  onCheckedChange={checked => toggleMenuActiveMutation.mutate({ menuId: selectedMenuId, active: checked })}
                />
              </div>
            </div>
          )}
          {viewLevel === 'category' && selectedCategoryId && (
            <div className="space-y-2 text-sm">
              <div className="font-medium">Category</div>
              <div className="text-muted-foreground">
                {menusData?.flatMap(m => m.categories?.map(c => c.category)).find(c => c.id === selectedCategoryId)?.name}
              </div>
              <div className="text-xs text-muted-foreground">Drag to reorder products within this category.</div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

// Presentation-only rows with drag handle restricted to the grip
function MenuRow({ menu, onToggleActive, onSelect }: { menu: Menu; onToggleActive: (id: string, active: boolean) => void; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: menu.id, data: { type: 'menu' } })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center w-full">
      <button {...attributes} {...listeners} className="p-1 mr-2 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing">
        <GripVertical size={18} />
      </button>
      <button className="text-left flex-1" onClick={onSelect}>
        <div className="font-medium">{menu.name}</div>
      </button>
      <Switch checked={menu.active} onCheckedChange={checked => onToggleActive(menu.id, checked)} />
    </div>
  )
}

function CategoryRow({ category, menuId, onSelect }: { category: MenuCategory; menuId: string; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: category.id, data: { type: 'category', menuId } })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center w-full">
      <button {...attributes} {...listeners} className="p-1 mr-2 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing">
        <GripVertical size={18} />
      </button>
      <button className="text-left flex-1" onClick={onSelect}>
        <div className="font-medium">{category.name}</div>
      </button>
    </div>
  )
}
