import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { getProducts, getMenuCategories } from '@/services/menu.service'
import { purchaseOrderService, type PurchaseOrder } from '@/services/purchaseOrder.service'
import { labelService, LABEL_TYPES, type BarcodeFormat } from '@/services/label.service'
import type { Product, MenuCategory } from '@/types'
import { CheckCircle2, Download, Loader2, Printer, Search, Star, Trash2, FolderOpen } from 'lucide-react'

interface InventoryLabelModalProps {
  open: boolean
  onClose: () => void
  venueId: string
}

interface LabelItemRow {
  productId: string
  name: string
  sku?: string | null
  quantity: number
}

const BARCODE_OPTIONS: { value: BarcodeFormat; label: string }[] = [
  { value: 'SKU', label: 'SKU' },
  { value: 'GTIN', label: 'GTIN' },
  { value: 'NONE', label: 'Ninguno' },
]

export function InventoryLabelModal({ open, onClose, venueId }: InventoryLabelModalProps) {
  const { toast } = useToast()

  // Label config state
  const [labelType, setLabelType] = useState('avery-5160')
  const [barcodeFormat, setBarcodeFormat] = useState<BarcodeFormat>('SKU')
  const [details, setDetails] = useState({
    sku: true,
    gtin: false,
    variantName: false,
    price: true,
    itemName: true,
    unitAbbr: false,
  })

  // Items state
  const [items, setItems] = useState<LabelItemRow[]>([])
  const [generating, setGenerating] = useState(false)

  // Success state
  const [successData, setSuccessData] = useState<{ blob: Blob; totalLabels: number } | null>(null)

  // Category dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set())
  const [categorySearch, setCategorySearch] = useState('')

  // Purchase order dialog state
  const [poDialogOpen, setPoDialogOpen] = useState(false)
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null)
  const [poSearch, setPoSearch] = useState('')

  // Product search state
  const [productSearch, setProductSearch] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Data queries
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products', venueId],
    queryFn: () => getProducts(venueId, { orderBy: 'name' }),
    enabled: open,
  })

  const { data: categories = [] } = useQuery<MenuCategory[]>({
    queryKey: ['menuCategories', venueId],
    queryFn: () => getMenuCategories(venueId),
    enabled: open,
  })

  const { data: purchaseOrders = [] } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchaseOrders', venueId],
    queryFn: async () => {
      const result = await purchaseOrderService.getPurchaseOrders(venueId)
      return Array.isArray(result) ? result : result?.data ?? []
    },
    enabled: open,
  })

  // Product search suggestions
  const suggestions = useMemo(() => {
    if (!productSearch.trim()) return []
    const term = productSearch.toLowerCase()
    const existingIds = new Set(items.map(i => i.productId))
    return products
      .filter(
        p =>
          !existingIds.has(p.id) &&
          (p.name.toLowerCase().includes(term) ||
            p.sku?.toLowerCase().includes(term) ||
            p.gtin?.toLowerCase().includes(term)),
      )
      .slice(0, 8)
  }, [productSearch, products, items])

  // Filtered categories for dialog
  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories
    const term = categorySearch.toLowerCase()
    return categories.filter(c => c.name.toLowerCase().includes(term))
  }, [categorySearch, categories])

  const toggleDetail = (key: keyof typeof details) => {
    setDetails(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const addProduct = (product: Product) => {
    if (items.some(i => i.productId === product.id)) return
    setItems(prev => [
      ...prev,
      { productId: product.id, name: product.name, sku: product.sku, quantity: 1 },
    ])
    setProductSearch('')
    setShowSuggestions(false)
  }

  const removeItem = (productId: string) => {
    setItems(prev => prev.filter(i => i.productId !== productId))
  }

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) return
    setItems(prev => prev.map(i => (i.productId === productId ? { ...i, quantity } : i)))
  }

  const handleAddFromCategories = () => {
    const existingIds = new Set(items.map(i => i.productId))
    const newItems: LabelItemRow[] = products
      .filter(p => selectedCategoryIds.has(p.categoryId) && !existingIds.has(p.id))
      .map(p => ({ productId: p.id, name: p.name, sku: p.sku, quantity: 1 }))

    setItems(prev => [...prev, ...newItems])
    setCategoryDialogOpen(false)
    setSelectedCategoryIds(new Set())
    setCategorySearch('')

    if (newItems.length > 0) {
      toast({ title: `${newItems.length} artículo(s) agregado(s)` })
    }
  }

  const filteredPurchaseOrders = useMemo(() => {
    if (!poSearch.trim()) return purchaseOrders
    const term = poSearch.toLowerCase()
    return purchaseOrders.filter(
      po =>
        po.orderNumber.toLowerCase().includes(term) ||
        po.supplier?.name?.toLowerCase().includes(term),
    )
  }, [poSearch, purchaseOrders])

  const handleAddFromPO = () => {
    if (!selectedPoId) return
    const po = purchaseOrders.find(p => p.id === selectedPoId)
    if (!po?.items?.length) return

    const existingIds = new Set(items.map(i => i.productId))
    const newItems: LabelItemRow[] = []

    for (const poItem of po.items) {
      const rm = poItem.rawMaterial
      if (!rm) continue

      // Try to find a matching product by SKU
      const matchedProduct = rm.sku
        ? products.find(p => p.sku === rm.sku && !existingIds.has(p.id))
        : null

      if (matchedProduct) {
        existingIds.add(matchedProduct.id)
        newItems.push({
          productId: matchedProduct.id,
          name: matchedProduct.name,
          sku: matchedProduct.sku,
          quantity: poItem.quantityOrdered || 1,
        })
      }
    }

    setItems(prev => [...prev, ...newItems])
    setPoDialogOpen(false)
    setSelectedPoId(null)
    setPoSearch('')

    if (newItems.length > 0) {
      toast({ title: `${newItems.length} artículo(s) agregado(s) desde pedido` })
    } else {
      toast({
        title: 'No se encontraron productos coincidentes',
        description: 'Los artículos del pedido no coinciden con productos del menú por SKU',
        variant: 'destructive',
      })
    }
  }

  const handleGenerate = async () => {
    if (items.length === 0) {
      toast({ title: 'Selecciona al menos un artículo', variant: 'destructive' })
      return
    }

    setGenerating(true)
    try {
      const result = await labelService.generateProductLabels(venueId, {
        labelType,
        barcodeFormat,
        details,
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
      })

      setSuccessData(result)
    } catch {
      toast({ title: 'Error al generar etiquetas', variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = () => {
    if (!successData) return
    const url = URL.createObjectURL(successData.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `etiquetas-productos-${Date.now()}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    if (!successData) return
    const url = URL.createObjectURL(successData.blob)
    const printWindow = window.open(url)
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.print()
      })
    }
    // Cleanup after a delay to allow print dialog to open
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  const handleClose = () => {
    setSuccessData(null)
    onClose()
  }

  const groupedLabelTypes = useMemo(() => {
    const groups: Record<string, typeof LABEL_TYPES> = {}
    LABEL_TYPES.forEach(lt => {
      if (!groups[lt.category]) groups[lt.category] = []
      groups[lt.category].push(lt)
    })
    return groups
  }, [])

  return (
    <>
      <FullScreenModal
        open={open}
        onClose={handleClose}
        title={successData ? `Se han creado ${successData.totalLabels} etiquetas` : 'Crear etiquetas'}
        actions={
          !successData ? (
            <Button onClick={handleGenerate} disabled={generating || items.length === 0}>
              {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear etiquetas
            </Button>
          ) : undefined
        }
      >
        {/* Success Screen */}
        {successData ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-20">
            <CheckCircle2 className="h-24 w-24 text-foreground stroke-[1.2]" />
            <p className="mt-6 text-lg font-semibold">Ya puedes usar tus etiquetas</p>
            <div className="mt-8 flex gap-4">
              <Button variant="outline" size="lg" className="min-w-[200px]" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Descargar PDF
              </Button>
              <Button size="lg" className="min-w-[200px]" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir etiquetas ahora
              </Button>
            </div>
          </div>
        ) : (
        <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
          {/* Label Configuration */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Seleccionar etiqueta</h2>
            <div className="rounded-lg border border-border/40">
              {/* Label type */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                <Label className="text-sm font-medium">Tipo de etiqueta</Label>
                <Select value={labelType} onValueChange={setLabelType}>
                  <SelectTrigger className="w-[320px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(groupedLabelTypes).map(([category, templates]) => (
                      <div key={category}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                          {category}
                        </div>
                        {templates.map(t => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Barcode format */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                <Label className="text-sm font-medium">Formato del código de barras</Label>
                <Select value={barcodeFormat} onValueChange={v => setBarcodeFormat(v as BarcodeFormat)}>
                  <SelectTrigger className="w-[320px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BARCODE_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Details checkboxes */}
              <div className="px-4 py-3">
                <Label className="text-sm font-medium mb-3 block">Detalles de la etiqueta</Label>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    ['sku', 'SKU'],
                    ['gtin', 'GTIN'],
                    ['variantName', 'Nombre variante'],
                    ['price', 'Precio'],
                    ['itemName', 'Nombre artículo'],
                    ['unitAbbr', 'Abrev. unidad'],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={details[key]}
                        onCheckedChange={() => toggleDetail(key)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Item Selection */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Seleccionar artículos</h2>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-11 justify-center"
                onClick={() => setCategoryDialogOpen(true)}
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                Seleccionar por categoría
              </Button>
              <Button
                variant="outline"
                className="h-11 justify-center"
                onClick={() => setPoDialogOpen(true)}
              >
                <Star className="mr-2 h-4 w-4" />
                Seleccionar desde el pedido
              </Button>
            </div>

            {/* Product search */}
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Introduce el SKU, el GTIN o el nombre del artículo"
                  value={productSearch}
                  onChange={e => {
                    setProductSearch(e.target.value)
                    setShowSuggestions(true)
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="pl-10"
                />
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-md border border-border/40 bg-popover shadow-md max-h-60 overflow-y-auto">
                  {suggestions.map(product => (
                    <button
                      key={product.id}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex justify-between items-center"
                      onMouseDown={() => addProduct(product)}
                    >
                      <span className="font-medium">{product.name}</span>
                      {product.sku && (
                        <span className="text-muted-foreground text-xs">{product.sku}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Items table */}
            {items.length > 0 && (
              <div className="rounded-lg border border-border/40 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium">Artículo</th>
                      <th className="px-4 py-2 text-left font-medium w-28">Cant.</th>
                      <th className="px-4 py-2 w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.productId} className="border-b border-border/40 last:border-0">
                        <td className="px-4 py-2">
                          <div className="font-medium">{item.name}</div>
                          {item.sku && (
                            <div className="text-xs text-muted-foreground">{item.sku}</div>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={e => updateQuantity(item.productId, parseInt(e.target.value) || 1)}
                            className="w-20 h-8"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => removeItem(item.productId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {items.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Agrega artículos usando la búsqueda o seleccionando por categoría
              </div>
            )}
          </section>
        </div>
        )}
      </FullScreenModal>

      {/* Category Selection Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Seleccionar por categoría</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar categoría..."
                value={categorySearch}
                onChange={e => setCategorySearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredCategories.map(cat => (
                <label
                  key={cat.id}
                  className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent cursor-pointer"
                >
                  <Checkbox
                    checked={selectedCategoryIds.has(cat.id)}
                    onCheckedChange={() => {
                      setSelectedCategoryIds(prev => {
                        const next = new Set(prev)
                        if (next.has(cat.id)) next.delete(cat.id)
                        else next.add(cat.id)
                        return next
                      })
                    }}
                  />
                  {cat.imageUrl && (
                    <img
                      src={cat.imageUrl}
                      alt={cat.name}
                      className="h-8 w-8 rounded object-cover"
                    />
                  )}
                  <span className="text-sm font-medium">{cat.name}</span>
                </label>
              ))}
              {filteredCategories.length === 0 && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No se encontraron categorías
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddFromCategories} disabled={selectedCategoryIds.size === 0}>
              Listo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase Order Selection Dialog */}
      <Dialog open={poDialogOpen} onOpenChange={setPoDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Seleccionar pedido</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Haz una búsqueda"
                value={poSearch}
                onChange={e => setPoSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredPurchaseOrders.map(po => (
                <label
                  key={po.id}
                  className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent cursor-pointer"
                >
                  <Checkbox
                    checked={selectedPoId === po.id}
                    onCheckedChange={() =>
                      setSelectedPoId(prev => (prev === po.id ? null : po.id))
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      Orden de compra n.° {po.orderNumber}
                    </div>
                    {po.supplier?.name && (
                      <div className="text-xs text-muted-foreground">{po.supplier.name}</div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(po.orderDate).toLocaleDateString('es-MX', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </span>
                </label>
              ))}
              {filteredPurchaseOrders.length === 0 && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No se encontraron pedidos
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPoDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddFromPO} disabled={!selectedPoId}>
              Listo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
