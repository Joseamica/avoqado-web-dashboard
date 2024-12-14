import { ChevronsUpDown, Plus } from 'lucide-react'
import { useState } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import { Venue } from '@/types'
import { useLocation, useNavigate } from 'react-router-dom'

export function VenuesSwitcher({ venues, defaultVenue }: { venues: Venue[]; defaultVenue: Venue }) {
  const location = useLocation()
  const navigate = useNavigate()
  console.log(location)
  const { isMobile } = useSidebar()
  const [activeVenue, setActiveVenue] = useState(defaultVenue)

  const handleVenueChange = (venue: Venue) => {
    setActiveVenue(venue)
    const updatedPath = location.pathname.replace(/venues\/[^/]+/, `venues/${venue.id}`)
    navigate(updatedPath)
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              <div className="flex items-center justify-center rounded-lg aspect-square size-8 text-sidebar-primary-foreground">
                <img src={activeVenue?.logo} alt={`${activeVenue?.name} Logo`} className="rounded-full" />{' '}
              </div>
              <div className="grid flex-1 text-sm leading-tight text-left">
                <span className="font-semibold truncate">{activeVenue.name}</span>
                <span className="text-xs truncate">{activeVenue.plan}</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-zinc-500 dark:text-zinc-400">Sucursales</DropdownMenuLabel>
            {venues.map((venue, index) => (
              <DropdownMenuItem key={venue.name} onClick={() => handleVenueChange(venue)} className="gap-2 p-2">
                <div className="flex items-center justify-center rounded-sm size-6">
                  <img src={venue.logo} alt={`${venue.name} Logo`} className="size-4 shrink-0" />
                </div>
                {venue.name}
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2">
              <div className="flex items-center justify-center bg-white border rounded-md size-6 border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950">
                <Plus className="size-4" />
              </div>
              <div className="font-medium text-zinc-500 dark:text-zinc-400">Agregar sucursal</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
