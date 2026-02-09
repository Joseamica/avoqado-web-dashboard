import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Building2, ArrowRight, Settings, LogOut, Zap } from 'lucide-react'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command'
import { useAuth } from '@/context/AuthContext'
import { getSuperadminV2Navigation } from '../constants/navigation'

interface SuperadminV2CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SuperadminV2CommandPalette: React.FC<SuperadminV2CommandPaletteProps> = ({
  open,
  onOpenChange,
}) => {
  const navigate = useNavigate()
  const { t: tSidebar } = useTranslation('sidebar')
  const { allVenues, logout } = useAuth()

  const sections = useMemo(
    () => getSuperadminV2Navigation(tSidebar),
    [tSidebar],
  )

  const allNavItems = useMemo(
    () => sections.flatMap(s => s.items),
    [sections],
  )

  // Limit venues shown in palette
  const displayVenues = useMemo(
    () => (allVenues ?? []).slice(0, 50),
    [allVenues],
  )

  const handleSelect = (path: string) => {
    onOpenChange(false)
    navigate(path)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar páginas, venues, acciones..." />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>

        {/* Navigation pages */}
        <CommandGroup heading="Navegación">
          {allNavItems.map(item => (
            <CommandItem
              key={item.href}
              value={[item.name, ...item.keywords].join(' ')}
              onSelect={() => handleSelect(item.href)}
            >
              <item.icon className="mr-2 h-4 w-4 shrink-0" />
              <span>{item.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Venues */}
        {displayVenues.length > 0 && (
          <CommandGroup heading="Venues">
            {displayVenues.map(venue => (
              <CommandItem
                key={venue.id}
                value={`${venue.name} ${venue.slug}`}
                // eslint-disable-next-line local/no-hardcoded-venue-paths -- Superadmin context: navigating to venue from global scope
                onSelect={() => handleSelect(`/venues/${venue.slug}/home`)}
              >
                <Building2 className="mr-2 h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{venue.name}</span>
                <ArrowRight className="ml-2 h-3 w-3 text-muted-foreground" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* Quick actions */}
        <CommandGroup heading="Acciones rápidas">
          <CommandItem
            value="ir al superadmin v1 legacy"
            onSelect={() => handleSelect('/superadmin')}
          >
            <Zap className="mr-2 h-4 w-4 shrink-0" />
            <span>Ir a Superadmin V1</span>
          </CommandItem>
          <CommandItem
            value="configuracion settings ajustes"
            onSelect={() => handleSelect('/superadmin-v2/settings')}
          >
            <Settings className="mr-2 h-4 w-4 shrink-0" />
            <span>Configuración</span>
          </CommandItem>
          <CommandItem
            value="cerrar sesion logout salir"
            onSelect={() => {
              onOpenChange(false)
              logout()
            }}
          >
            <LogOut className="mr-2 h-4 w-4 shrink-0" />
            <span>Cerrar sesión</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

export default SuperadminV2CommandPalette
