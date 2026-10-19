import { getProducts, updateProduct, deleteProduct } from '@/services/menu.service'
import { productInventoryApi, type AdjustInventoryStockDto } from '@/services/inventory.service'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import {
  ArrowUpDown,
  UploadCloud,
  ImageIcon,
  MoreHorizontal,
  Edit,
  Trash2,
  Package2,
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  Search,
  X,
  ChevronRight,
} from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDebounce } from '@/hooks/useDebounce'
import { FilterPill, CheckboxFilterContent, ColumnCustomizer } from '@/components/filters'
import { useVenueDateTime } from '@/utils/datetime'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import DataTable from '@/components/data-table'
import { AddToAIButton } from '@/components/AddToAIButton'
import { ItemsCell } from '@/components/multiple-cell-values'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Product } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { Currency } from '@/utils/currency'
import { PermissionGate } from '@/components/PermissionGate'
import { InventoryBadge } from '@/components/inventory/InventoryBadge'
import { InventoryDetailsModal } from '@/components/inventory/InventoryDetailsModal'
import { AdjustStockDialog } from '@/components/AdjustStockDialog'
import { useMenuSocketEvents } from '@/hooks/use-menu-socket-events'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'

import { ProductWizardDialog } from '@/pages/Inventory/components/ProductWizardDialog'
import { AvisoAparatosIva } from '@/pages/Menu/Products/components/AvisoAparatosIva'
import { matchesLegacyProductSearch } from '@/services/menu.service'
import { ProductTypeSelectorModal } from '@/pages/Inventory/components/ProductTypeSelectorModal'
import { type ProductType } from '@/services/inventory.service'
import { Sparkles, ArrowRightLeft, HelpCircle, ChefHat as ChefHatIcon, Package as PackageIcon } from 'lucide-react'
import { ConvertToServiceDialog } from '@/pages/Menu/Services/ConvertToServiceDialog'
import { useMenuMakerHeader } from '../MenuMakerLayout'
import { useProductCreationTour } from '@/hooks/useProductCreationTour'
import { useRecipeCreationTour } from '@/hooks/useRecipeCreationTour'
import { TourDiscoveryBanner } from '@/components/onboarding/TourDiscoveryBanner'
import { ProductGroupDialog } from '@/pages/Menu/Products/components/ProductGroupDialog'
import { FamilyVariantRows } from '@/pages/Menu/Products/components/FamilyVariantRows'
import { VariantsMenu } from '@/pages/Menu/Products/components/VariantsMenu'
import { GroupExistingDialog } from '@/pages/Menu/Products/components/GroupExistingDialog'
import { GroupFromSourcesDialog } from '@/pages/Menu/Products/components/GroupFromSourcesDialog'
import { SuggestionsBanner } from '@/pages/Menu/Products/components/SuggestionsBanner'
import { ProductSelectionBar } from '@/pages/Menu/Products/components/ProductSelectionBar'
import { filasConFamilias, rangoDePrecio, type FilaProducto } from '@/pages/Menu/Products/listaConFamilias'
import { esAgrupable, sugerirDesdeNombres, type EstadoAgrupar } from '@/features/product-variants/groupExisting'
import { Checkbox } from '@/components/ui/checkbox'
import { useAccess } from '@/hooks/use-access'
import { textoDelServidor } from '@/utils/apiError'

// 🔴 `flexRender` pinta cada `cell` como componente: si `columns` cambia, React remonta TODAS las celdas y el foco del teclado cae al
// <body>. Por eso las columnas no dependen de nada que cambie en cada render: la fecha usa su propio hook, el interruptor la `mutate`
// estable, y el chevron lee las familias desplegadas de este contexto.
const FamiliasDesplegadas = createContext<{ estaDesplegada: (groupId: string) => boolean; alternar: (groupId: string) => void }>({
  estaDesplegada: () => false,
  alternar: () => {},
})

function ChevronDeFamilia({ groupId, name }: { groupId: string; name: string }) {
  const { t } = useTranslation('variants')
  const { estaDesplegada, alternar } = useContext(FamiliasDesplegadas)
  const desplegada = estaDesplegada(groupId)
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0 cursor-pointer"
      aria-expanded={desplegada}
      aria-label={t('lista.verVariantes', { name })}
      data-tour="products-family-expand"
      onClick={e => {
        e.stopPropagation()
        alternar(groupId)
      }}
    >
      <ChevronRight className={`h-4 w-4 transition-transform ${desplegada ? 'rotate-90' : ''}`} />
    </Button>
  )
}

function FechaActualizada({ value }: { value: string }) {
  const { formatDate } = useVenueDateTime()
  return <span>{formatDate(value)}</span>
}

// «Elegir para agrupar»: casillas PROPIAS (la selección interna de DataTable se borra cuando cambian los datos). Lo elegido se guarda
// con el producto en la mano al elegirlo, en orden; la casilla lo lee de este contexto para no remontar las celdas en cada clic.
const ElegidosParaAgrupar = createContext<{ elegidos: Map<string, Product>; alternar: (p: Product) => void }>({
  elegidos: new Map(),
  alternar: () => {},
})

function CasillaParaAgrupar({ producto }: { producto: FilaProducto }) {
  const { t } = useTranslation('variants')
  const { elegidos, alternar } = useContext(ElegidosParaAgrupar)
  const agrupable = esAgrupable(producto)
  return (
    <span className="flex" title={agrupable ? undefined : t('agrupar.noAgrupable')} onClick={e => e.stopPropagation()}>
      <Checkbox
        checked={elegidos.has(producto.id)}
        disabled={!agrupable}
        onCheckedChange={() => alternar(producto)}
        aria-label={t('agrupar.elegirProducto', { name: producto.name })}
        data-tour="products-group-select"
      />
    </span>
  )
}

