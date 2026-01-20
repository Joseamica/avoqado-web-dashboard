import React from 'react'
import { UtensilsCrossed, Package, Calendar, Ticket, Layers } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

export type ProductType = 'PHYSICAL' | 'PREPARED' | 'SERVICE' | 'EVENT' | 'BUNDLE'

interface ProductTypeSelectorProps {
  selectedType: ProductType
  onSelect: (type: ProductType) => void
}

export function ProductTypeSelector({ selectedType, onSelect }: ProductTypeSelectorProps) {
  const { t } = useTranslation()

  const types = [
    {
      id: 'PHYSICAL',
      label: 'Artículo físico',
      description: 'Productos con stock, SKU y envíos',
      icon: Package,
    },
    {
      id: 'PREPARED',
      label: 'Alimentos y bebidas',
      description: 'Menú de restaurante, modificadores, cocina',
      icon: UtensilsCrossed,
    },
    {
      id: 'SERVICE',
      label: 'Servicio',
      description: 'Citas, horas facturables, asignación de staff',
      icon: Calendar,
    },
    {
      id: 'EVENT',
      label: 'Evento',
      description: 'Entradas, ubicación, fecha y hora',
      icon: Ticket,
    },
    {
      id: 'BUNDLE',
      label: 'Paquete / Combo',
      description: 'Agrupa artículos existentes con precio especial',
      icon: Layers,
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {types.map((type) => (
        <Card
          key={type.id}
          className={cn(
            "p-4 cursor-pointer transition-all hover:border-primary/50 hover:bg-accent/50",
            selectedType === type.id ? "border-primary bg-accent ring-1 ring-primary" : "border-border"
          )}
          onClick={() => onSelect(type.id as ProductType)}
        >
          <div className="flex items-start gap-4">
            <div className={cn(
              "p-2 rounded-lg",
              selectedType === type.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              <type.icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-medium text-sm">{type.label}</h3>
              <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
