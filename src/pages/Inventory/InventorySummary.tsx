import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { YieldStatusHoverCard } from './components/YieldStatusHoverCard'
import { useCurrentVenue } from "@/hooks/use-current-venue"
import { getProducts } from "@/services/menu.service"
import { productInventoryApi as inventoryApi } from "@/services/inventory.service"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, ChevronDown, Download, MoreHorizontal, Plus, Search, Star, Upload } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { useToast } from "@/hooks/use-toast"

export default function InventorySummary() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // all, low_stock
  const [activeTab, setActiveTab] = useState('physical')

  // Fetch real products with inventory data
  const { data: products, isLoading } = useQuery({
    queryKey: ['products', venueId, 'inventory-summary'],
    queryFn: () => getProducts(venueId!),
    enabled: !!venueId
  })

  // Stock Adjustment Mutation
  const adjustStockMutation = useMutation({
    mutationFn: async ({
      productId,
      type,
      quantity,
      reason,
      unitCost,
      supplier
    }: {
      productId: string
      type: string
      quantity: number
      reason?: string
      unitCost?: number
      supplier?: string
    }) => {
       // Map frontend actions to backend enum types
       // Backend expects: 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'LOSS' | 'TRANSFER' | 'COUNT'
       let apiType = type;
       let finalQuantity = quantity;

       if (type === 'RECEIVE' || type === 'RETURN') {
         apiType = 'PURCHASE'; // Adds stock
         finalQuantity = Math.abs(quantity); // Ensure positive
       }

       if (type === 'DAMAGE' || type === 'THEFT') {
         apiType = 'LOSS'; // Removes stock
         finalQuantity = -Math.abs(quantity); // Ensure negative
       }

       const reasonMap: Record<string, string> = {
           'RECEIVE': 'Stock Received',
           'COUNT': 'Physical Count',
           'DAMAGE': 'Damaged Goods',
           'THEFT': 'Theft / Stolen',
           'LOSS': 'Lost Inventory',
           'RETURN': 'Customer Return'
       };

       return await inventoryApi.adjustStock(venueId!, productId, {
         type: apiType as any,
         quantity: finalQuantity,
         reason: reasonMap[reason || type] || 'Manual Adjustment',
         unitCost,
         supplier
       })
    },
    onSuccess: () => {
      toast({ title: "Stock actualizado correctamente" })
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
    },
    onError: (error) => {
      toast({ title: "Error al actualizar stock", description: "Inténtalo de nuevo", variant: "destructive" })
    }
  })

  // Filter products
  const filteredProducts = products?.filter(product => {
    // 1. Search Filter
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase()) || 
                          (product.sku?.toLowerCase().includes(search.toLowerCase()) ?? false)
    
    // 2. Status Filter
    let matchesFilter = true
    const stock = Number(product.availableQuantity || 0)
    const minStock = Number(product.inventory?.minimumStock || 0)

    if (filter === 'low_stock') {
      matchesFilter = product.trackInventory && stock <= minStock
    }

    return matchesSearch && matchesFilter
  })

  // Split into physical (countable) and recipe (calculated)
  const physicalItems = filteredProducts?.filter(p => p.inventoryMethod === 'QUANTITY' || (!p.inventoryMethod && p.trackInventory)) || []
  const recipeItems = filteredProducts?.filter(p => p.inventoryMethod === 'RECIPE') || []

  // Shared Table Render Function
  const renderTable = (items: any[], isRecipe: boolean) => (
    <div className="rounded-md">
       <Table>
         <TableHeader>
           <TableRow>
              <TableHead className="w-[300px]">Artículo</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Disponible</TableHead>
              {!isRecipe && <TableHead>Mínimo</TableHead>}
              {!isRecipe && (
                <TableHead>
                  <div className="flex items-center gap-1 cursor-help">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="border-b border-dotted border-muted-foreground/50">Confirmado</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            Stock confirmado en órdenes de compra (en tránsito, aún no recibido físicamente). Próximamente.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </TableHead>
              )}
              <TableHead>
                  {isRecipe ? (
                      <div className="flex items-center gap-1 cursor-help">
                          <TooltipProvider>
                              <Tooltip>
                                  <TooltipTrigger asChild>
                                      <span className="border-b border-dotted border-muted-foreground/50">Disponible (Teórico)</span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                      <p className="max-w-xs">
                                          Calculado automáticamente basado en el ingrediente con menor inventario disponible.
                                      </p>
                                  </TooltipContent>
                              </Tooltip>
                          </TooltipProvider>
                      </div>
                  ) : (
                      'Existencias físicas'
                  )}
              </TableHead>
              <TableHead className="text-right">Precio</TableHead>
              {!isRecipe && <TableHead className="w-[50px]"></TableHead>}
           </TableRow>
         </TableHeader>
         <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isRecipe ? 5 : 8} className="h-24 text-center">Cargando inventario...</TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                 <TableCell colSpan={isRecipe ? 5 : 8} className="h-24 text-center">No se encontraron artículos.</TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                 const stock = Number(item.availableQuantity || 0)
                 const minStock = Number(item.inventory?.minimumStock || 0)
                 const isLowStock = item.trackInventory && stock <= minStock
                 
                 return (
                   <TableRow key={item.id}>
                     <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{item.name}</span>
                          {isLowStock && (
                            <span className="text-xs text-amber-600 flex items-center font-semibold mt-1">
                              <AlertTriangle className="w-3 h-3 mr-1" /> Stock Bajo
                            </span>
                          )}
                        </div>
                     </TableCell>
                     <TableCell className="text-muted-foreground">{item.sku || '-'}</TableCell>
                     <TableCell>
                       {item.trackInventory ? (
                         <Badge variant={isLowStock ? "destructive" : "secondary"} className="min-w-[60px] justify-center">
                           {stock}
                         </Badge>
                       ) : (
                         <span className="text-muted-foreground text-sm italic">No rastreado</span>
                       )}
                     </TableCell>
                     {!isRecipe && <TableCell>{item.trackInventory ? minStock : '-'}</TableCell>}
                     {!isRecipe && (
                       <TableCell>
                         <Badge variant="secondary" className="min-w-[60px] justify-center bg-muted/50">
                           0
                         </Badge>
                       </TableCell>
                     )}
                     <TableCell>
                        {isRecipe ? (
                            <YieldStatusHoverCard productId={item.id} currentYield={stock} />
                        ) : (
                           item.trackInventory ? (
                            <StockEditPopover
                               productId={item.id}
                               currentStock={stock}
                               onSave={(type, quantity, reason, unitCost, supplier) => adjustStockMutation.mutate({ productId: item.id, type, quantity, reason, unitCost, supplier })}
                            />
                           ) : '-'
                        )}
                     </TableCell>
                     <TableCell className="text-right">${Number(item.price).toFixed(2)}</TableCell>
                     {!isRecipe && (
                         <TableCell>
                             <DropdownMenu>
                               <DropdownMenuTrigger asChild>
                                 <Button variant="ghost" className="h-8 w-8 p-0">
                                   <span className="sr-only">Abrir menú</span>
                                   <MoreHorizontal className="h-4 w-4" />
                                 </Button>
                               </DropdownMenuTrigger>
                               <DropdownMenuContent align="end">
                                 <DropdownMenuItem disabled>
                                   <Star className="mr-2 h-4 w-4 text-blue-500" />
                                   <div className="flex flex-col">
                                     <span>Crear orden de compra</span>
                                     <span className="text-xs text-muted-foreground">(Próximamente)</span>
                                   </div>
                                 </DropdownMenuItem>
                                 <DropdownMenuItem disabled>
                                   <div className="flex flex-col">
                                     <span>Editar aviso de existencias bajas</span>
                                     <span className="text-xs text-muted-foreground">(Próximamente)</span>
                                   </div>
                                 </DropdownMenuItem>
                               </DropdownMenuContent>
                             </DropdownMenu>
                         </TableCell>
                     )}
                   </TableRow>
                 )
              })
            )}
         </TableBody>
       </Table>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Resumen de Existencias</h1>
          <p className="text-muted-foreground">Gestiona el inventario de tus artículos en tiempo real.</p>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm">
             <Upload className="mr-2 h-4 w-4" /> Importar
           </Button>
           <Button variant="outline" size="sm">
             <Download className="mr-2 h-4 w-4" /> Exportar
           </Button>
           <Button size="sm" onClick={() => navigate('create')}>
             <Plus className="mr-2 h-4 w-4" /> Crear Artículo
           </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
           <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
              <TabsList className="inline-flex h-10 items-center justify-start rounded-full bg-muted/60 px-1 py-1 text-muted-foreground border border-border w-full sm:w-auto">
                <TabsTrigger 
                    value="physical"
                    className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
                >
                    <span>Artículos Contables</span>
                    <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs text-foreground bg-foreground/10 group-hover:bg-foreground/20 group-data-[state=active]:bg-background/20 group-data-[state=active]:text-background">
                        {physicalItems.length}
                    </span>
                </TabsTrigger>
                <TabsTrigger 
                    value="recipes"
                    className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
                >
                    <span>Basados en Receta</span>
                    <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs text-foreground bg-foreground/10 group-hover:bg-foreground/20 group-data-[state=active]:bg-background/20 group-data-[state=active]:text-background">
                        {recipeItems.length}
                    </span>
                </TabsTrigger>
              </TabsList>

              {/* Shared Filters placed outside content to affect both, or inside if we want separate contexts. 
                  Placement below tabs is cleaner. */}
               <div className="flex flex-col sm:flex-row gap-4 my-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Buscar por nombre o SKU..." 
                      className="pl-8"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filtrar por stock" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los artículos</SelectItem>
                      <SelectItem value="low_stock">⚠️ Stock Bajo</SelectItem>
                    </SelectContent>
                  </Select>
               </div>

               <TabsContent value="physical" className="mt-0">
                  {renderTable(physicalItems, false)}
               </TabsContent>
               <TabsContent value="recipes" className="mt-0">
                   <div className="mb-4 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50">
                       ℹ️ Estos artículos no tienen stock directo. Su disponibilidad se calcula automáticamente según los ingredientes de su receta.
                   </div>
                  {renderTable(recipeItems, true)}
               </TabsContent>
           </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

