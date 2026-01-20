import React from 'react'
import { Plus, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Card } from '@/components/ui/card'



export function ProductBundleEditor() {
  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Configuración del Paquete</h3>
            <p className="text-sm text-muted-foreground">Define los componentes que forman este combo.</p>
          </div>
       </div>

       <div className="grid gap-6">
          {/* Pricing Strategy */}
          <Card className="p-4 bg-muted/10 border-dashed">
            <Label className="mb-3 block">Precio del Paquete</Label>
            <RadioGroup defaultValue="fixed" className="flex flex-col space-y-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fixed" id="fixed" />
                <Label htmlFor="fixed" className="font-normal cursor-pointer">Precio fijo (ej: $199 por todo el combo)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dynamic" id="dynamic" />
                <Label htmlFor="dynamic" className="font-normal cursor-pointer">Dinámico (Suma de componentes)</Label>
              </div>
            </RadioGroup>
          </Card>

          {/* Components List */}
          <div className="space-y-4">
             <div className="flex items-center justify-between">
                <Label>Componentes</Label>
                <Button size="sm" variant="secondary">
                   <Plus className="w-4 h-4 mr-2" />
                   Añadir componente
                </Button>
             </div>
             
             {/* Example Component Row */}
             <div className="border rounded-lg p-3 flex items-center gap-3 bg-card">
                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                   <Layers className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                   <div className="font-medium text-sm">Hamburguesa Clásica</div>
                   <div className="text-xs text-muted-foreground">Variante: Regular</div>
                </div>
                <div className="w-24">
                   <Input type="number" defaultValue={1} className="h-8 text-right" />
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
                   &times;
                </Button>
             </div>
          </div>

          {/* Inventory Warning */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3 text-sm flex gap-3 text-blue-700 dark:text-blue-300">
             <Layers className="w-5 h-5 shrink-0" />
             <div>
                <span className="font-semibold block mb-1">Inventario calculado automáticamente</span>
                El stock de este paquete depende de sus componentes individuales. No puedes establecer un stock directo para el paquete.
             </div>
          </div>
       </div>
    </div>
  )
}
