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
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ChevronDown, ChevronRight, GripVertical, Image as ImageIcon, MoreHorizontal, Search } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
      {...attributes}
      {...listeners}
      className={`flex items-center p-2 my-1 rounded-md hover:bg-muted ${
        isDragging ? 'shadow-lg z-30' : 'z-20'
      } cursor-grab active:cursor-grabbing relative pointer-events-auto`}
    >
      <div className="p-1 mr-2 text-muted-foreground hover:text-foreground transition-colors">
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

// Sortable Category Component
function SortableCategory({ menuId, category, children }: { menuId: string; category: MenuCategory; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
    data: { type: 'category', menuId },
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
      className={`p-2 rounded-lg bg-muted/50 ${isDragging ? 'shadow-lg z-20' : 'z-10'} relative pointer-events-auto`}
    >
      <div {...attributes} {...listeners} className="flex items-center cursor-grab active:cursor-grabbing relative z-20">
        <div className="p-1 mr-2 text-muted-foreground hover:text-foreground transition-colors">
          <GripVertical size={20} />
        </div>
        <h3 className="font-semibold text-lg flex-grow pointer-events-none">{category.name}</h3>
      </div>
      <div className="pl-8 pt-2">{children}</div>
    </div>
  )
}

// Sortable Menu Component
function SortableMenu({
  menu,
  children,
  onToggleActive,
  isExpanded,
  onToggleExpansion,
  isDraggingMenu,
}: {
  menu: Menu
  children: React.ReactNode
  onToggleActive: (id: string, active: boolean) => void
  isExpanded: boolean
  onToggleExpansion: () => void
  isDraggingMenu?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: menu.id, data: { type: 'menu' } })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`mb-8 rounded-xl border-border bg-card ${isDragging ? 'shadow-lg z-50' : 'z-0'} relative`}
    >
      <header
        {...attributes}
        {...listeners}
        className="flex items-center p-4 rounded-t-xl bg-card cursor-grab active:cursor-grabbing relative z-10"
      >
        <div className="p-1 mr-2 text-muted-foreground hover:text-foreground transition-colors">
          <GripVertical size={24} />
        </div>
        <h2 className="text-xl font-bold flex-grow pointer-events-none">{menu.name}</h2>
        <div className="flex items-center space-x-4 pointer-events-auto">
          <Switch
            checked={menu.active}
            onCheckedChange={checked => onToggleActive(menu.id, checked)}
            onClick={e => e.stopPropagation()} // Prevent drag from starting on click
          />
          <Button variant="ghost" size="icon" onClick={onToggleExpansion}>
            {isExpanded ? <ChevronDown /> : <ChevronRight />}
          </Button>
        </div>
      </header>
      {isExpanded && !isDraggingMenu && <div className="p-4 border-t-2 border-dashed relative z-0">{children}</div>}
    </div>
  )
}

