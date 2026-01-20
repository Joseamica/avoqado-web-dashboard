import React from 'react'
import { Plus, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

// Placeholder for existing sets
const MOCK_MODIFIER_SETS = [
  { id: '1', name: 'Temperatura de carne', required: true, validation: '1' },
  { id: '2', name: 'Extras Hamburguesa', required: false, validation: '0-unlimited' },
  { id: '3', name: 'Tipo de Bebida', required: true, validation: '1' },
]

export function ProductModifiers() {
  return (
    <div className="space-y-4">
       <div className="flex items-center justify-between">
         <div>
            <h3 className="text-lg font-medium">Modificadores</h3>
            <p className="text-sm text-muted-foreground">Personaliza este artículo con grupos de opciones existentes.</p>
         </div>
         <Button variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Asignar grupo
         </Button>
       </div>

       <div className="border rounded-md divide-y">
           {MOCK_MODIFIER_SETS.map(set => (
             <div key={set.id} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                   <Checkbox id={set.id} />
                   <div>
                      <Label htmlFor={set.id} className="font-medium cursor-pointer">{set.name}</Label>
                      <div className="text-xs text-muted-foreground">
                        {set.required ? 'Obligatorio' : 'Opcional'} • Selez: {set.validation}
                      </div>
                   </div>
                </div>
                <Button variant="ghost" size="sm">
                   <Settings2 className="w-4 h-4 text-muted-foreground" />
                </Button>
             </div>
           ))}
       </div>

       <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-3 text-sm text-amber-800 dark:text-amber-200">
          <p>
            <strong>Nota:</strong> Para crear nuevos grupos de modificadores, ve a la sección 
            <a href="/inventory/modifiers" className="underline ml-1 font-medium">Modificadores</a> del inventario.
            No es posible crear nuevos grupos desde aquí.
          </p>
       </div>
    </div>
  )
}
