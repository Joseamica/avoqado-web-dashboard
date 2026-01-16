/**
 * ManagerSelector - Dropdown selector for managers with profile preview
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { User, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Manager {
  id: string
  name: string
  region: string
  status: 'active' | 'inactive'
}

interface ManagerSelectorProps {
  managers: Manager[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  className?: string
}

export const ManagerSelector: React.FC<ManagerSelectorProps> = ({
  managers,
  selectedId,
  onSelect,
  className,
}) => {
  const { t } = useTranslation(['playtelecom', 'common'])

  return (
    <Select
      value={selectedId || 'all'}
      onValueChange={(value) => onSelect(value === 'all' ? null : value)}
    >
      <SelectTrigger className={cn('w-[280px]', className)}>
        <SelectValue placeholder={t('playtelecom:managers.selectManager', { defaultValue: 'Seleccionar gerente...' })} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <span className="text-muted-foreground">
              {t('playtelecom:managers.viewAll', { defaultValue: 'Todos los gerentes' })}
            </span>
          </div>
        </SelectItem>
        {managers.map(manager => (
          <SelectItem key={manager.id} value={manager.id}>
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-primary" />
                </div>
                {manager.status === 'active' && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 border border-background" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{manager.name}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-2.5 h-2.5" />
                  {manager.region}
                </span>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default ManagerSelector
