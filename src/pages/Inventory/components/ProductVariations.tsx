import React, { useState } from 'react'
import { Plus, Trash2, ChevronRight, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'

export interface Variation {
  id: string
  name: string
  sku: string
  price: number
  trackInventory: boolean
  stock: number
  lowStockAlert: number
}

interface ProductVariationsProps {
  variations: Variation[]
  onChange: (variations: Variation[]) => void
}

export function ProductVariations({ variations, onChange }: ProductVariationsProps) {
  const [openVariationId, setOpenVariationId] = useState<string | null>(null)

  const addVariation = () => {
    const newVariation: Variation = {
      id: crypto.randomUUID(),
      name: '',
      sku: '',
      price: 0,
      trackInventory: true,
      stock: 0,
      lowStockAlert: 5,
    }
    onChange([...variations, newVariation])
    setOpenVariationId(newVariation.id)
  }

  const updateVariation = (id: string, field: keyof Variation, value: any) => {
    onChange(variations.map(v => v.id === id ? { ...v, [field]: value } : v))
  }

  const removeVariation = (id: string) => {
    onChange(variations.filter(v => v.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Variantes</h3>
          <p className="text-sm text-muted-foreground">Gestiona tallas, colores o tipos con inventario independiente.</p>
        </div>
        <Button onClick={addVariation} variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Añadir variante
        </Button>
      </div>

      <div className="border rounded-md divide-y">
        {variations.map((variation) => (
          <Collapsible
            key={variation.id}
            open={openVariationId === variation.id}
            onOpenChange={(isOpen) => setOpenVariationId(isOpen ? variation.id : null)}
          >
            <div className="flex items-center p-3 hover:bg-muted/50">
               <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="mr-2 h-6 w-6 p-0">
                  {openVariationId === variation.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
               </CollapsibleTrigger>
               
               <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                 <div className="col-span-4">
                   <Input 
                     placeholder="Nombre (ej: Grande)" 
                     value={variation.name} 
                     onChange={(e) => updateVariation(variation.id, 'name', e.target.value)}
                     className="h-8"
                   />
                 </div>
                 <div className="col-span-3">
                    <div className="relative">
                      <span className="absolute left-2 top-1.5 text-xs text-muted-foreground">$</span>
                      <Input 
                        type="number" 
                        placeholder="0.00" 
                        value={variation.price} 
                        onChange={(e) => updateVariation(variation.id, 'price', parseFloat(e.target.value))}
                        className="h-8 pl-5"
                      />
                    </div>
                 </div>
                 <div className="col-span-3 flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Stock:</span>
                    <Badge variant={variation.stock > variation.lowStockAlert ? "outline" : "destructive"}>
                      {variation.stock}
                    </Badge>
                 </div>
                 <div className="col-span-2 flex justify-end">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => removeVariation(variation.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                 </div>
               </div>
            </div>

            <CollapsibleContent>
              <div className="p-4 bg-muted/20 border-t space-y-4">
                <div className="grid grid-cols-2 gap-4">
                   {/* Inventario Section - Independent per variation as discovered */}
                   <div className="space-y-4 p-3 bg-background rounded-md border">
                     <div className="flex items-center justify-between">
                       <h4 className="font-medium text-sm">Gestión de Inventario</h4>
                       <Switch 
                         checked={variation.trackInventory} 
                         onCheckedChange={(c) => updateVariation(variation.id, 'trackInventory', c)}
                       />
                     </div>
                     
                     {variation.trackInventory && (
                       <div className="grid grid-cols-2 gap-3">
                         <div>
                           <Label className="text-xs">SKU</Label>
                           <Input 
                             value={variation.sku} 
                             onChange={(e) => updateVariation(variation.id, 'sku', e.target.value)}
                             className="h-8 mt-1"
                           />
                         </div>
                         <div>
                           <Label className="text-xs text-amber-600">Alerta Stock Bajo</Label>
                           <Input 
                             type="number"
                             value={variation.lowStockAlert} 
                             onChange={(e) => updateVariation(variation.id, 'lowStockAlert', parseInt(e.target.value))}
                             className="h-8 mt-1 border-amber-200 focus-visible:ring-amber-500"
                           />
                         </div>
                         <div className="col-span-2">
                            <Label className="text-xs">Ubicación / Proveedor</Label>
                            <Button variant="outline" size="sm" className="w-full mt-1 h-8 justify-start text-muted-foreground font-normal">
                               <Plus className="w-3 h-3 mr-2" />
                               Asignar proveedor predeterminado
                            </Button>
                         </div>
                       </div>
                     )}
                   </div>

                   {/* Other attributes */}
                   <div className="space-y-4">
                      {/* Placeholder for GTIN, etc */}
                   </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
        {variations.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No hay variantes. Se usará la configuración predeterminada del artículo.
          </div>
        )}
      </div>
    </div>
  )
}
