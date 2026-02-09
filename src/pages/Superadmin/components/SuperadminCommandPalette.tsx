import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, ArrowRight, Settings, LogOut, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { VisuallyHidden } from '@/components/ui/visually-hidden'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command'
import { useAuth } from '@/context/AuthContext'
import type { SuperadminNavSection } from '../constants/navigation'

interface SuperadminCommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  navigationItems: SuperadminNavSection[]
}

const SuperadminCommandPalette: React.FC<SuperadminCommandPaletteProps> = ({
  open,
  onOpenChange,
  navigationItems,
}) => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { allVenues, logout } = useAuth()

  const allNavItems = useMemo(
    () => navigationItems.flatMap(s => s.items),
    [navigationItems],
  )

  const displayVenues = useMemo(
    () => (allVenues ?? []).slice(0, 50),
    [allVenues],
  )

  const handleSelect = (path: string) => {
    onOpenChange(false)
    navigate(path)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 max-w-2xl top-[20%] translate-y-0">
        <VisuallyHidden>
          <DialogTitle>{t('common:command_menu')}</DialogTitle>
        </VisuallyHidden>
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          <CommandInput placeholder="Buscar páginas, venues, acciones..." />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>Sin resultados.</CommandEmpty>

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

            {displayVenues.length > 0 && (
              <CommandGroup heading="Venues">
                {displayVenues.map(venue => (
                  <CommandItem
                    key={venue.id}
                    value={`${venue.name} ${venue.slug}`}
                     
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

            <CommandGroup heading="Acciones rápidas">
              <CommandItem
                value="configuracion settings ajustes"
                onSelect={() => handleSelect('/superadmin/settings')}
              >
                <Settings className="mr-2 h-4 w-4 shrink-0" />
                <span>Configuración</span>
              </CommandItem>
              <CommandItem
                value="superadmin v2 nuevo experimental"
                onSelect={() => handleSelect('/superadmin-v2')}
              >
                <Zap className="mr-2 h-4 w-4 shrink-0" />
                <span>Superadmin V2 (experimental)</span>
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
        </Command>
      </DialogContent>
    </Dialog>
  )
}

export default SuperadminCommandPalette
