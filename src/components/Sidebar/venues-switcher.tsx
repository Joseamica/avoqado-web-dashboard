import { ChevronsUpDown, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'

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
import { Avatar, AvatarFallback, AvatarImage } from '@radix-ui/react-avatar'
import { useLocation, useNavigate } from 'react-router-dom'
import { Dialog } from '../ui/dialog'
import { AddVenueDialog } from './add-venue-dialog'
import { useAuth } from '@/context/AuthContext'

export function VenuesSwitcher({ venues, defaultVenue }: { venues: Venue[]; defaultVenue: Venue }) {
  const { isMobile } = useSidebar()
  const location = useLocation()
  const navigate = useNavigate()
  const { checkVenueAccess, user } = useAuth()
  const [isDialogOpen, setDialogOpen] = useState(false)
  const [activeVenue, setActiveVenue] = useState(defaultVenue)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Function to extract venueId from the URL
  const getVenueIdFromURL = () => {
    const pathSegments = location.pathname.split('/')
    const venuesIndex = pathSegments.findIndex(segment => segment === 'venues')
    if (venuesIndex !== -1 && pathSegments.length > venuesIndex + 1) {
      return pathSegments[venuesIndex + 1]
    }
    return null
  }

  // Effect to set activeVenue based on URL
  useEffect(() => {
    const venueIdFromURL = getVenueIdFromURL()
    if (venueIdFromURL) {
      const venueFromURL = venues.find(v => v.id === venueIdFromURL)
      if (venueFromURL) {
        setActiveVenue(venueFromURL)
      } else {
        // If invalid venueId in URL, use default (authorization handled by Dashboard)
        console.warn(`Venue with ID "${venueIdFromURL}" not found. Falling back to default venue.`)
        setActiveVenue(defaultVenue)
      }
    } else {
      setActiveVenue(defaultVenue)
    }
  }, [location.pathname, venues, defaultVenue])

  const handleVenueChange = (venue: Venue) => {
    if (venue.id === activeVenue.id) return // Avoid unnecessary navigation

    // Skip access check for SUPERADMIN users
    if (user?.role !== 'SUPERADMIN') {
      // Verify access before changing (authorization redirect handled by Dashboard)
      if (!checkVenueAccess(venue.id)) {
        console.warn(`Attempted to access unauthorized venue: ${venue.id}`)
        return
      }
    }

    setActiveVenue(venue)
    const updatedPath = location.pathname.replace(/venues\/[^/]+/, `venues/${venue.id}`)
    navigate(updatedPath)
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
              >
                {/* <div className="flex items-center justify-center rounded-lg aspect-square size-8 text-sidebar-primary-foreground">
                  <img src={activeVenue?.logo} alt={`${activeVenue?.name} Logo`} className="shrink-0" />
                </div> */}
                <Avatar className="flex items-center justify-center rounded-lg aspect-square size-8">
                  <AvatarImage src={activeVenue?.logo} />
                  <AvatarFallback>{activeVenue?.name?.charAt(0).toLocaleUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-sm leading-tight text-left">
                  <span className="font-semibold truncate">{activeVenue?.name}</span>
                  <span className="text-xs truncate">{activeVenue?.plan}</span>
                </div>
                <ChevronsUpDown className="ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              align="start"
              side={isMobile ? 'bottom' : 'right'}
              sideOffset={4}
            >
              <DropdownMenuLabel className="text-xs text-zinc-500 dark:text-zinc-400">Sucursales</DropdownMenuLabel>
              {venues.map((venue, index) => (
                <DropdownMenuItem key={venue.id} onClick={() => handleVenueChange(venue)} className="gap-2 p-2">
                  <Avatar className="flex items-center justify-center rounded-lg aspect-square size-6">
                    <AvatarImage src={venue?.logo} />
                    <AvatarFallback>{venue?.name?.charAt(0).toLocaleUpperCase()}</AvatarFallback>
                  </Avatar>
                  {venue?.name}
                  <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />

              {/* Dialog Trigger for "Agregar sucursal" */}
              <DropdownMenuItem
                className="gap-2 p-2 cursor-pointer"
                onClick={() => {
                  setDialogOpen(true)
                  setDropdownOpen(false) // Close dropdown when opening dialog
                }}
              >
                {' '}
                <div className="flex items-center justify-center bg-white border rounded-md size-6 border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950">
                  <Plus className="size-4" />
                </div>
                <div className="font-medium text-zinc-500 dark:text-zinc-400">Agregar sucursal</div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      {/* Dialog Component */}
      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <AddVenueDialog onClose={() => setDialogOpen(false)} navigate={navigate} />
      </Dialog>
    </>
  )
}