function StockEditPopover({ productId, currentStock, onSave }: { productId: string, currentStock: number, onSave: (type: any, qty: number, reason?: string, unitCost?: number, supplier?: string) => void }) {
    const [open, setOpen] = useState(false)
    const [action, setAction] = useState<'RECEIVE' | 'COUNT' | 'LOSS' | 'DAMAGE' | 'THEFT' | 'RETURN'>('RECEIVE')
    const [amount, setAmount] = useState<string>('')
    const [unitCost, setUnitCost] = useState('')
    const [supplier, setSupplier] = useState('')
    
    // Calculate new total for preview
    const numAmount = parseFloat(amount) || 0
    let newTotal = currentStock
    
    // Add logic
    if (['RECEIVE', 'RETURN'].includes(action)) {
        newTotal += numAmount
    }
    // Subtract logic
    if (['LOSS', 'DAMAGE', 'THEFT'].includes(action)) {
        newTotal -= numAmount
    }
    // Set logic
    if (action === 'COUNT') {
        newTotal = numAmount
    }

    const handleSave = () => {
        const qty = parseFloat(amount)
        if (isNaN(qty)) return

        const parsedUnitCost = unitCost ? parseFloat(unitCost) : undefined
        const trimmedSupplier = supplier.trim() || undefined

        onSave(action, qty, action, parsedUnitCost, trimmedSupplier)
        setOpen(false)
        setAmount('')
        setUnitCost('')
        setSupplier('')
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-20 justify-between">
                    {currentStock}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Acción de existencias</Label>
                        <Select value={action} onValueChange={(v: any) => setAction(v)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="RECEIVE">Existencias recibidas</SelectItem>
                                <SelectItem value="COUNT">Recuento de inventario</SelectItem>
                                <SelectItem value="DAMAGE">Daño</SelectItem>
                                <SelectItem value="THEFT">Robo</SelectItem>
                                <SelectItem value="LOSS">Pérdida</SelectItem>
                                <SelectItem value="RETURN">Devolución de existencias</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Existencias disponibles</span>
                        <span className="font-medium">{currentStock}</span>
                    </div>

                    <div className="space-y-2">
                        <Label>
                            {['RECEIVE', 'RETURN'].includes(action) ? 'Cantidad a sumar' : 
                             ['LOSS', 'DAMAGE', 'THEFT'].includes(action) ? 'Cantidad a restar' : 
                             'Nuevo total'}
                        </Label>
                        <Input 
                            type="number" 
                            className="text-right" 
                            value={amount} 
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0"
                        />
                    </div>

                    <div className="flex justify-between text-sm pt-2 border-t">
                        <span className="font-medium">Nuevo total</span>
                        <span className="font-bold">{newTotal}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                                Coste unitario <Star className="h-3 w-3 text-blue-500 fill-blue-500" />
                            </Label>
                            <Input placeholder="0,00 US$" value={unitCost} onChange={e => setUnitCost(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                                Proveedor <Star className="h-3 w-3 text-blue-500 fill-blue-500" />
                            </Label>
                            <Input placeholder="Proveedor" value={supplier} onChange={e => setSupplier(e.target.value)} />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
                        <Button size="sm" onClick={handleSave}>Guardar</Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
