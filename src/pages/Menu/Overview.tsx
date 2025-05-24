import api from '@/api' // Import your API client
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { themeClasses } from '@/lib/theme-utils'
import { Currency } from '@/utils/currency'
import { closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  GripVertical,
  Info,
  Plus,
  Search,
  Settings,
  X,
} from 'lucide-react'
import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

// Helper function to format time from 24h to 12h format
const formatTime = (time: string) => {
  if (!time) return ''
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

// Helper to translate day names
const translateDay = day => {
  const translations = {
    MONDAY: 'Lunes',
    TUESDAY: 'Martes',
    WEDNESDAY: 'Miércoles',
    THURSDAY: 'Jueves',
    FRIDAY: 'Viernes',
    SATURDAY: 'Sábado',
    SUNDAY: 'Domingo',
  }
  return translations[day] || day
}

// Helper to group menu days for display
const groupMenuDays = menuDays => {
  if (!menuDays || !menuDays.length) return []

  // Sort days of week
  const dayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
  const sortedDays = [...menuDays].sort((a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day))

  // Group consecutive days with the same times
  const groups = []
  let currentGroup = null

  sortedDays.forEach(menuDay => {
    if (!currentGroup || currentGroup.startTime !== menuDay.startTime || currentGroup.endTime !== menuDay.endTime) {
      // Start a new group
      currentGroup = {
        days: [menuDay.day],
        startTime: menuDay.startTime,
        endTime: menuDay.endTime,
      }
      groups.push(currentGroup)
    } else {
      // Add to current group
      currentGroup.days.push(menuDay.day)
    }
  })

  // Format the groups for display
  return groups.map(group => {
    let dayRange
    if (group.days.length === 1) {
      dayRange = translateDay(group.days[0])
    } else {
      dayRange = `${translateDay(group.days[0])} - ${translateDay(group.days[group.days.length - 1])}`
    }

    return {
      dayRange,
      timeRange: `${formatTime(group.startTime)} - ${formatTime(group.endTime)}`,
    }
  })
}

// Define the product type for better type safety
interface ProductType {
  id: string
  name: string
  price: number | string
  sortOrder?: number
  categories?: Array<{ id: string }>
  [key: string]: any
}

// SortableProduct component for draggable products
function SortableProduct({
  product,
  editedPrices,
  handlePriceChange,
  handlePriceBlur,
}: {
  product: ProductType
  editedPrices: Record<string, string>
  handlePriceChange: (productId: string, value: string) => void
  handlePriceBlur: (productId: string, value: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    zIndex: isDragging ? 1 : 'auto',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center py-3 px-3 ${themeClasses.cardBg} border-b ${themeClasses.border} last:border-b-0`}
    >
      <div className="flex items-center flex-1">
        <div className={`${themeClasses.textMuted} mr-3 cursor-grab active:cursor-grabbing`} {...attributes} {...listeners}>
          <GripVertical size={16} />
        </div>
        <div className={`font-medium ${themeClasses.text}`}>{product.name}</div>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative w-20">
          <span className={`absolute inset-y-0 left-0 flex items-center pl-2 ${themeClasses.textSubtle}`}>$</span>
          <Input
            type="text"
            value={
              editedPrices[product.id] !== undefined
                ? editedPrices[product.id]
                : Currency(Number(product.price) || 0).replace('$', '') || ''
            }
            onChange={e => handlePriceChange(product.id, e.target.value)}
            onBlur={e => handlePriceBlur(product.id, e.target.value)}
            className={`py-1 w-full rounded border ${themeClasses.border} text-right bg-gray-50 dark:bg-gray-800`}
          />
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center justify-center w-6 h-6 bg-green-50 dark:bg-green-950/60 rounded-full text-green-600 dark:text-green-400">
            <Check size={14} />
          </div>
          <Button variant="ghost" className={themeClasses.textMuted}>
            <ChevronDown size={16} />
          </Button>
        </div>
      </div>
    </div>
  )
}

// SortableMenu component for draggable menus
function SortableMenu({ menu, children, onToggleExpansion, isExpanded, onToggleActive, onAddCategory }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: menu.id })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    zIndex: isDragging ? 1 : 'auto',
  }

  return (
    <div ref={setNodeRef} style={style} className={`border-b ${themeClasses.border} last:border-b-0`}>
      <div className="flex items-center p-4">
        <div className={`mr-2 ${themeClasses.textMuted} cursor-grab active:cursor-grabbing`} {...attributes} {...listeners}>
          <GripVertical size={16} />
        </div>
        <div className="flex-1 cursor-pointer" onClick={() => onToggleExpansion(menu.id)}>
          <h3 className={`font-medium ${themeClasses.text}`}>{menu.name}</h3>
          <p className={`text-sm ${themeClasses.textMuted}`}>{menu.categories?.length || 0} categorías</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={e => {
              e.stopPropagation()
              onToggleActive(menu.id, !menu.active)
            }}
            variant="ghost"
            className={`rounded-full ${
              menu.active
                ? 'bg-green-100 text-green-600 dark:bg-green-950/60 dark:text-green-400'
                : 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400'
            }`}
          >
            {menu.active ? <Check size={16} /> : <X size={16} />}
            <span className="ml-2">{menu.active ? 'Activo' : 'Inactivo'}</span>
          </Button>
          <Button
            onClick={e => {
              e.stopPropagation()
              onAddCategory(menu.id)
            }}
            variant="ghost"
            size="sm"
            className="text-xs border border-gray-200 dark:border-gray-800"
          >
            <Plus size={12} className="mr-1" />
            <span>Añadir categoría</span>
          </Button>
          <Button variant="ghost" className={themeClasses.textMuted} onClick={() => onToggleExpansion(menu.id)}>
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </Button>
        </div>
      </div>
      {children}
    </div>
  )
}

// SortableCategory component for draggable and collapsible categories
function SortableCategory({ category, children, menuId }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `${menuId}-${category.id}` })
  const [isExpanded, setIsExpanded] = useState(true)

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    zIndex: isDragging ? 1 : 'auto',
  }

  return (
    <div ref={setNodeRef} style={style} className="mb-4">
      <div className="flex items-center mb-2">
        <div className={`mr-2 ${themeClasses.textMuted} cursor-grab active:cursor-grabbing`} {...attributes} {...listeners}>
          <GripVertical size={16} />
        </div>
        <div className="flex-1 flex items-center">
          <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)} className={themeClasses.textMuted}>
            {isExpanded ? <ChevronRight size={20} /> : <ChevronDown size={20} />}
          </Button>
          <h4 className={`font-medium ${themeClasses.textSubtle} ml-2`}>{category.name}</h4>
        </div>
      </div>
      {isExpanded && children}
    </div>
  )
}

export default function Overview() {
  const [searchTerm, setSearchTerm] = useState('')
  const { venueId } = useParams()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // State for managing expanded/collapsed state of menus
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({})

  // State for managing product order during drag operations
  const [localProductOrder, setLocalProductOrder] = useState<Record<string, string[]>>({})

  // State for showing/hiding notification banners
  const [showPhotoBanner, setShowPhotoBanner] = useState(true)
  const [showInfoBanner, setShowInfoBanner] = useState(true)
  const [showTipsDialog, setShowTipsDialog] = useState(false)

  // Drag and drop state
  const [activeId, setActiveId] = useState(null)
  const [menuOrder, setMenuOrder] = useState([])
  const [categoryOrders, setCategoryOrders] = useState({})

  // Set up DND sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // // Fetch venue details
  // const {
  //   data: venueData,
  //   isLoading: venueLoading,
  //   error: venueError,
  // } = useQuery({
  //   queryKey: ['venue', venueId],
  //   queryFn: async () => {
  //     const response = await api.get(`/v2/dashboard/${venueId}/venue`)
  //     return response.data
  //   },
  // })

  // Fetch menus with categories
  const {
    data: menusData,
    isLoading: menusLoading,
    error: menusError,
  } = useQuery({
    queryKey: ['avoqado-menus', venueId],
    queryFn: async () => {
      // Add timestamp to prevent 304 Not Modified responses
      const timestamp = Date.now()
      const response = await api.get(`/v2/dashboard/${venueId}/avoqado-menus?t=${timestamp}`)
      return response.data
    },
  })

  // Initialize ordering when menu data is loaded
  useEffect(() => {
    if (menusData?.avoqadoMenus && menuOrder.length === 0) {
      // Set menu order
      setMenuOrder(menusData.avoqadoMenus.map(menu => menu.id))

      // Initialize category orders, but filter out any categories that don't belong to current venue
      const initialCategoryOrders = {}
      menusData.avoqadoMenus.forEach(menu => {
        if (menu.categories && menu.categories.length > 0) {
          // Make sure each category has the proper venueId to avoid cross-venue issues
          const validCategories = menu.categories.filter(cat => cat.venueId === venueId)
          if (validCategories.length > 0) {
            initialCategoryOrders[menu.id] = validCategories.map(cat => cat.id)
          }
        }
      })
      setCategoryOrders(initialCategoryOrders)
    }
  }, [menusData, menuOrder.length, venueId])

  // Fetch all products
  const {
    data: productsData,
    isLoading: productsLoading,
    error: productsError,
  } = useQuery({
    queryKey: ['products', venueId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/products`)
      return response.data
    },
  })

  // Get menu schedule information from active menus
  const menuSchedule = useMemo(() => {
    if (!menusData?.avoqadoMenus) return []

    // Find the first active menu with menuDays
    const activeMenus = menusData.avoqadoMenus.filter(menu => menu.active)
    if (activeMenus.length === 0) return []

    // If menuDays is directly on the menu objects
    for (const menu of activeMenus) {
      if (menu.menuDays && menu.menuDays.length > 0) {
        return groupMenuDays(menu.menuDays)
      }
    }

    // If we need to fetch the menu details to get menuDays
    return []
  }, [menusData])

  // Toggle menu section expansion
  const toggleMenuExpansion = menuId => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuId]: !prev[menuId],
    }))

    // If we're expanding a menu and we don't have its details yet, fetch them
    if (!expandedMenus[menuId]) {
      queryClient.prefetchQuery({
        queryKey: ['avoqado-menu', venueId, menuId],
        queryFn: async () => {
          const response = await api.get(`/v2/dashboard/${venueId}/avoqado-menus/${menuId}`)
          return response.data
        },
      })
    }
  }

  // Toggle all menus expanded/collapsed
  const toggleAllMenus = () => {
    const allExpanded = Object.values(expandedMenus).every(Boolean)
    const newState = {}
    menusData?.avoqadoMenus?.forEach(menu => {
      newState[menu.id] = !allExpanded
    })
    setExpandedMenus(newState)
  }

  // Toggle menu active status mutation
  const toggleMenuActiveMutation = useMutation({
    mutationFn: async ({ menuId, active }: { menuId: string; active: boolean }) => {
      return await api.patch(`/v2/dashboard/${venueId}/avoqado-menus/${menuId}`, { active })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avoqado-menus', venueId] })
    },
  })

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      return await api.delete(`/v2/dashboard/${venueId}/products/${productId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
      queryClient.invalidateQueries({ queryKey: ['avoqado-menus', venueId] })
    },
  })

  // Update menu order mutation
  const updateMenuOrderMutation = useMutation({
    mutationFn: async (orderData: string[]) => {
      return await api.post(`/v2/dashboard/${venueId}/avoqado-menus/reorder`, { order: orderData })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avoqado-menus', venueId] })
    },
  })

  // Update product order mutation
  const updateProductOrderMutation = useMutation({
    mutationFn: async ({ categoryId, orderData }: { categoryId: string; orderData: string[] }) => {
      return await api.post(`/v2/dashboard/${venueId}/products/reorder`, { categoryId, order: orderData })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
      queryClient.invalidateQueries({ queryKey: ['avoqado-menus', venueId] })
    },
  })

  // Update category order mutation
  const updateCategoryOrderMutation = useMutation({
    mutationFn: async ({ menuId, orderData }: { menuId: string; orderData: string[] }) => {
      // Detailed logging for debugging
      console.log('SENDING TO SERVER - Menu ID:', menuId)
      console.log('SENDING TO SERVER - Order Data:', JSON.stringify(orderData))

      const response = await api.post(`/v2/dashboard/${venueId}/categories/reorder`, {
        menuId,
        orderData,
      })
      return response.data
    },
    onSuccess: (data, variables) => {
      console.log('SUCCESS RESPONSE:', JSON.stringify(data))

      // On success, we need to manually update our local state
      // without relying on a refetch that might reorder things differently
      if (data?.categories) {
        console.log(
          'SERVER RETURNED CATEGORIES:',
          data.categories.map(c => ({ id: c.id, order: c.orderByNumber })),
        )
      }

      // Keep our local ordering state intact
      setCategoryOrders(prev => ({
        ...prev,
        [variables.menuId]: variables.orderData,
      }))

      // Refetch but with a delay to allow local state updates to settle
      setTimeout(() => {
        const timestamp = Date.now()
        queryClient.fetchQuery({
          queryKey: ['avoqado-menus', venueId],
          queryFn: async () => {
            console.log('REFETCHING MENUS')
            const response = await api.get(`/v2/dashboard/${venueId}/avoqado-menus?t=${timestamp}`)
            return response.data
          },
        })
      }, 500)
    },
    onError: (error, _variables) => {
      console.error('Failed to update category order:', error)
      queryClient.invalidateQueries({ queryKey: ['avoqado-menus', venueId] })
    },
  })

  // Filter and sort menus based on the search term and menu order
  const filteredAndSortedMenus = useMemo(() => {
    if (!menusData?.avoqadoMenus) return []

    // First, filter the menus
    const filtered = menusData.avoqadoMenus.filter(menu => {
      if (!searchTerm) return true

      // Check if menu name matches
      if (menu.name?.toLowerCase().includes(searchTerm.toLowerCase())) return true

      // Check if any category in the menu matches
      const hasMatchingCategory = menu.categories?.some(category => category.name?.toLowerCase().includes(searchTerm.toLowerCase()))

      return hasMatchingCategory
    })

    // Then, sort them according to menuOrder
    return [...filtered].sort((a, b) => {
      const indexA = menuOrder.indexOf(a.id)
      const indexB = menuOrder.indexOf(b.id)

      // If an item isn't in the order array, put it at the end
      if (indexA === -1) return 1
      if (indexB === -1) return -1

      return indexA - indexB
    })
  }, [menusData, searchTerm, menuOrder])

  // Function to get sorted categories for a menu
  const getSortedCategories = useCallback(
    menu => {
      if (!menu?.categories) return []

      // Make a copy of categories to sort
      const categoriesToSort = [...menu.categories]

      // If we have a stored order from drag operations, prioritize it
      if (categoryOrders[menu.id] && categoryOrders[menu.id].length > 0) {
        return categoriesToSort.sort((a, b) => {
          const indexA = categoryOrders[menu.id].indexOf(a.id)
          const indexB = categoryOrders[menu.id].indexOf(b.id)

          // If category isn't in our order array, put it at the end
          if (indexA === -1) return 1
          if (indexB === -1) return -1

          return indexA - indexB
        })
      }

      // If categories have orderByNumber from server, use that as fallback
      if (categoriesToSort.some(cat => typeof cat.orderByNumber === 'number')) {
        return categoriesToSort.sort((a, b) => {
          return (a.orderByNumber ?? 999) - (b.orderByNumber ?? 999)
        })
      }

      // Last resort: return as-is
      return categoriesToSort
    },
    [categoryOrders],
  )

  // Function to get products for a category
  const getProductsForCategory = useCallback(
    categoryId => {
      if (!productsData) return []

      // Get all products for this category
      const categoryProducts = productsData.filter(product => product.categories?.some(cat => cat.id === categoryId))

      // If we have a local order for this category, use it
      if (localProductOrder[categoryId]) {
        const orderedProducts = []
        const productMap = new Map(categoryProducts.map(p => [p.id, p]))
        const seenIds = new Set()

        // First, add products in the order specified in localProductOrder
        for (const productId of localProductOrder[categoryId]) {
          if (productMap.has(productId)) {
            orderedProducts.push(productMap.get(productId))
            seenIds.add(productId)
          }
        }

        // Then add any products that weren't in the local order
        for (const product of categoryProducts) {
          if (!seenIds.has(product.id)) {
            orderedProducts.push(product)
          }
        }

        return orderedProducts
      }

      // Default sorting by sortOrder if no local order exists
      return [...categoryProducts].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    },
    [productsData, localProductOrder],
  )

  // Function to handle menu drag end
  const handleMenuDragEnd = event => {
    const { active, over } = event

    if (active.id !== over.id) {
      setMenuOrder(items => {
        const oldIndex = items.indexOf(active.id)
        const newIndex = items.indexOf(over.id)

        const newOrder = arrayMove(items, oldIndex, newIndex)

        // Save the new order to the database
        updateMenuOrderMutation.mutate(newOrder)

        return newOrder
      })
    }

    setActiveId(null)
  }

  // Function to handle category drag end
  const handleCategoryDragEnd = (event, menuId) => {
    const { active, over } = event

    if (!active || !over) {
      console.log('No active or over element')
      return
    }

    // Extract category IDs from the combined IDs
    const activeIdParts = active.id.toString().split('-')
    const overIdParts = over.id.toString().split('-')

    if (activeIdParts.length < 2 || overIdParts.length < 2) {
      console.log('Invalid ID parts', { activeIdParts, overIdParts })
      return
    }

    const activeCategoryId = activeIdParts[1]
    const overCategoryId = overIdParts[1]

    console.log('DRAG END', {
      activeId: active.id,
      overId: over.id,
      activeCategoryId,
      overCategoryId,
    })

    if (activeCategoryId === overCategoryId) {
      console.log('Same category, no change needed')
      return
    }

    // Get the menu we're working with
    const menu = menusData?.avoqadoMenus?.find(m => m.id === menuId)
    if (!menu) {
      console.error('Menu not found', menuId)
      return
    }

    console.log('MENU DATA', {
      id: menu.id,
      name: menu.name,
      categories: menu.categories?.map(c => ({ id: c.id, name: c.name, order: c.orderByNumber })),
    })

    // Get all category IDs from the menu or current order
    let allCategoryIds = []

    // If we have a stored order, use it
    if (categoryOrders[menuId] && categoryOrders[menuId].length > 0) {
      allCategoryIds = [...categoryOrders[menuId]]
      console.log('USING STORED ORDER', allCategoryIds)
    }
    // Otherwise, get them from the menu
    else if (menu.categories && menu.categories.length > 0) {
      // Check if we have orderByNumber to sort by
      if (menu.categories.some(c => typeof c.orderByNumber === 'number')) {
        const sorted = [...menu.categories].sort((a, b) => (a.orderByNumber ?? 999) - (b.orderByNumber ?? 999))
        allCategoryIds = sorted.map(c => c.id)
        console.log('USING SORTED MENU CATEGORIES', allCategoryIds)
      } else {
        allCategoryIds = menu.categories.map(c => c.id)
        console.log('USING UNSORTED MENU CATEGORIES', allCategoryIds)
      }
    } else {
      console.error('No categories found')
      return
    }

    // Find indices in our full list
    const oldIndex = allCategoryIds.indexOf(activeCategoryId)
    const newIndex = allCategoryIds.indexOf(overCategoryId)

    if (oldIndex === -1 || newIndex === -1) {
      console.error('Category not found in list', {
        activeCategoryId,
        overCategoryId,
        allCategoryIds,
        oldIndex,
        newIndex,
      })
      return
    }

    // Create the new order
    const newOrder = arrayMove([...allCategoryIds], oldIndex, newIndex)
    console.log('NEW ORDER', newOrder)

    // Update local state immediately for responsive UI
    setCategoryOrders(prev => {
      const updated = {
        ...prev,
        [menuId]: newOrder,
      }
      console.log('UPDATED CATEGORY ORDERS', updated)
      return updated
    })

    // Send to server with short delay to ensure state is updated
    setTimeout(() => {
      updateCategoryOrderMutation.mutate({
        menuId,
        orderData: newOrder,
      })
    }, 10)

    setActiveId(null)
  }

  // Function to create a new menu
  const handleAddMenu = () => {
    navigate(`/dashboard/${venueId}/avoqado-menus/create`)
  }

  // Function to create a new category
  const handleAddCategory = menuId => {
    navigate(`/venues/${venueId}/menumaker/categories/create?menuId=${menuId}`)
  }

  // Function to create a new product
  const handleAddProduct = categoryId => {
    navigate(`/venues/${venueId}/menumaker/products/create?categoryId=${categoryId}`)
  }

  // Add state for tracking price changes
  const [editedPrices, setEditedPrices] = useState({})

  // Add mutation for updating product price
  const updateProductPriceMutation = useMutation({
    mutationFn: async ({ productId, price }: { productId: string; price: number }) => {
      return await api.patch(`/v2/dashboard/${venueId}/products/${productId}`, { price: price * 100 })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
    },
    onError: error => {
      console.error('Failed to update product price:', error)
    },
  })

  // Function to handle price change
  const handlePriceChange = (productId, newPrice) => {
    setEditedPrices(prev => ({
      ...prev,
      [productId]: newPrice,
    }))
  }

  // Function to handle price blur (save on blur)
  const handlePriceBlur = (productId, newPrice) => {
    // Get the numeric value from the input
    const numericPrice = parseFloat(newPrice)

    // Only update if it's a valid number and changed
    if (!isNaN(numericPrice)) {
      updateProductPriceMutation.mutate({
        productId,
        price: numericPrice,
      })
    }

    // Clear from edited prices state
    setEditedPrices(prev => {
      const updated = { ...prev }
      delete updated[productId]
      return updated
    })
  }

  // Determine if the loading state should be shown
  const isLoading = menusLoading || productsLoading

  return (
    <div className={`${themeClasses.pageBg} min-h-screen`}>
      {/* Main Content */}
      <main className="max-w-7xl mx-auto mt-4 pb-16">
        {/* Photo info banner */}
        {showPhotoBanner && (
          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-md p-4 mb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start">
                <div className="pr-4">
                  <Camera className={themeClasses.textMuted} size={20} />
                </div>
                <div>
                  <h3 className={`font-semibold ${themeClasses.text}`}>Las fotos de los artículos del menú pueden aumentar las ventas</h3>
                  <p className={`text-sm ${themeClasses.textSubtle} mt-1`}>
                    Ayudan a los clientes a elegir lo que quieren pedir. Para añadir fotos, ve a Artículos y elige un artículo del menú.
                  </p>
                </div>
              </div>
              <Button variant="ghost" className={themeClasses.textMuted} onClick={() => setShowPhotoBanner(false)}>
                <X size={20} />
              </Button>
            </div>
            <div className="ml-8 mt-4">
              <Button variant="outline" onClick={() => navigate(`/venues/${venueId}/menumaker/products`)}>
                <Plus size={12} />
                <span>Añadir foto</span>
              </Button>
            </div>
          </div>
        )}

        {/* Menu validation banner */}
        {showInfoBanner && (
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-md p-4 mb-4">
            <div className="flex items-start">
              <div className="pr-4">
                <Info className="text-blue-600 dark:text-blue-400" size={20} />
              </div>
              <div>
                <h3 className={`font-semibold ${themeClasses.text}`}>Asegúrate de que el menú se vea correctamente</h3>
                <p className={`text-sm ${themeClasses.textSubtle} mt-1`}>
                  Puedes hacer actualizaciones por tu cuenta o contactar con el servicio de soporte para obtener ayuda.
                </p>
              </div>
              <div className="ml-auto flex">
                <Button variant="ghost" className={`mr-3 ${themeClasses.textMuted}`} onClick={() => setShowInfoBanner(false)}>
                  <X size={20} />
                </Button>
                <Dialog open={showTipsDialog} onOpenChange={setShowTipsDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 dark:text-white dark:bg-blue-700 dark:hover:bg-blue-600 px-4 py-2 rounded-md text-sm font-medium">
                      Consultar los consejos
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-semibold">Consejos para mejorar tu menú</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                      <div className="space-y-2">
                        <h3 className="font-medium text-lg">1. Fotos de alta calidad</h3>
                        <p className="text-gray-600 dark:text-gray-400">
                          Añade fotos profesionales de tus platos. Los menús con fotos tienen un 30% más de pedidos.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h3 className="font-medium text-lg">2. Descripciones atractivas</h3>
                        <p className="text-gray-600 dark:text-gray-400">
                          Describe los ingredientes y la preparación de tus platos de manera apetitosa.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h3 className="font-medium text-lg">3. Organización por categorías</h3>
                        <p className="text-gray-600 dark:text-gray-400">
                          Agrupa tus platos en categorías lógicas para facilitar la navegación.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h3 className="font-medium text-lg">4. Precios actualizados</h3>
                        <p className="text-gray-600 dark:text-gray-400">Asegúrate de que los precios estén actualizados y sean visibles.</p>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                      <Button variant="outline" onClick={() => setShowTipsDialog(false)}>
                        Cerrar
                      </Button>
                      <Button
                        variant="default"
                        onClick={() => {
                          setShowTipsDialog(false)
                          // Add any additional action when the user clicks "Aplicar consejos"
                        }}
                      >
                        Aplicar consejos
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        )}

        {/* Menu Header */}
        <div className={`${themeClasses.cardBg} rounded-md shadow-sm p-6 mb-4`}>
          <div className="flex justify-between items-center mb-4">
            <h1 className={`text-2xl font-semibold ${themeClasses.text}`}>Menú</h1>
            <Button variant="ghost" className={themeClasses.textMuted}>
              <ChevronDown size={20} />
            </Button>
          </div>

          <div className="flex justify-between items-start">
            <div>
              <h2 className={`text-sm font-medium ${themeClasses.textSubtle} mb-2`}>Horarios del menú</h2>
              <div className={`text-sm ${themeClasses.text}`}>
                {menuSchedule.length > 0 ? (
                  menuSchedule.map((schedule, index) => (
                    <div key={index} className="flex justify-between mb-1">
                      <span>{schedule.dayRange}</span>
                      <span className="ml-8">{schedule.timeRange}</span>
                    </div>
                  ))
                ) : (
                  <div className={themeClasses.textMuted}>No hay horarios configurados</div>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                // Navigate to edit schedule page
                if (menusData?.avoqadoMenus?.length > 0) {
                  navigate(`/venues/${venueId}/avoqado-menus/${menusData.avoqadoMenus[0].id}/edit`)
                } else {
                  navigate(`/venues/${venueId}/avoqado-menus/create`)
                }
              }}
            >
              <Settings size={16} />
              <span>Editar</span>
            </Button>
          </div>
        </div>

        {/* Menu Search and Actions */}
        <div className={`${themeClasses.cardBg} rounded-md shadow-sm p-4 mb-4`}>
          <div className="flex justify-between">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className={`h-5 w-5 ${themeClasses.textMuted}`} />
              </div>
              <Input
                type="text"
                className={`pl-10 pr-4 py-2 border ${themeClasses.border} rounded-md w-80`}
                placeholder="Buscar artículos"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                className={`p-2 ${themeClasses.textMuted} border ${themeClasses.border} rounded-md`}
                onClick={toggleAllMenus}
                title={Object.values(expandedMenus).every(Boolean) ? 'Colapsar todo' : 'Expandir todo'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" className={themeClasses.textMuted}>
                  <path
                    fill="currentColor"
                    d={
                      Object.values(expandedMenus).every(Boolean)
                        ? 'M6 20.65v-3.675l6-3.8 6 3.8v3.675l-6-3.875-6 3.875ZM6 7.175V3.5l6 3.875L18 3.5v3.675l-6 3.8-6-3.8Z'
                        : 'M6 20.65v-3.675l6-3.8 6 3.8v3.675l-6-3.875-6 3.875ZM6 7.175V3.5l6 3.875L18 3.5v3.675l-6 3.8-6-3.8Z'
                    }
                  />
                </svg>
              </Button>
              <Button onClick={handleAddMenu} variant="outline">
                <Plus size={12} />
                <span>Añadir</span>
              </Button>
              <Button
                className={`px-4 py-2 ${
                  updateMenuOrderMutation.isPending || updateCategoryOrderMutation.isPending
                    ? 'bg-blue-500 dark:bg-blue-600 text-white'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                } rounded-md`}
                disabled={!updateMenuOrderMutation.isPending && !updateCategoryOrderMutation.isPending}
              >
                {updateMenuOrderMutation.isPending || updateCategoryOrderMutation.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </div>

        {/* Loading or Error States */}
        {isLoading && (
          <div className="flex justify-center items-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100"></div>
          </div>
        )}

        {menusError && (
          <div className={`${themeClasses.error.bg} p-4 rounded-md mb-4`}>
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className={`h-5 w-5 ${themeClasses.error.text}`} aria-hidden="true" />
              </div>
              <div className="ml-3">
                <h3 className={`text-sm font-medium ${themeClasses.error.text}`}>Error cargando los menús</h3>
                <p className={`text-sm ${themeClasses.error.text} mt-2`}>
                  {menusError?.message || 'Ha ocurrido un error al cargar los menús. Intente de nuevo.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {productsError && (
          <div className={`${themeClasses.error.bg} p-4 rounded-md mb-4`}>
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className={`h-5 w-5 ${themeClasses.error.text}`} aria-hidden="true" />
              </div>
              <div className="ml-3">
                <h3 className={`text-sm font-medium ${themeClasses.error.text}`}>Error cargando los productos</h3>
                <p className={`text-sm ${themeClasses.error.text} mt-2`}>
                  {productsError?.message || 'Ha ocurrido un error al cargar los productos. Intente de nuevo.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Menu Sections with Drag and Drop */}
        {!isLoading && !menusError && (
          <div className={`${themeClasses.cardBg} rounded-md shadow-sm`}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={event => setActiveId(event.active.id)}
              onDragEnd={handleMenuDragEnd}
            >
              <SortableContext items={menuOrder} strategy={verticalListSortingStrategy}>
                {filteredAndSortedMenus?.map(menu => (
                  <SortableMenu
                    key={menu.id}
                    menu={menu}
                    onToggleExpansion={toggleMenuExpansion}
                    isExpanded={expandedMenus[menu.id]}
                    onToggleActive={(menuId, active) => {
                      toggleMenuActiveMutation.mutate({
                        menuId,
                        active,
                      })
                    }}
                    onAddCategory={handleAddCategory}
                  >
                    {expandedMenus[menu.id] && (
                      <div className="pl-12 pr-4 pb-4">
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragStart={event => setActiveId(event.active.id)}
                          onDragEnd={event => handleCategoryDragEnd(event, menu.id)}
                        >
                          <SortableContext
                            items={getSortedCategories(menu).map(cat => `${menu.id}-${cat.id}`)}
                            strategy={verticalListSortingStrategy}
                          >
                            {getSortedCategories(menu).map(category => {
                              const categoryProducts = productsData && getProductsForCategory(category.id)
                              const productIds: string[] = categoryProducts ? categoryProducts.map(product => product.id as string) : []

                              // Function to handle product drag end for this specific category
                              const handleProductDragEnd = (event: any) => {
                                const { active, over } = event

                                if (active.id !== over.id && over) {
                                  const oldIndex = productIds.indexOf(active.id)
                                  const newIndex = productIds.indexOf(over.id)

                                  if (oldIndex !== -1 && newIndex !== -1) {
                                    const newOrder = arrayMove(productIds, oldIndex, newIndex)

                                    // Update local state immediately for smooth UI update
                                    setLocalProductOrder(prev => ({
                                      ...prev,
                                      [category.id]: newOrder,
                                    }))

                                    // Update the product order in the database
                                    updateProductOrderMutation.mutate({
                                      categoryId: category.id,
                                      orderData: newOrder,
                                    })
                                  }
                                }
                              }

                              return (
                                <SortableCategory key={`${menu.id}-${category.id}`} category={category} menuId={menu.id}>
                                  <div className="pl-8">
                                    {productsLoading ? (
                                      <div className="py-2 px-4 bg-gray-50 dark:bg-gray-800 rounded-md mb-2">
                                        <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                                      </div>
                                    ) : categoryProducts && categoryProducts.length > 0 ? (
                                      <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragStart={event => setActiveId(event.active.id)}
                                        onDragEnd={handleProductDragEnd}
                                      >
                                        <SortableContext items={productIds} strategy={verticalListSortingStrategy}>
                                          {categoryProducts.map(product => (
                                            <SortableProduct
                                              key={product.id}
                                              product={product}
                                              editedPrices={editedPrices}
                                              handlePriceChange={handlePriceChange}
                                              handlePriceBlur={handlePriceBlur}
                                            />
                                          ))}
                                        </SortableContext>

                                        {/* Drag overlay for products */}
                                        <DragOverlay>
                                          {activeId && productIds.includes(activeId) && (
                                            <div
                                              className={`flex items-center py-3 px-3 ${themeClasses.cardBg} border-2 shadow-lg rounded-md`}
                                            >
                                              <div className="flex items-center flex-1">
                                                <div className={`${themeClasses.textMuted} mr-3`}>
                                                  <GripVertical size={16} />
                                                </div>
                                                <div className={`font-medium ${themeClasses.text}`}>
                                                  {productsData?.find(p => p.id === activeId)?.name || 'Producto'}
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </DragOverlay>
                                      </DndContext>
                                    ) : (
                                      <div className="py-2 px-4 bg-gray-50 dark:bg-gray-800 rounded-md mb-2 text-center">
                                        <span className={themeClasses.textMuted}>No hay productos en esta categoría</span>
                                      </div>
                                    )}
                                    {/* Always visible "Añadir producto" button, placed after the product list or "no products" message */}
                                    <div className="mt-4 flex justify-start">
                                      <Button onClick={() => handleAddProduct(category.id)} variant="outline">
                                        <Plus size={12} className="mr-2" />
                                        <span>Añadir producto</span>
                                      </Button>
                                    </div>
                                  </div>
                                </SortableCategory>
                              )
                            })}
                          </SortableContext>

                          {/* Drag overlay for categories */}
                          <DragOverlay>
                            {activeId && activeId.toString().includes('-') && (
                              <div
                                className={`${themeClasses.cardBg} shadow-lg rounded-md p-4 border-2 border-blue-500 dark:border-blue-400`}
                              >
                                <div className="flex items-center mb-2">
                                  <div className={`mr-2 ${themeClasses.textMuted}`}>
                                    <GripVertical size={16} />
                                  </div>
                                  <h4 className={`font-medium ${themeClasses.textSubtle}`}>
                                    {(() => {
                                      const parts = activeId.toString().split('-')
                                      if (parts.length < 2) return 'Categoría'

                                      const menuId = parts[0]
                                      const categoryId = parts[1]
                                      const menu = menusData?.avoqadoMenus?.find(m => m.id === menuId)
                                      if (!menu) return 'Categoría'

                                      const category = menu.categories?.find(c => c.id === categoryId)
                                      return category?.name || 'Categoría'
                                    })()}
                                  </h4>
                                </div>
                              </div>
                            )}
                          </DragOverlay>
                        </DndContext>
                      </div>
                    )}
                  </SortableMenu>
                ))}
              </SortableContext>

              {/* Drag overlay for menus */}
              <DragOverlay>
                {activeId && !activeId.toString().includes('-') && (
                  <div className={`${themeClasses.cardBg} shadow-lg rounded-md p-4 border-2 border-blue-500 dark:border-blue-400`}>
                    <div className="flex items-center">
                      <div className={`mr-2 ${themeClasses.textMuted}`}>
                        <GripVertical size={16} />
                      </div>
                      <div className="flex-1">
                        <h3 className={`font-medium ${themeClasses.text}`}>
                          {menusData?.avoqadoMenus?.find(m => m.id === activeId)?.name || 'Menú'}
                        </h3>
                      </div>
                    </div>
                  </div>
                )}
              </DragOverlay>
            </DndContext>

            {filteredAndSortedMenus?.length === 0 && (
              <div className="p-8 text-center">
                <p className={themeClasses.textMuted}>No se encontraron menús. Crea uno nuevo con el botón "Añadir".</p>
              </div>
            )}
          </div>
        )}
      </main>
      {updateCategoryOrderMutation.isPending && (
        <div className="fixed bottom-4 right-4 bg-blue-500 dark:bg-blue-600 text-white px-4 py-2 rounded shadow-lg z-50">
          Guardando orden...
        </div>
      )}
    </div>
  )
}
