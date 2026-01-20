import React from 'react'
import { Store, Truck, Globe } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

export function ProductAvailability() {
  return (
    <div className="space-y-4">
       <h3 className="text-lg font-medium">Disponibilidad</h3>
       <p className="text-sm text-muted-foreground mb-4">Controla dónde se puede vender este artículo.</p>

       <div className="grid gap-4">
          <div className="flex items-center justify-between border p-3 rounded-lg bg-card">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-md">
                   <Store className="w-5 h-5" />
                </div>
                <div>
                   <Label className="font-medium">Punto de Venta (TPV)</Label>
                   <p className="text-xs text-muted-foreground">Disponible para venta en físico.</p>
                </div>
             </div>
             <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between border p-3 rounded-lg bg-card">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-md">
                   <Globe className="w-5 h-5" />
                </div>
                <div>
                   <Label className="font-medium">Tienda Online</Label>
                   <p className="text-xs text-muted-foreground">Visible en tu sitio de comercio electrónico.</p>
                </div>
             </div>
             <Switch />
          </div>

          <div className="flex items-center justify-between border p-3 rounded-lg bg-card">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-md">
                   <Truck className="w-5 h-5" />
                </div>
                <div>
                   <Label className="font-medium">Plataformas de Delivery</Label>
                   <p className="text-xs text-muted-foreground">UberEats, Rappi, DiDi Food.</p>
                </div>
             </div>
             <Switch />
          </div>
       </div>
    </div>
  )
}
