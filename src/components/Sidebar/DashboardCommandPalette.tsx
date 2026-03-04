import React from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
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
import type { NavItem } from '@/components/Sidebar/nav-main'

interface DashboardCommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  navItems: NavItem[]
  hiddenSidebarItems?: string[]
  isSuperadmin?: boolean
}

const DashboardCommandPalette: React.FC<DashboardCommandPaletteProps> = ({
  open,
  onOpenChange,
  navItems,
  hiddenSidebarItems = [],
  isSuperadmin = false,
}) => {
  const navigate = useNavigate()
  const { logout } = useAuth()

  const handleSelect = (url: string) => {
    onOpenChange(false)
    navigate(url)
  }

  // Filter out hidden items (non-superadmin) and locked items
  const visibleItems = navItems.filter(item => {
    if (item.locked) return false
    if (!isSuperadmin && hiddenSidebarItems.includes(item.url)) return false
    return true
  })

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} contentClassName="max-w-2xl">
      <CommandInput placeholder="Buscar páginas, secciones..." />
      <CommandList className="max-h-[min(60vh,500px)]">
        <CommandEmpty>Sin resultados.</CommandEmpty>

        <CommandGroup heading="Navegación">
          {visibleItems.map(item => {
            const Icon = item.icon
            const hasSubItems = item.items && item.items.length > 0

            // Filter sub-items: remove hidden (non-SA) and comingSoon
            const visibleSubItems = hasSubItems
              ? item.items!.filter(sub => {
                  if (sub.comingSoon) return false
                  if (!isSuperadmin && hiddenSidebarItems.includes(sub.url)) return false
                  return true
                })
              : []

            // For items with sub-items, render each sub-item individually
            if (visibleSubItems.length > 0) {
              return (
                <React.Fragment key={item.url}>
                  {visibleSubItems.map(sub => (
                    <CommandItem key={sub.url} value={`${item.title} ${sub.title}`} onSelect={() => handleSelect(sub.url)}>
                      {Icon && <Icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />}
                      <span className="text-muted-foreground">{item.title}</span>
                      <span className="mx-1 text-muted-foreground/50">/</span>
                      <span>{sub.title}</span>
                    </CommandItem>
                  ))}
                </React.Fragment>
              )
            }

            // Items without sub-items (direct links)
            // Skip anchor-only URLs like #sales, #customers
            if (item.url.startsWith('#')) return null

            return (
              <CommandItem key={item.url} value={item.title} onSelect={() => handleSelect(item.url)}>
                {Icon && <Icon className="mr-2 h-4 w-4 shrink-0" />}
                <span>{item.title}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Acciones rápidas">
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

export default DashboardCommandPalette
