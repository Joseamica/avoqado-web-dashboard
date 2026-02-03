import React from 'react'
import { cn } from '@/lib/utils'
import {
  UtensilsCrossed,
  Wine,
  Coffee,
  Croissant,
  Truck,
  Zap,
  ChefHat,
  Cloud,
  Store,
  Gem,
  Shirt,
  Smartphone,
  Pill,
  ShoppingCart,
  ShoppingBasket,
  GlassWater,
  Sofa,
  Wrench,
  BookOpen,
  Dog,
  Scissors,
  Sparkles,
  Dumbbell,
  Stethoscope,
  Heart,
  Car,
  WashingMachine,
  Hotel,
  Home,
  Palmtree,
  Film,
  Gamepad2,
  PartyPopper,
  Music,
  CircleDot,
  MoreHorizontal,
} from 'lucide-react'

const VENUE_TYPE_OPTIONS: Array<{
  value: string
  label: string
  icon: React.ElementType
  category: string
}> = [
  // Food Service
  { value: 'RESTAURANT', label: 'Restaurante', icon: UtensilsCrossed, category: 'Alimentos' },
  { value: 'BAR', label: 'Bar', icon: Wine, category: 'Alimentos' },
  { value: 'CAFE', label: 'Cafe', icon: Coffee, category: 'Alimentos' },
  { value: 'BAKERY', label: 'Panaderia', icon: Croissant, category: 'Alimentos' },
  { value: 'FOOD_TRUCK', label: 'Food Truck', icon: Truck, category: 'Alimentos' },
  { value: 'FAST_FOOD', label: 'Comida Rapida', icon: Zap, category: 'Alimentos' },
  { value: 'CATERING', label: 'Catering', icon: ChefHat, category: 'Alimentos' },
  { value: 'CLOUD_KITCHEN', label: 'Cocina Virtual', icon: Cloud, category: 'Alimentos' },
  // Retail
  { value: 'RETAIL_STORE', label: 'Tienda', icon: Store, category: 'Retail' },
  { value: 'JEWELRY', label: 'Joyeria', icon: Gem, category: 'Retail' },
  { value: 'CLOTHING', label: 'Ropa', icon: Shirt, category: 'Retail' },
  { value: 'ELECTRONICS', label: 'Electronica', icon: Smartphone, category: 'Retail' },
  { value: 'PHARMACY', label: 'Farmacia', icon: Pill, category: 'Retail' },
  { value: 'CONVENIENCE_STORE', label: 'Conveniencia', icon: ShoppingCart, category: 'Retail' },
  { value: 'SUPERMARKET', label: 'Supermercado', icon: ShoppingBasket, category: 'Retail' },
  { value: 'LIQUOR_STORE', label: 'Licoreria', icon: GlassWater, category: 'Retail' },
  { value: 'FURNITURE', label: 'Muebles', icon: Sofa, category: 'Retail' },
  { value: 'HARDWARE', label: 'Ferreteria', icon: Wrench, category: 'Retail' },
  { value: 'BOOKSTORE', label: 'Libreria', icon: BookOpen, category: 'Retail' },
  { value: 'PET_STORE', label: 'Mascotas', icon: Dog, category: 'Retail' },
  // Services
  { value: 'SALON', label: 'Salon', icon: Scissors, category: 'Servicios' },
  { value: 'SPA', label: 'Spa', icon: Sparkles, category: 'Servicios' },
  { value: 'FITNESS', label: 'Gimnasio', icon: Dumbbell, category: 'Servicios' },
  { value: 'CLINIC', label: 'Clinica', icon: Stethoscope, category: 'Servicios' },
  { value: 'VETERINARY', label: 'Veterinaria', icon: Heart, category: 'Servicios' },
  { value: 'AUTO_SERVICE', label: 'Automotriz', icon: Car, category: 'Servicios' },
  { value: 'LAUNDRY', label: 'Lavanderia', icon: WashingMachine, category: 'Servicios' },
  { value: 'REPAIR_SHOP', label: 'Reparaciones', icon: Wrench, category: 'Servicios' },
  // Hospitality
  { value: 'HOTEL', label: 'Hotel', icon: Hotel, category: 'Hospitalidad' },
  { value: 'HOSTEL', label: 'Hostal', icon: Home, category: 'Hospitalidad' },
  { value: 'RESORT', label: 'Resort', icon: Palmtree, category: 'Hospitalidad' },
  // Entertainment
  { value: 'CINEMA', label: 'Cine', icon: Film, category: 'Entretenimiento' },
  { value: 'ARCADE', label: 'Arcade', icon: Gamepad2, category: 'Entretenimiento' },
  { value: 'EVENT_VENUE', label: 'Eventos', icon: PartyPopper, category: 'Entretenimiento' },
  { value: 'NIGHTCLUB', label: 'Antro', icon: Music, category: 'Entretenimiento' },
  { value: 'BOWLING', label: 'Boliche', icon: CircleDot, category: 'Entretenimiento' },
  // Other
  { value: 'OTHER', label: 'Otro', icon: MoreHorizontal, category: 'Otro' },
]

interface Props {
  value: string
  onChange: (value: string) => void
}

export const VenueTypeSelector: React.FC<Props> = ({ value, onChange }) => {
  const categories = [...new Set(VENUE_TYPE_OPTIONS.map((o) => o.category))]

  return (
    <div className="space-y-4">
      {categories.map((category) => (
        <div key={category}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{category}</p>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {VENUE_TYPE_OPTIONS.filter((o) => o.category === category).map((option) => {
              const Icon = option.icon
              const selected = value === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange(option.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all',
                    selected
                      ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                      : 'border-border hover:border-primary/40 hover:bg-accent text-muted-foreground',
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="truncate w-full text-center">{option.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
