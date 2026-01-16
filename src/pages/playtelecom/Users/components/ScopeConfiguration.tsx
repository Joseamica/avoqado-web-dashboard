/**
 * ScopeConfiguration - Zone and store multi-select for user access scope
 * Also known as "Alcance Operativo" in the mockups
 */

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MapPin,
  Store,
  Globe,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Zone {
  id: string
  name: string
}

export interface StoreOption {
  id: string
  name: string
  zoneId: string
  address?: string
}

interface ScopeConfigurationProps {
  zones: Zone[]
  stores: StoreOption[]
  selectedZone: string | null
  selectedStores: string[]
  onZoneChange: (zoneId: string | null) => void
  onStoresChange: (storeIds: string[]) => void
  disabled?: boolean
  className?: string
}

export const ScopeConfiguration: React.FC<ScopeConfigurationProps> = ({
  zones,
  stores,
  selectedZone,
  selectedStores,
  onZoneChange,
  onStoresChange,
  disabled = false,
  className,
}) => {
  const { t } = useTranslation(['playtelecom', 'common'])

  // Filter stores by selected zone
  const filteredStores = useMemo(() => {
    if (!selectedZone || selectedZone === 'all') {
      return stores
    }
    return stores.filter(s => s.zoneId === selectedZone)
  }, [stores, selectedZone])

  // Check if all filtered stores are selected
  const allSelected = useMemo(() => {
    return filteredStores.length > 0 && filteredStores.every(s => selectedStores.includes(s.id))
  }, [filteredStores, selectedStores])

  // Handle select all toggle
  const handleSelectAll = () => {
    if (allSelected) {
      // Deselect all filtered stores
      onStoresChange(selectedStores.filter(id => !filteredStores.some(s => s.id === id)))
    } else {
      // Select all filtered stores
      const newSelection = [...new Set([...selectedStores, ...filteredStores.map(s => s.id)])]
      onStoresChange(newSelection)
    }
  }

  // Handle individual store toggle
  const handleStoreToggle = (storeId: string) => {
    if (selectedStores.includes(storeId)) {
      onStoresChange(selectedStores.filter(id => id !== storeId))
    } else {
      onStoresChange([...selectedStores, storeId])
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-muted-foreground" />
        <h4 className="text-sm font-medium">
          {t('playtelecom:users.operationalScope', { defaultValue: 'Alcance Operativo' })}
        </h4>
        <Badge variant="secondary" className="ml-auto">
          {selectedStores.length} {selectedStores.length === 1 ? 'tienda' : 'tiendas'}
        </Badge>
      </div>

      <GlassCard className="p-4 space-y-4">
        {/* Zone Selector */}
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {t('playtelecom:users.zone', { defaultValue: 'Zona' })}
          </label>
          <Select
            value={selectedZone || 'all'}
            onValueChange={value => onZoneChange(value === 'all' ? null : value)}
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('playtelecom:users.selectZone', { defaultValue: 'Seleccionar zona...' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <span>{t('playtelecom:users.allZones', { defaultValue: 'Todas las zonas' })}</span>
                </div>
              </SelectItem>
              {zones.map(zone => (
                <SelectItem key={zone.id} value={zone.id}>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span>{zone.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-2">
          <div className="h-px bg-border flex-1" />
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <div className="h-px bg-border flex-1" />
        </div>

        {/* Store Multi-Select */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5" />
              {t('playtelecom:users.stores', { defaultValue: 'Tiendas' })}
            </label>
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={disabled}
              className={cn(
                'text-xs text-primary hover:underline',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {allSelected
                ? t('playtelecom:users.deselectAll', { defaultValue: 'Deseleccionar todas' })
                : t('playtelecom:users.selectAll', { defaultValue: 'Seleccionar todas' })}
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1 border border-border/50 rounded-lg p-2">
            {filteredStores.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <Store className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {t('playtelecom:users.noStoresInZone', { defaultValue: 'No hay tiendas en esta zona' })}
                </p>
              </div>
            ) : (
              filteredStores.map(store => {
                const isSelected = selectedStores.includes(store.id)
                return (
                  <div
                    key={store.id}
                    onClick={() => !disabled && handleStoreToggle(store.id)}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-md transition-colors cursor-pointer',
                      isSelected ? 'bg-primary/10' : 'hover:bg-muted/50',
                      disabled && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onClick={e => e.stopPropagation()}
                      disabled={disabled}
                      className="cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{store.name}</p>
                      {store.address && (
                        <p className="text-xs text-muted-foreground truncate">{store.address}</p>
                      )}
                    </div>
                    {isSelected && (
                      <Badge variant="outline" className="bg-primary/10 text-primary text-xs">
                        {t('common:selected', { defaultValue: 'Asignada' })}
                      </Badge>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Summary */}
        {selectedStores.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/50">
            {selectedStores.slice(0, 5).map(storeId => {
              const store = stores.find(s => s.id === storeId)
              if (!store) return null
              return (
                <Badge key={storeId} variant="secondary" className="text-xs">
                  {store.name}
                </Badge>
              )
            })}
            {selectedStores.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{selectedStores.length - 5} {t('common:more', { defaultValue: 'mas' })}
              </Badge>
            )}
          </div>
        )}
      </GlassCard>
    </div>
  )
}

export default ScopeConfiguration
