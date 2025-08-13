import { useCurrentVenue } from '@/hooks/use-current-venue'
import * as menuService from '@/services/menu.service'
import { Menu, MenuCategory, Product } from '@/types'
import { themeClasses } from '@/lib/theme-utils'
import { closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors, Active, Over } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Image as ImageIcon,
  MoreHorizontal,
  Search,
} from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

// Sortable Product Component
function SortableProduct({ product, editedPrices, handlePriceChange, handlePriceBlur }: { product: Product, editedPrices: Record<string, string>, handlePriceChange: (id: string, value: string) => void, handlePriceBlur: (id: string, value: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: product.id, data: { type: 'product', categoryId: product.categoryId } })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} className={`flex items-center p-2 my-1 rounded-md ${themeClasses.hover} cursor-grab`}>
      <div {...listeners} className="p-1">
        <GripVertical size={18} />
      </div>
      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-md mr-4 flex items-center justify-center">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover rounded-md" />
        ) : (
          <ImageIcon className={`${themeClasses.textMuted}`} size={24} />
        )}
      </div>
      <div className={`font-medium ${themeClasses.text} flex-grow`}>{product.name}</div>
      <div className="ml-auto flex items-center space-x-4">
        <Input
          type="text"
          value={editedPrices[product.id] ?? (product.price / 100).toFixed(2)}
          onChange={e => handlePriceChange(product.id, e.target.value)}
          onBlur={e => handlePriceBlur(product.id, e.target.value)}
          className="w-24 text-right"
          onClick={(e) => e.stopPropagation()} // Prevent drag from starting on click
        />
        {/* Add more actions if needed */}
      </div>
    </div>
  )
}

// Sortable Category Component
function SortableCategory({ menuId, category, children }: { menuId: string, category: MenuCategory, children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: category.id, data: { type: 'category', menuId } })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className={`p-2 rounded-lg ${themeClasses.contentBg}`}>
      <div {...attributes} className="flex items-center cursor-grab">
        <div {...listeners} className="p-1">
          <GripVertical size={20} />
        </div>
        <h3 className="font-semibold text-lg flex-grow">{category.name}</h3>
      </div>
      <div className="pl-8 pt-2">
        {children}
      </div>
    </div>
  )
}

// Sortable Menu Component
function SortableMenu({ menu, children, onToggleActive, isExpanded, onToggleExpansion }: { menu: Menu, children: React.ReactNode, onToggleActive: (id: string, active: boolean) => void, isExpanded: boolean, onToggleExpansion: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: menu.id, data: { type: 'menu' } })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className={`mb-6 rounded-xl ${themeClasses.border} ${themeClasses.cardBg}`}>
      <header {...attributes} className={`flex items-center p-4 rounded-t-xl ${themeClasses.cardBg} cursor-grab`}>
        <div {...listeners} className="p-1 mr-2">
          <GripVertical size={24} />
        </div>
        <h2 className="text-xl font-bold flex-grow">{menu.name}</h2>
        <div className="flex items-center space-x-4">
          <Switch
            checked={menu.active}
            onCheckedChange={(checked) => onToggleActive(menu.id, checked)}
            onClick={(e) => e.stopPropagation()} // Prevent drag from starting on click
          />
          <Button variant="ghost" size="icon" onClick={onToggleExpansion}>
            {isExpanded ? <ChevronDown /> : <ChevronRight />}
          </Button>
        </div>
      </header>
      {isExpanded && (
        <div className="p-4 border-t-2 border-dashed">
          {children}
        </div>
      )}
    </div>
  )
}