export default function Overview() {
  const navigate = useNavigate()
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [isDraggingMenu, setIsDraggingMenu] = useState(false)
  const [menuOrder, setMenuOrder] = useState<string[]>([])
  const [categoryOrders, setCategoryOrders] = useState<Record<string, string[]>>({})
  const [localProductOrder, setLocalProductOrder] = useState<Record<string, string[]>>({})
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({})
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
      setIsDraggingMenu(true)
      // Collapse all menus when dragging
      const allCollapsed = Object.keys(expandedMenus).reduce((acc, key) => ({ ...acc, [key]: false }), {})
      setExpandedMenus(allCollapsed)
    }
  }

  const handleDragEnd = (event: { active: Active; over: Over | null }) => {
    const { active, over } = event
    setActiveId(null)
    setIsDraggingMenu(false)

    if (over && active.id !== over.id) {
      const activeType = active.data.current?.type
      const overType = over.data.current?.type

      if (activeType === 'menu' && overType === 'menu') {
        setMenuOrder(order => {
          const oldIndex = order.indexOf(active.id as string)
          const newIndex = order.indexOf(over.id as string)
          // Prevent unnecessary moves for small differences
          if (Math.abs(oldIndex - newIndex) < 1) return order
          const newOrder = arrayMove(order, oldIndex, newIndex)
          const payload = newOrder.map((id, index) => ({ id, displayOrder: index }))
          updateMenuOrderMutation.mutate(payload)
          return newOrder
        })
      } else if (activeType === 'category' && overType === 'category') {
        const menuId = active.data.current?.menuId
        setCategoryOrders(orders => {
          const newOrders = { ...orders }
          const oldIndex = newOrders[menuId].indexOf(active.id as string)
          const newIndex = newOrders[menuId].indexOf(over.id as string)
          newOrders[menuId] = arrayMove(newOrders[menuId], oldIndex, newIndex)
          const payload = newOrders[menuId].map((id, index) => ({ id, displayOrder: index }))
          updateCategoryOrderMutation.mutate(payload)
          return newOrders
        })
      } else if (activeType === 'product' && overType === 'product') {
        const categoryId = active.data.current?.categoryId
        setLocalProductOrder(orders => {
          const newOrders = { ...orders }
          const oldIndex = newOrders[categoryId].indexOf(active.id as string)
          const newIndex = newOrders[categoryId].indexOf(over.id as string)
          newOrders[categoryId] = arrayMove(newOrders[categoryId], oldIndex, newIndex)
          const payload = newOrders[categoryId].map((id, index) => ({ id, displayOrder: index }))
          updateProductOrderMutation.mutate(payload)
          return newOrders
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

  const toggleMenuExpansion = (menuId: string) => {
    setExpandedMenus(prev => ({ ...prev, [menuId]: !prev[menuId] }))
  }

  const collapseAll = () => {
    const allCollapsed = Object.keys(expandedMenus).reduce((acc, key) => ({ ...acc, [key]: false }), {})
    setExpandedMenus(allCollapsed)
  }

  const expandAll = () => {
    const allExpanded = Object.keys(expandedMenus).reduce((acc, key) => ({ ...acc, [key]: true }), {})
    setExpandedMenus(allExpanded)
  }

  if (menusLoading || productsLoading) return <OverviewSkeleton />

  if (menusError || productsError) {
    return (
      <div className="text-red-500 p-4">
        <AlertCircle className="inline-block mr-2" />
        Error loading data: {menusError?.message || productsError?.message}
      </div>
    )
  }

  const activeItem = activeId
    ? menusData?.find(m => m.id === activeId) ||
      menusData?.flatMap(m => m.categories?.map(c => c.category)).find(c => c.id === activeId) ||
      productsData?.find(p => p.id === activeId)
    : null

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Menu Overview</h1>
        <div className="flex items-center space-x-2">
          <Button onClick={() => navigate('/menu/categories/new')}>New Category</Button>
          <Button onClick={() => navigate('/menu/new')}>New Menu</Button>
        </div>
      </div>

      <div className="flex items-center space-x-4 mb-6">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <Input
            type="text"
            placeholder="Search menus or categories..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={expandAll}>
          Expand All
        </Button>
        <Button variant="outline" onClick={collapseAll}>
          Collapse All
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <MoreHorizontal size={20} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => navigate('/menu/products/new')}>Create New Product</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/menu/categories')}>Manage Categories</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={menuOrder} strategy={rectSortingStrategy}>
          {filteredMenus.map(menu => (
            <SortableMenu
              key={menu.id}
              menu={menu}
              onToggleActive={(id, active) => toggleMenuActiveMutation.mutate({ menuId: id, active })}
              isExpanded={expandedMenus[menu.id] ?? false}
              onToggleExpansion={() => toggleMenuExpansion(menu.id)}
              isDraggingMenu={isDraggingMenu}
            >
              <SortableContext items={categoryOrders[menu.id] || []} strategy={verticalListSortingStrategy}>
                {getSortedCategories(menu).map(category => (
                  <SortableCategory key={category.id} menuId={menu.id} category={category}>
                    <SortableContext items={localProductOrder[category.id] || []} strategy={verticalListSortingStrategy}>
                      {getProductsForCategory(category.id).map(product => (
                        <SortableProduct
                          key={product.id}
                          product={product}
                          editedPrices={editedPrices}
                          handlePriceChange={handlePriceChange}
                          handlePriceBlur={handlePriceBlur}
                          imageErrors={imageErrors}
                          setImageErrors={setImageErrors}
                        />
                      ))}
                    </SortableContext>
                  </SortableCategory>
                ))}
              </SortableContext>
            </SortableMenu>
          ))}
        </SortableContext>
        <DragOverlay>
          {activeId && activeItem && (
            <div className="p-4 rounded-lg shadow-2xl bg-card border-border border-2 dark:border-blue-600 bg-opacity-95 backdrop-blur-sm">
              <div className="flex items-center space-x-3">
                <GripVertical className="text-muted-foreground" size={20} />
                <p className="font-semibold text-lg">{'name' in activeItem ? activeItem.name : 'Item'}</p>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
