import React from 'react'
import { MapPin } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface LocationInventoryToggleProps {
  locationName: string
  enabled: boolean
  onToggle: (enabled: boolean) => void
}

export function LocationInventoryToggle({ locationName, enabled, onToggle }: LocationInventoryToggleProps) {
  return (
    <div className="border rounded-md overflow-hidden">
       <div className="flex items-center justify-between p-3 bg-muted/30">
          <div className="flex items-center gap-2">
             <MapPin className="w-4 h-4 text-muted-foreground" />
             <span className="font-medium text-sm">{locationName}</span>
          </div>
          <Switch checked={enabled} onCheckedChange={onToggle} />
       </div>

       {enabled && (
           <div className="p-3 border-t bg-background grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
               <div>
                  <Label className="text-xs">Stock Inicial</Label>
                  <Input type="number" className="h-8 mt-1" placeholder="0" />
               </div>
               <div>
                  <Label className="text-xs text-amber-600">Alerta Stock Bajo</Label>
                  <Input type="number" className="h-8 mt-1 border-amber-200 focus-visible:ring-amber-500" placeholder="5" />
               </div>
               <div>
                  <Label className="text-xs">Reorder Point</Label>
                  <Input type="number" className="h-8 mt-1" placeholder="10" />
               </div>
               <div>
                  <Label className="text-xs">Proveedor</Label>
                  <Input className="h-8 mt-1" placeholder="Código o Nombre" />
               </div>
           </div>
       )}
    </div>
  )
}