export default function Overview() {
  const navigate = useNavigate()
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [menuOrder, setMenuOrder] = useState<string[]>([])
  const [categoryOrders, setCategoryOrders] = useState<Record<string, string[]>>({})
  const [localProductOrder, setLocalProductOrder] = useState<Record<string, string[]>>({})
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({})
  const [editedPrices, setEditedPrices] = useState<Record<string, string>>({})
  const [searchTerm, setSearchTerm] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const { data: menusData, isLoading: menusLoading, error: menusError } = useQuery<Menu[], Error, Menu[]>({ 
    queryKey: ['menus', venueId],
    queryFn: () => menuService.getMenus(venueId!),
    enabled: !!venueId,
   })

  const { data: productsData, isLoading: productsLoading, error: productsError } = useQuery<Product[], Error, Product[]>({ 
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
          const categoriesForMenu = menu.categories.map(mc => mc.category);
          initialCategoryOrders[menu.id] = categoriesForMenu.map(cat => cat.id).sort((a, b) => {
            const catA = categoriesForMenu.find(c => c.id === a);
            const catB = categoriesForMenu.find(c => c.id === b);
            return (catA?.displayOrder ?? 0) - (catB?.displayOrder ?? 0);
          });
        }
      });
      setCategoryOrders(initialCategoryOrders);
      setExpandedMenus(initialExpandedState);
    }
  }, [menusData]);

  useEffect(() => {
    if (productsData) {
      const initialProductOrders: Record<string, string[]> = {};
      productsData.forEach(product => {
        if (!initialProductOrders[product.categoryId]) {
          initialProductOrders[product.categoryId] = [];
        }
        initialProductOrders[product.categoryId].push(product.id);
      });
      // This just initializes with current order, sorting should be applied if displayOrder is available
      setLocalProductOrder(initialProductOrders);
    }
  }, [productsData]);

  const toggleMenuActiveMutation = useMutation({
    mutationFn: ({ menuId, active }: { menuId: string; active: boolean }) => menuService.updateMenu(venueId!, menuId, { active }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['menus', venueId] }) },
  })

  const updateMenuOrderMutation = useMutation({
    mutationFn: (orderData: string[]) => menuService.reorderMenus(venueId!, orderData),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['menus', venueId] }) },
  })

  const updateCategoryOrderMutation = useMutation({
    mutationFn: (orderData: { id: string; displayOrder: number }[]) => menuService.reorderMenuCategories(venueId!, orderData),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['menus', venueId] }) },
  })

  const updateProductOrderMutation = useMutation({
    mutationFn: (orderData: { id: string; displayOrder: number }[]) => menuService.reorderProducts(venueId!, orderData),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['products', venueId] }) },
  })

  const updateProductPriceMutation = useMutation({
    mutationFn: ({ productId, price }: { productId: string; price: number }) => menuService.updateProduct(venueId!, productId, { price }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['products', venueId] }) },
  })

  const filteredMenus = useMemo(() => {
    if (!menusData) return []
    if (!searchTerm) return menusData
    const lowercasedFilter = searchTerm.toLowerCase()

    return menusData.filter(menu => {
      const menuNameMatch = menu.name.toLowerCase().includes(lowercasedFilter)
      const categoryMatch = menu.categories?.some(c => c.category.name.toLowerCase().includes(lowercasedFilter))
      return menuNameMatch || categoryMatch
    })
  }, [menusData, searchTerm])

  const getSortedCategories = useCallback((menu: Menu) => {
    if (!menu.categories) return []
    const currentOrder = categoryOrders[menu.id] || []
    return [...menu.categories.map(mc => mc.category)].sort((a, b) => currentOrder.indexOf(a.id) - currentOrder.indexOf(b.id))
  }, [categoryOrders])

  const getProductsForCategory = useCallback((categoryId: string) => {
    if (!productsData) return []
    const categoryProducts = productsData.filter(p => p.categoryId === categoryId)
    const currentOrder = localProductOrder[categoryId] || []
    return [...categoryProducts].sort((a, b) => currentOrder.indexOf(a.id) - currentOrder.indexOf(b.id))
  }, [productsData, localProductOrder])

  const handleDragStart = (event: { active: Active }) => { setActiveId(event.active.id as string) };

  const handleDragEnd = (event: { active: Active; over: Over | null }) => {
    const { active, over } = event
    setActiveId(null)

    if (over && active.id !== over.id) {
      const activeType = active.data.current?.type
      const overType = over.data.current?.type

      if (activeType === 'menu' && overType === 'menu') {
        setMenuOrder(order => {
          const oldIndex = order.indexOf(active.id as string)
          const newIndex = order.indexOf(over.id as string)
          const newOrder = arrayMove(order, oldIndex, newIndex)
          updateMenuOrderMutation.mutate(newOrder)
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
    setEditedPrices(prev => { const { [productId]: _, ...rest } = prev; return rest; })
  }

  const toggleMenuExpansion = (menuId: string) => { setExpandedMenus(prev => ({ ...prev, [menuId]: !prev[menuId] })) }

  const collapseAll = () => {
    const allCollapsed = Object.keys(expandedMenus).reduce((acc, key) => ({ ...acc, [key]: false }), {})
    setExpandedMenus(allCollapsed)
  }

  const expandAll = () => {
    const allExpanded = Object.keys(expandedMenus).reduce((acc, key) => ({ ...acc, [key]: true }), {})
    setExpandedMenus(allExpanded)
  }

  if (menusLoading || productsLoading) return <div>Loading...</div>

  if (menusError || productsError) {
    return <div className="text-red-500 p-4">
      <AlertCircle className="inline-block mr-2" />
      Error loading data: {menusError?.message || productsError?.message}
    </div>
  }

  const activeItem = activeId ? 
    (menusData?.find(m => m.id === activeId) || 
    menusData?.flatMap(m => m.categories?.map(c => c.category)).find(c => c.id === activeId) ||
    productsData?.find(p => p.id === activeId)) : null;

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
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${themeClasses.textMuted}`} size={20} />
          <Input
            type="text"
            placeholder="Search menus or categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={expandAll}>Expand All</Button>
        <Button variant="outline" onClick={collapseAll}>Collapse All</Button>
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
        <SortableContext items={menuOrder} strategy={verticalListSortingStrategy}>
          {filteredMenus.map(menu => (
            <SortableMenu 
              key={menu.id} 
              menu={menu} 
              onToggleActive={(id, active) => toggleMenuActiveMutation.mutate({ menuId: id, active })}
              isExpanded={expandedMenus[menu.id] ?? false}
              onToggleExpansion={() => toggleMenuExpansion(menu.id)}
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
            // This is a simplified overlay. For a better UX, you'd create specific components
            // for each draggable type (Menu, Category, Product) that match their look.
            <div className={`p-4 rounded-lg shadow-lg ${themeClasses.cardBg} ${themeClasses.border}`}>
              <p className="font-bold">Moving: {('name' in activeItem) ? activeItem.name : 'Item'}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