function EncabezadoParaAgrupar() {
  const { t } = useTranslation('variants')
  return <span className="sr-only">{t('agrupar.elegir')}</span>
}

const COLUMNA_PARA_AGRUPAR: ColumnDef<FilaProducto, unknown> = {
  id: 'select',
  header: () => <EncabezadoParaAgrupar />,
  cell: ({ row }) => <CasillaParaAgrupar producto={row.original} />,
  size: 40,
  enableSorting: false,
}

export default function Products() {
  const { t } = useTranslation('menu')
  const { t: tCommon } = useTranslation('common')
  const { venueId, fullBasePath } = useCurrentVenue()
  const { checkFeatureAccess } = useAuth()
  const hasChatbot = checkFeatureAccess('CHATBOT')


  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  })
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false)
  const [adjustStockDialogOpen, setAdjustStockDialogOpen] = useState(false)
  const [productToAdjust, setProductToAdjust] = useState<Product | null>(null)
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)
  const [typeSelectorOpen, setTypeSelectorOpen] = useState(false)
  const [selectedProductType, setSelectedProductType] = useState<ProductType | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editProductId, setEditProductId] = useState<string | null>(null)
  const [editWizardOpen, setEditWizardOpen] = useState(false)
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [productToConvert, setProductToConvert] = useState<Product | null>(null)

  // Variantes: la familia abierta en ProductGroupDialog (`?familia=<groupId>` la abre al cargar) y las desplegadas en la lista.
  const { t: tV } = useTranslation('variants')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [familiaAbierta, setFamiliaAbierta] = useState<string | null>(() => searchParams.get('familia') || null)
  const [expandidas, setExpandidas] = useState<Set<string>>(() => new Set())

  // Agrupar productos que ya existen: modo «elegir» (casillas + barra) → diálogo con vista previa → la familia nueva se abre.
  const puedeAgrupar = useAccess().can('menu:update')
  const [modoAgrupar, setModoAgrupar] = useState(false)
  const [elegidos, setElegidos] = useState<Map<string, Product>>(() => new Map())
  const [agrupando, setAgrupando] = useState<EstadoAgrupar | null>(null)
  const [fuentesAbiertas, setFuentesAbiertas] = useState(false) // «Agrupar productos que ya tengo»: sugerencias y archivo de Shopify
  const alternarElegido = useCallback((p: Product) => {
    setElegidos(prev => {
      const siguiente = new Map(prev)
      if (!siguiente.delete(p.id)) siguiente.set(p.id, p)
      return siguiente
    })
  }, [])
  const seleccionParaAgrupar = useMemo(() => ({ elegidos, alternar: alternarElegido }), [elegidos, alternarElegido])
  const salirDeAgrupar = useCallback(() => {
    setModoAgrupar(false)
    setElegidos(new Map())
  }, [])
  const abrirAgrupar = () => {
    const lista = [...elegidos.values()]
    const { parentName, valores, opcion } = sugerirDesdeNombres(lista.map(p => p.name))
    setAgrupando({
      name: parentName,
      optionNames: [opcion ?? ''],
      members: lista.map((p, i) => ({ productId: p.id, name: p.name, sku: p.sku || undefined, values: [valores[i]] })),
    })
  }

  const entradasDeVariantes = useMemo(
    () => [
      ...(puedeAgrupar
        ? [
            { key: 'agrupar', label: tV('agrupar.elegir'), onSelect: () => setModoAgrupar(true), requierePlan: true },
            { key: 'fuentes', label: tV('fuentes.titulo'), onSelect: () => setFuentesAbiertas(true), requierePlan: true },
          ]
        : []),
      {
        key: 'opciones-guardadas',
        label: tV('lista.opcionesGuardadas'),
        onSelect: () => navigate(`${fullBasePath}/menumaker/product-options`),
      },
    ],
    [tV, navigate, fullBasePath, puedeAgrupar],
  )

  // Interactive onboarding tours
  const { start: startProductTour } = useProductCreationTour()
  const { start: startRecipeTour } = useRecipeCreationTour()

  // Push header into MenuMakerLayout (title + actions appear above tabs)
  const { setHeader } = useMenuMakerHeader()
  useEffect(() => {
    setHeader({
      title: (
        <PageTitleWithInfo
          title={t('products.title')}
          className="text-xl font-semibold"
          tooltip={t('info.products', {
            defaultValue: 'Lista y administra productos, precios, inventario y visibilidad en el menu.',
          })}
        />
      ),
      actions: (
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <HelpCircle className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {t('tour.launchButton', { defaultValue: '¿Cómo crear un producto?' })}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>
                {t('tour.menuLabel', { defaultValue: 'Tours interactivos' })}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={startProductTour} className="gap-3 py-3">
                <PackageIcon className="h-5 w-5 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {t('tour.productSimple.title', { defaultValue: 'Producto simple' })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('tour.productSimple.subtitle', {
                      defaultValue: 'Merch, botellas, chips empacados',
                    })}
                  </p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={startRecipeTour} className="gap-3 py-3">
                <ChefHatIcon className="h-5 w-5 text-orange-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {t('tour.productRecipe.title', { defaultValue: 'Producto con receta' })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('tour.productRecipe.subtitle', {
                      defaultValue: 'Shakes, lattes, bebidas frescas',
                    })}
                  </p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <PermissionGate permission="menu:read">
            <VariantsMenu items={entradasDeVariantes} />
          </PermissionGate>
          <PermissionGate permission="menu:create">
            <Button
              data-tour="product-new-btn"
              onClick={() => setTypeSelectorOpen(true)}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              <span>{t('products.new')}</span>
            </Button>
          </PermissionGate>
        </div>
      ),
    })
    return () => setHeader({})
  }, [t, setHeader, startProductTour, startRecipeTour, entradasDeVariantes])

  // ✅ STRIPE-STYLE FILTERS: State for FilterPills
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [inventoryFilter, setInventoryFilter] = useState<string[]>([])
  const [stockFilter, setStockFilter] = useState<string[]>([])

  // Column visibility state
  const defaultVisibleColumns = ['imageUrl', 'name', 'price', 'stock', 'categories', 'available', 'actions']
  const [visibleColumns, setVisibleColumns] = useState<string[]>(defaultVisibleColumns)

  // ✅ WORLD-CLASS: Fetch products sorted alphabetically by name
  const {
    data: products,
    isLoading,
    isError,
    isFetching,
    refetch,
    dataUpdatedAt: _dataUpdatedAt,
  } = useQuery({
    queryKey: ['products', venueId, 'orderBy:name'],
    queryFn: () => getProducts(venueId!, { orderBy: 'name' }),
    // ✅ FIX: Reduce staleTime to keep inventory data fresh
    // Especially important for RECIPE products where availableQuantity
    // can change when ingredient stock updates
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  })

  // ✅ REAL-TIME: Listen to menu/inventory socket events for automatic badge updates
  useMenuSocketEvents(venueId, {
    onAvailabilityChanged: () => {
      // Invalidate products query when inventory changes
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
    },
    onMenuItemUpdated: () => {
      // Invalidate on any menu item update
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
    },
  })

  // ✅ SQUARE POS PATTERN: Calculate low stock items (memoized for performance)
  const lowStockProducts = useMemo(() => {
    if (!products) return []

    return products.filter(product => {
      // Only check products with inventory tracking
      if (!product.trackInventory || !product.inventoryMethod) return false

      // For QUANTITY method: check against reorder point OR custom threshold
      if (product.inventoryMethod === 'QUANTITY') {
        const currentStock = Number(product.inventory?.currentStock ?? 0)
        // Use custom threshold if set, otherwise fall back to reorderPoint
        const threshold = product.lowStockThreshold ?? Number(product.inventory?.minimumStock ?? 10)
        return currentStock <= threshold
      }

      // For RECIPE method: check availableQuantity against custom threshold
      if (product.inventoryMethod === 'RECIPE') {
        const availableQuantity = product.availableQuantity ?? 0
        // Use custom threshold if set, otherwise default to 5 portions
        const threshold = product.lowStockThreshold ?? 5
        return availableQuantity <= threshold
      }

      return false
    })
  }, [products])

  // ✅ STRIPE-STYLE: Extract unique categories from products
  const categoryOptions = useMemo(() => {
    if (!products) return []
    const categories = new Map<string, string>()
    products.forEach(product => {
      if (product.category) {
        categories.set(product.category.id, product.category.name)
      }
    })
    return Array.from(categories.entries()).map(([id, name]) => ({
      value: id,
      label: name,
    }))
  }, [products])

  // ✅ Status filter options
  const statusOptions = useMemo(
    () => [
      { value: 'active', label: t('products.filters.active', { defaultValue: 'Activo' }) },
      { value: 'inactive', label: t('products.filters.inactive', { defaultValue: 'Inactivo' }) },
    ],
    [t],
  )

  // ✅ Inventory method filter options
  const inventoryOptions = useMemo(
    () => [
      { value: 'QUANTITY', label: t('products.filters.inventoryQuantity', { defaultValue: 'Por cantidad' }) },
      { value: 'RECIPE', label: t('products.filters.inventoryRecipe', { defaultValue: 'Por receta' }) },
      { value: 'NONE', label: t('products.filters.inventoryNone', { defaultValue: 'Sin inventario' }) },
    ],
    [t],
  )

  // ✅ Stock status filter options
  const stockOptions = useMemo(
    () => [
      { value: 'low', label: t('products.filters.lowStock', { defaultValue: 'Stock bajo' }) },
      { value: 'normal', label: t('products.filters.normalStock', { defaultValue: 'Stock normal' }) },
    ],
    [t],
  )

  // ✅ Helper to get display label for active filters
  const getFilterDisplayLabel = useCallback((values: string[], options: { value: string; label: string }[]) => {
    if (values.length === 0) return null
    if (values.length === 1) {
      const option = options.find(o => o.value === values[0])
      return option?.label || values[0]
    }
    return `${values.length} ${t('common:selected', { defaultValue: 'seleccionados' })}`
  }, [t])

  // ✅ Count active filters
  const activeFiltersCount = useMemo(
    () =>
      [
        categoryFilter.length > 0,
        statusFilter.length > 0,
        inventoryFilter.length > 0,
        stockFilter.length > 0,
        debouncedSearchTerm !== '',
      ].filter(Boolean).length,
    [categoryFilter, statusFilter, inventoryFilter, stockFilter, debouncedSearchTerm],
  )

  // ✅ Reset all filters
  const resetFilters = useCallback(() => {
    setCategoryFilter([])
    setStatusFilter([])
    setInventoryFilter([])
    setStockFilter([])
    setSearchTerm('')
    setShowLowStockOnly(false)
  }, [])

  // ✅ STRIPE-STYLE: Filter products based on all active filters
  const filteredProducts = useMemo(() => {
    if (!products) return products

    const SERVICE_TYPES = ['APPOINTMENTS_SERVICE', 'CLASS']
    let result = products.filter(p => !SERVICE_TYPES.includes(p.type))

    // Filter by low stock (legacy toggle, kept for alert banner)
    if (showLowStockOnly) {
      result = lowStockProducts
    }

    // Filter by search term
    if (debouncedSearchTerm) {
      result = result.filter(product => matchesLegacyProductSearch(product, debouncedSearchTerm))
    }

    // Filter by category
    if (categoryFilter.length > 0) {
      result = result.filter(product => product.category && categoryFilter.includes(product.category.id))
    }

    // Filter by status
    if (statusFilter.length > 0) {
      result = result.filter(product => {
        const isActive = product.active
        return (statusFilter.includes('active') && isActive) || (statusFilter.includes('inactive') && !isActive)
      })
    }

    // Filter by inventory method
    if (inventoryFilter.length > 0) {
      result = result.filter(product => {
        if (inventoryFilter.includes('NONE') && !product.trackInventory) return true
        if (product.trackInventory && product.inventoryMethod && inventoryFilter.includes(product.inventoryMethod)) return true
        return false
      })
    }

    // Filter by stock status
    if (stockFilter.length > 0) {
      result = result.filter(product => {
        const isLowStock = lowStockProducts.some(p => p.id === product.id)
        return (stockFilter.includes('low') && isLowStock) || (stockFilter.includes('normal') && !isLowStock)
      })
    }

    return result
  }, [products, showLowStockOnly, lowStockProducts, debouncedSearchTerm, categoryFilter, statusFilter, inventoryFilter, stockFilter])

  // Cada familia es UNA fila («Playera · 8 variantes»). Sin familias es la misma lista, objeto por objeto.
  const filas = useMemo(() => filasConFamilias(filteredProducts ?? []), [filteredProducts])

  // Con búsqueda activa las familias que coinciden salen desplegadas; `expandidas` guarda las que el chevron invirtió.
  const busquedaActiva = debouncedSearchTerm !== ''
  useEffect(() => {
    setExpandidas(prev => (prev.size ? new Set() : prev))
  }, [busquedaActiva])
  const estaDesplegada = useCallback((groupId: string) => expandidas.has(groupId) !== busquedaActiva, [expandidas, busquedaActiva])
  const alternarFamilia = useCallback((groupId: string) => {
    setExpandidas(prev => {
      const siguiente = new Set(prev)
      if (!siguiente.delete(groupId)) siguiente.add(groupId)
      return siguiente
    })
  }, [])
  const familiasDesplegadas = useMemo(() => ({ estaDesplegada, alternar: alternarFamilia }), [estaDesplegada, alternarFamilia])

  // Una variante (o su familia) se edita en la familia; un producto suelto sigue abriendo el asistente.
  const abrirProducto = useCallback((p: FilaProducto) => {
    const groupId = p.__familia?.groupId ?? p.productGroupId
    if (groupId) {
      setFamiliaAbierta(groupId)
      return
    }
    setEditProductId(p.id)
    setEditWizardOpen(true)
  }, [])

  const cerrarFamilia = useCallback(() => {
    setFamiliaAbierta(null)
    if (!searchParams.has('familia')) return
    const sinFamilia = new URLSearchParams(searchParams)
    sinFamilia.delete('familia')
    setSearchParams(sinFamilia, { replace: true })
  }, [searchParams, setSearchParams])

  const toggleActive = useMutation({
    mutationFn: async ({ productId, status }: { productId: string; status: boolean }) => {
      await updateProduct(venueId!, productId, { active: status })
      return { productId, status }
    },
    onMutate: async ({ productId, status }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['products', venueId] })

      // Snapshot the previous value and timestamp
      const previousProducts = queryClient.getQueryData<Product[]>(['products', venueId])
      const timestamp = Date.now()

      // Find the specific product to check its current state
      const targetProduct = previousProducts?.find(p => p.id === productId)
      const previousActiveState = targetProduct?.active

      // Optimistically update the cache
      queryClient.setQueryData<Product[]>(['products', venueId], old => {
        if (!old) return old
        return old.map(product => (product.id === productId ? { ...product, active: status } : product))
      })

      // Return context with snapshot, timestamp, and previous state
      return { previousProducts, timestamp, productId, previousActiveState }
    },
    onError: (error, _variables, _context) => {
      // ✅ FIX: Instead of blind rollback, invalidate queries to get fresh server state
      // This prevents restoring incorrect state if someone else modified it
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })

      // El texto del server si viene (en español); si no, el nuestro — nunca el de axios en inglés.
      toast({
        title: tCommon('error'),
        description: textoDelServidor(error) ?? t('products.toasts.statusError'),
        variant: 'destructive',
      })
    },
    onSuccess: (data, variables, _context) => {
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })

      // Verify the operation completed successfully by checking current state
      const currentProducts = queryClient.getQueryData<Product[]>(['products', venueId])
      const currentProduct = currentProducts?.find(p => p.id === variables.productId)

      // If current state doesn't match what we expect, show warning
      if (currentProduct && currentProduct.active !== variables.status) {
        toast({
          title: tCommon('warning'),
          description: 'Product status may have been modified by another user. Refreshing data...',
          variant: 'default',
        })
        return
      }

      toast({
        title: data.status ? t('products.toasts.activated') : t('products.toasts.deactivated'),
        description: t('products.toasts.saved'),
      })
    },
  })

  // `mutate` es estable (useCallback de TanStack); el objeto `toggleActive` es nuevo en cada render.
  const { mutate: cambiarActivo } = toggleActive

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      await deleteProduct(venueId!, productId)
      return productId
    },
    onSuccess: () => {
      setDeleteDialogOpen(false)
      setProductToDelete(null)
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
      toast({
        title: t('products.detail.toasts.deleted'),
        description: t('products.detail.toasts.deletedDesc'),
      })
    },
    onError: () => {
      setDeleteDialogOpen(false)
      toast({
        title: tCommon('error'),
        description: t('products.detail.toasts.saveErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  const adjustStockMutation = useMutation({
    mutationFn: async ({
      productId,
      adjustment,
      reason,
      notes,
    }: {
      productId: string
      adjustment: number
      reason: string
      notes: string
    }) => {
      const payload: AdjustInventoryStockDto = {
        type: 'ADJUSTMENT',
        quantity: adjustment,
        reason: `${reason}${notes ? ` - ${notes}` : ''}`,
      }
      return await productInventoryApi.adjustStock(venueId!, productId, payload)
    },
    onSuccess: () => {
      setAdjustStockDialogOpen(false)
      setProductToAdjust(null)
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
      toast({
        title: t('products.toasts.saved'),
        description: 'Stock adjusted successfully',
      })
    },
    onError: (error: any) => {
      toast({
        title: tCommon('error'),
        description: error.response?.data?.message || 'Failed to adjust stock',
        variant: 'destructive',
      })
    },
  })

  const columns: ColumnDef<FilaProducto, unknown>[] = useMemo(() => [
    // AI column - only show if venue has chatbot feature
    ...(hasChatbot
      ? [
          {
            id: 'ai',
            header: () => <span className="sr-only">{tCommon('screenReaderOnly.ai')}</span>,
            cell: ({ row }: { row: { original: FilaProducto } }) =>
              row.original.__familia ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <div className="flex justify-center">
                  <AddToAIButton type="product" data={row.original} variant="icon" />
                </div>
              ),
            size: 50,
            enableSorting: false,
          } as ColumnDef<FilaProducto, unknown>,
        ]
      : []),
    {
      id: 'imageUrl',
      accessorKey: 'imageUrl',
      sortDescFirst: true,
      meta: { label: t('products.columns.photo') },
      header: () => <div className=" flex-row-center">{t('products.columns.photo')}</div>,

      cell: ({ cell, row }) => {
        const imageUrl = cell.getValue() as string
        const productId = row.original.id
        const hasError = imageErrors[productId]

        return (
          <div className="w-12 h-12 overflow-hidden bg-muted rounded">
            {imageUrl && !hasError ? (
              <img
                src={imageUrl}
                alt={t('products.imageAlt')}
                className="object-cover h-12 w-12"
                onError={() => setImageErrors(prev => ({ ...prev, [productId]: true }))}
              />
            ) : imageUrl && hasError ? (
              <div className="flex items-center justify-center w-full h-full bg-muted">
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
              </div>
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                <UploadCloud className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </div>
        )
      },
    },
    {
      id: 'name',
      accessorKey: 'name',
      sortDescFirst: true,
      meta: { label: t('products.columns.name') },
      header: ({ column }) => (
        <div onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="cursor-pointer flex-row-center">
          {t('products.columns.name')}
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </div>
      ),

      cell: ({ cell, row }) => {
        const familia = row.original.__familia
        if (!familia) return cell.getValue() as string
        return (
          <div className="flex items-center gap-2">
            <ChevronDeFamilia groupId={familia.groupId} name={familia.name} />
            <span>{familia.name}</span>
            <Badge variant="secondary" className="text-xs">
              {tV('lista.variantes', { count: familia.variantes.length })}
            </Badge>
          </div>
        )
      },
    },
    {
      id: 'price',
      accessorKey: 'price',
      sortDescFirst: true,
      meta: { label: t('products.columns.price') },
      header: ({ column }) => (
        <div onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="cursor-pointer flex-row-center">
          {t('products.columns.price')}
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </div>
      ),

      cell: ({ cell, row }) => {
        const familia = row.original.__familia
        if (familia) {
          const { min, max } = rangoDePrecio(familia)
          return <ul>{min === max ? Currency(min) : tV('lista.desde', { precio: Currency(min) })}</ul>
        }
        const price = cell.getValue() as number
        return <ul>{Currency(price)}</ul>
      },
    },
    {
      id: 'recipe',
      meta: { label: 'Receta' },
      header: 'Costo / Receta',
      enableColumnFilter: false,
      cell: ({ row }) => {
        const product = row.original
        if (product.__familia) return <span className="text-muted-foreground">—</span>
        return (
          <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-muted-foreground hover:text-primary">
            <Link to={`${fullBasePath}/inventory/recipes?productId=${product.id}`}>
              <ChefHat className="mr-2 h-4 w-4" />
              <span className="text-xs decoration-dashed underline">Ver Costo</span>
            </Link>
          </Button>
        )
      },
    },
    {
      id: 'stock',
      accessorKey: 'availableQuantity',
      meta: { label: t('products.columns.stock') },
      header: t('products.columns.stock'),
      enableColumnFilter: false,
      cell: ({ row }) => {
        const product = row.original
        if (product.__familia) {
          // La suma de lo que InventoryBadge muestra en cada variante que lleva existencias.
          const conInventario = product.__familia.variantes.filter(v => v.trackInventory)
          if (conInventario.length === 0) return <span className="text-muted-foreground">—</span>
          return (
            <span className="text-sm font-medium tabular-nums">
              {conInventario.reduce((suma, v) => suma + (v.availableQuantity ?? 0), 0)}
            </span>
          )
        }

        return (
          <InventoryBadge
            product={product}
            onClick={() => {
              setSelectedProduct(product)
              setIsInventoryModalOpen(true)
            }}
          />
        )
      },
    },

    {
      id: 'categories',
      accessorKey: 'category',
      meta: { label: t('products.columns.categories') },
      header: t('products.columns.categories'),
      enableColumnFilter: false,
      cell: ({ row }) => {
        const category = row.original.category
        // Transform single category to array for ItemsCell
        const categories = category ? [category] : []
        return <ItemsCell cell={{ getValue: () => categories }} max_visible_items={2} />
      },
    },
    {
      id: 'modifierGroups',
      accessorKey: 'modifierGroups',
      meta: { label: t('products.columns.modifierGroups') },
      header: t('products.columns.modifierGroups'),
      enableColumnFilter: false,
      cell: ({ row }) => {
        if (row.original.__familia) return <span className="text-muted-foreground">—</span>
        const modifierGroups = row.original.modifierGroups || []
        // Extract the group from each ProductModifierGroup
        const groups = modifierGroups.map(pmg => pmg.group).filter(Boolean)

        if (groups.length === 0) {
          return <span className="text-muted-foreground">-</span>
        }

        return (
          <div className="flex flex-wrap gap-1">
            {groups.slice(0, 3).map(group => (
              <Badge key={group.id} variant="secondary" className="text-xs px-2 py-0.5">
                {group.name}
              </Badge>
            ))}
            {groups.length > 3 && (
              <Badge variant="outline" className="text-xs px-2 py-0.5 text-muted-foreground">
                +{groups.length - 3}
              </Badge>
            )}
          </div>
        )
      },
    },
    {
      id: 'updatedAt',
      accessorKey: 'updatedAt',
      meta: { label: t('products.columns.updatedAt') },
      header: t('products.columns.updatedAt'),
      enableColumnFilter: false,
      cell: ({ cell, row }) => {
        if (row.original.__familia) return <span className="text-muted-foreground">—</span>
        const updatedAt = cell.getValue() as string
        return <FechaActualizada value={updatedAt} />
      },
    },
    {
      id: 'available',
      accessorKey: 'active',
      meta: { label: t('products.columns.available') },
      header: t('products.columns.available'),
      enableColumnFilter: false,
      cell: ({ row }) => {
        const product = row.original
        if (product.__familia) {
          const { variantes } = product.__familia
          return (
            <span className="text-sm text-muted-foreground">
              {tV('lista.activas', { count: variantes.filter(v => v.active).length, total: variantes.length })}
            </span>
          )
        }
        const isActive = product.active

        return (
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <Switch
              checked={isActive}
              onCheckedChange={checked => {
                cambiarActivo({ productId: product.id, status: checked })
              }}
              className={isActive ? 'data-[state=checked]:bg-green-500' : 'data-[state=unchecked]:bg-red-500'}
            />
            {isActive ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <Badge variant="destructive" className="text-xs">
                {t('products.columns.unavailable')}
              </Badge>
            )}
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: t('common:actions'),
      enableColumnFilter: false,
      cell: ({ row }) => {
        const product = row.original

        if (product.__familia) {
          return (
            <PermissionGate permission="menu:update">
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    data-tour="products-family-actions"
                    onClick={e => e.stopPropagation()}
                  >
                    <span className="sr-only">{t('modifiers.actions.openMenu')}</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56" sideOffset={5}>
                  <DropdownMenuItem
                    data-tour="products-family-edit"
                    onClick={e => {
                      e.stopPropagation()
                      abrirProducto(product)
                    }}
                    className="cursor-pointer"
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    {tV('lista.editarFamilia')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </PermissionGate>
          )
        }

        return (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0" onClick={e => e.stopPropagation()}>
                <span className="sr-only">{t('modifiers.actions.openMenu')}</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48" sideOffset={5}>
              <DropdownMenuLabel>{t('common:actions')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <PermissionGate permission="menu:update">
                <DropdownMenuItem
                  onClick={e => {
                    e.stopPropagation()
                    abrirProducto(product)
                  }}
                  className="cursor-pointer"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  {tCommon('edit')}
                </DropdownMenuItem>
              </PermissionGate>
              {/* ✅ TOAST POS PATTERN: Quick stock adjustment from product list */}
              {product.trackInventory && product.inventoryMethod === 'QUANTITY' && (
                <PermissionGate permission="menu:update">
                  <DropdownMenuItem
                    onClick={e => {
                      e.stopPropagation()
                      setProductToAdjust(product)
                      setAdjustStockDialogOpen(true)
                    }}
                    className="cursor-pointer"
                  >
                    <Package2 className="mr-2 h-4 w-4" />
                    {t('products.actions.adjustStock')}
                  </DropdownMenuItem>
                </PermissionGate>
              )}
              {/* Convert to service action — only for convertible types */}
              {['REGULAR', 'FOOD_AND_BEV', 'OTHER'].includes(product.type) && (
                <PermissionGate permission="menu:update">
                  <DropdownMenuItem
                    onClick={e => {
                      e.stopPropagation()
                      setProductToConvert(product)
                      setConvertDialogOpen(true)
                    }}
                    className="cursor-pointer"
                  >
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    {t('services.convert.title')}
                  </DropdownMenuItem>
                </PermissionGate>
              )}
              <PermissionGate permission="menu:delete">
                <DropdownMenuItem
                  onClick={e => {
                    e.stopPropagation()
                    setProductToDelete(product)
                    setDeleteDialogOpen(true)
                  }}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {tCommon('delete')}
                </DropdownMenuItem>
              </PermissionGate>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ], [hasChatbot, t, tCommon, tV, imageErrors, cambiarActivo, fullBasePath, abrirProducto])

  const variantesDesplegadas = useCallback(
    (fila: FilaProducto) => {
      const familia = fila.__familia
      if (!familia || !estaDesplegada(familia.groupId)) return null
      return (
        <FamilyVariantRows
          familia={familia}
          onToggleActive={(variante, activa) => cambiarActivo({ productId: variante.id, status: activa })}
          onVerExistencias={variante => {
            setSelectedProduct(variante)
            setIsInventoryModalOpen(true)
          }}
          onOpen={() => setFamiliaAbierta(familia.groupId)}
        />
      )
    },
    [estaDesplegada, cambiarActivo],
  )

  // ✅ STRIPE-STYLE: Column options for ColumnCustomizer
  const columnOptions = useMemo(() => {
    return columns.map(col => ({
      id: col.id || (col as any).accessorKey || '',
      label: (col.meta as any)?.label || col.id || '',
      visible: visibleColumns.includes(col.id || (col as any).accessorKey || ''),
      disabled: col.id === 'actions', // Actions column is always visible
    }))
  }, [columns, visibleColumns])

  // ✅ Filter columns based on visibility
  const filteredColumns = useMemo(() => {
    const visibles = columns.filter(col => {
      const colId = col.id || (col as any).accessorKey || ''
      return visibleColumns.includes(colId) || colId === 'actions'
    })
    return modoAgrupar ? [COLUMNA_PARA_AGRUPAR, ...visibles] : visibles
  }, [columns, visibleColumns, modoAgrupar])

  // Mientras se elige, tocar la fila marca su casilla (sólo si se puede agrupar); fuera de ese modo abre el producto, como siempre.
  const tocarFila = useCallback(
    (p: FilaProducto) => {
      if (esAgrupable(p)) alternarElegido(p)
    },
    [alternarElegido],
  )

  return (
    <div className="p-4">
      {/* IVA por producto (6b, §5.5): aviso fijo de aparatos viejos, sólo con el IVA encendido. Vive en la página, no en el diálogo. */}
      <AvisoAparatosIva venueId={venueId!} className="mb-4" />

      {/* Discovery banner for first-time admins — dismissable */}
      <TourDiscoveryBanner
        storageKey="menu-products"
        className="mb-4"
        title={t('tour.discoveryBanner.title', {
          defaultValue: '🎓 ¿Primera vez configurando tu menú?',
        })}
        description={t('tour.discoveryBanner.description', {
          defaultValue:
            'Tenemos tours interactivos paso a paso para crear productos simples y con receta.',
        })}
        ctaLabel={t('tour.discoveryBanner.cta', { defaultValue: 'Ver tours' })}
        onStart={startProductTour}
      />

      {/* Variantes: «Encontramos N grupos de productos que parecen variantes» (sólo con plan y permiso de editar) */}
      <SuggestionsBanner venueId={venueId!} onRevisar={() => setFuentesAbiertas(true)} className="mb-4" />

      {/* ✅ Low stock alert banner - Pricing page style */}
      {lowStockProducts.length > 0 && activeFiltersCount === 0 && (
        <button
          type="button"
          onClick={() => setStockFilter(['low'])}
          className="mb-4 p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors cursor-pointer w-full text-left group"
          aria-label={t('products.lowStock.alert', { count: lowStockProducts.length })}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-400">
                  {lowStockProducts.length} {t('products.lowStock.productsLowStock', { defaultValue: 'productos con stock bajo' })}
                </p>
                <p className="text-xs text-red-700 dark:text-red-500">
                  {t('products.lowStock.clickToFilter', { defaultValue: 'Haz clic para filtrar' })}
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-red-600 dark:text-red-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
      )}

      {/* ✅ STRIPE-STYLE FILTERS: Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Expandable search bar */}
        <div className="relative flex items-center">
          {isSearchOpen ? (
            <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('common:search')}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') {
                      if (!searchTerm) setIsSearchOpen(false)
                    }
                  }}
                  className="h-8 w-[200px] pl-8 pr-8 text-sm rounded-full"
                  autoFocus
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => {
                  setSearchTerm('')
                  setIsSearchOpen(false)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant={searchTerm ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search className="h-4 w-4" />
              {searchTerm && <span className="sr-only">{t('common:searchActive')}</span>}
            </Button>
          )}
          {/* Active search indicator dot */}
          {searchTerm && !isSearchOpen && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />}
        </div>

        {/* Category Filter Pill */}
        <FilterPill
          label={t('products.columns.categories')}
          activeValue={getFilterDisplayLabel(categoryFilter, categoryOptions)}
          isActive={categoryFilter.length > 0}
          onClear={() => setCategoryFilter([])}
        >
          <CheckboxFilterContent
            title={t('products.filters.filterByCategory', { defaultValue: 'Filtrar por categoría' })}
            options={categoryOptions}
            selectedValues={categoryFilter}
            onApply={setCategoryFilter}
            searchable={categoryOptions.length > 5}
            searchPlaceholder={t('common:search')}
          />
        </FilterPill>

        {/* Status Filter Pill */}
        <FilterPill
          label={t('products.filters.statusLabel', { defaultValue: 'Estado' })}
          activeValue={getFilterDisplayLabel(statusFilter, statusOptions)}
          isActive={statusFilter.length > 0}
          onClear={() => setStatusFilter([])}
        >
          <CheckboxFilterContent
            title={t('products.filters.filterByStatus', { defaultValue: 'Filtrar por estado' })}
            options={statusOptions}
            selectedValues={statusFilter}
            onApply={setStatusFilter}
          />
        </FilterPill>

        {/* Inventory Method Filter Pill */}
        <FilterPill
          label={t('products.filters.inventoryLabel', { defaultValue: 'Inventario' })}
          activeValue={getFilterDisplayLabel(inventoryFilter, inventoryOptions)}
          isActive={inventoryFilter.length > 0}
          onClear={() => setInventoryFilter([])}
        >
          <CheckboxFilterContent
            title={t('products.filters.filterByInventory', { defaultValue: 'Filtrar por tipo de inventario' })}
            options={inventoryOptions}
            selectedValues={inventoryFilter}
            onApply={setInventoryFilter}
          />
        </FilterPill>

        {/* Stock Status Filter Pill */}
        <FilterPill
          label={t('products.filters.stockLabel', { defaultValue: 'Stock' })}
          activeValue={getFilterDisplayLabel(stockFilter, stockOptions)}
          isActive={stockFilter.length > 0}
          onClear={() => setStockFilter([])}
        >
          <CheckboxFilterContent
            title={t('products.filters.filterByStock', { defaultValue: 'Filtrar por nivel de stock' })}
            options={stockOptions}
            selectedValues={stockFilter}
            onApply={setStockFilter}
          />
        </FilterPill>

        {/* Reset filters button */}
        {activeFiltersCount > 0 && (
          <Button variant="outline" size="sm" onClick={resetFilters} className="h-8 gap-1.5 rounded-full">
            <X className="h-3.5 w-3.5" />
            {t('common:clearFilters', { defaultValue: 'Borrar filtros' })}
          </Button>
        )}

        {/* Column customizer - pushed right */}
        <div className="ml-auto">
          <ColumnCustomizer
            columns={columnOptions}
            onApply={setVisibleColumns}
            label={t('common:columns', { defaultValue: 'Columnas' })}
            title={t('common:editColumns', { defaultValue: 'Editar columnas' })}
          />
        </div>
      </div>

      {isError && (
        <div data-testid="catalog-read-error" role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-input p-3 text-sm">
          <span>{t('catalog.loadError')}</span>
          <Button variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()}>
            {tCommon('errors.retry')}
          </Button>
        </div>
      )}
      {(!isError || products !== undefined) && (
        <FamiliasDesplegadas.Provider value={familiasDesplegadas}>
          <ElegidosParaAgrupar.Provider value={seleccionParaAgrupar}>
            <DataTable
              data={filas}
              rowCount={filas.length}
              columns={filteredColumns}
              isLoading={isLoading}
              enableSearch={false}
              tableId="menu:products"
              pagination={pagination}
              setPagination={setPagination}
              onRowClick={modoAgrupar ? tocarFila : abrirProducto}
              renderSubComponent={variantesDesplegadas}
              getRowId={fila => fila.id}
            />
          </ElegidosParaAgrupar.Provider>
        </FamiliasDesplegadas.Provider>
      )}

      {/* El producto con variantes recién creado se abre ENCIMA de este diálogo: al cerrarlo se sigue con el resto de los grupos. */}
      <GroupFromSourcesDialog
        open={fuentesAbiertas}
        onClose={() => setFuentesAbiertas(false)}
        venueId={venueId!}
        onDone={setFamiliaAbierta}
      />

      {modoAgrupar && <ProductSelectionBar count={elegidos.size} onAgrupar={abrirAgrupar} onCancelar={salirDeAgrupar} />}
      {agrupando && (
        <GroupExistingDialog
          open
          onClose={() => setAgrupando(null)}
          venueId={venueId!}
          inicial={agrupando}
          onDone={groupId => {
            setAgrupando(null)
            salirDeAgrupar()
            setFamiliaAbierta(groupId)
          }}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('products.detail.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('products.detail.deleteMessage')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('forms.buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (productToDelete) {
                  deleteProductMutation.mutate(productToDelete.id)
                }
              }}
              disabled={deleteProductMutation.isPending}
            >
              {deleteProductMutation.isPending ? t('products.detail.toasts.deleted') : t('products.detail.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <InventoryDetailsModal product={selectedProduct} open={isInventoryModalOpen} onOpenChange={setIsInventoryModalOpen} />

      {/* ✅ TOAST POS PATTERN: Quick stock adjustment dialog */}
      <AdjustStockDialog
        open={adjustStockDialogOpen}
        onOpenChange={setAdjustStockDialogOpen}
        product={productToAdjust}
        onConfirm={(adjustment, reason, notes) => {
          if (productToAdjust) {
            adjustStockMutation.mutate({
              productId: productToAdjust.id,
              adjustment,
              reason,
              notes,
            })
          }
        }}
        isLoading={adjustStockMutation.isPending}
      />

      {/* Product Type Selector Modal (shown first) */}
      <ProductTypeSelectorModal
        open={typeSelectorOpen}
        onOpenChange={setTypeSelectorOpen}
        onSelect={(type) => {
          setSelectedProductType(type)
          setWizardOpen(true)
        }}
      />

      {/* Product Wizard (shown after type selection) */}
      <ProductWizardDialog
        open={wizardOpen}
        onOpenChange={(open) => {
          setWizardOpen(open)
          // Reset selected type when wizard closes
          if (!open) {
            setSelectedProductType(null)
          }
        }}
        mode="create"
        productType={selectedProductType}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['products', venueId] })
        }}
      />

      {/* Product Wizard for Edit Mode */}
      <ProductWizardDialog
        open={editWizardOpen}
        onOpenChange={(open) => {
          setEditWizardOpen(open)
          if (!open) {
            setEditProductId(null)
          }
        }}
        mode="edit"
        productId={editProductId ?? undefined}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['products', venueId] })
        }}
      />

      {/* Variantes: un producto con variantes (la familia) se edita aquí, nunca en el asistente de producto suelto */}
      <ProductGroupDialog open={familiaAbierta !== null} onClose={cerrarFamilia} venueId={venueId!} groupId={familiaAbierta} />

      {/* Convert to Service Dialog */}
      <ConvertToServiceDialog
        open={convertDialogOpen}
        onOpenChange={(open) => {
          setConvertDialogOpen(open)
          if (!open) setProductToConvert(null)
        }}
        productId={productToConvert?.id ?? null}
        productName={productToConvert?.name ?? ''}
      />
    </div>
  )
}
