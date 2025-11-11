import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog } from '../ui/dialog'
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
import { useAuth } from '@/context/AuthContext'
import { notifyVenueChange } from '@/services/chatService'

import { Venue, StaffRole, SessionVenue } from '@/types'
import { ChevronsUpDown, Plus } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AddVenueDialog } from './add-venue-dialog'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTranslation } from 'react-i18next'

interface VenuesSwitcherProps {
  venues: Array<Venue | SessionVenue>
  defaultVenue: Venue | SessionVenue
}

export function VenuesSwitcher({ venues, defaultVenue }: VenuesSwitcherProps) {
  const { isMobile } = useSidebar()
  const navigate = useNavigate()
  const location = useLocation()
  const { checkVenueAccess, user, switchVenue, isLoading } = useAuth()
  const { venue: activeVenue } = useCurrentVenue()
  const { t } = useTranslation()

  const [isDialogOpen, setDialogOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const canAddVenue = [StaffRole.OWNER, StaffRole.ADMIN, StaffRole.SUPERADMIN].includes(
    (user?.role as StaffRole) ?? (null as any),
  )

  // Usar el venue actual del contexto, url, o fallback al default
  const currentVenueSlug = location.pathname.split('/')[2] || '' // Obtener slug de la URL actual
  
  // Buscar el venue primero en los venues disponibles por slug, luego por activeVenue, y por último por defaultVenue
  const venueFromSlug = currentVenueSlug ? venues.find(v => v.slug === currentVenueSlug) : null
  const currentVenue = (venueFromSlug || activeVenue || defaultVenue) as Venue | SessionVenue

  const handleVenueChange = async (venue: Venue | SessionVenue) => {
    if (venue.slug === currentVenue.slug) return // Evitar cambio innecesario

    // Omitir verificación de acceso para usuarios OWNER y SUPERADMIN
    if (user?.role !== StaffRole.OWNER && user?.role !== StaffRole.SUPERADMIN) {
      // Verificar acceso antes de cambiar usando slug
      if (!checkVenueAccess(venue.slug)) {
        console.warn(`Attempted to access unauthorized venue: ${venue.slug}`)
        return
      }
    }

    try {
      // Usar la función switchVenue del contexto que maneja toda la lógica
      await switchVenue(venue.slug)
      
      // Notificar al chatService sobre el cambio de venue
      notifyVenueChange(venue.slug)
      
      setDropdownOpen(false) // Cerrar el dropdown después del cambio
    } catch (error) {
      console.error('Error switching venue:', error)
      // El error ya se muestra en el toast desde el contexto
    }
  }

  const handleAddVenueClick = () => {
    if (!canAddVenue) return
    setDialogOpen(true)
    setDropdownOpen(false) // Cerrar dropdown cuando se abre el dialog
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen} modal={false}>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
                disabled={isLoading}
              >
                <Avatar className="flex justify-center items-center rounded-lg aspect-square size-8">
                  <AvatarImage src={currentVenue?.logo} alt={`${currentVenue?.name} Logo`} />
                  <AvatarFallback>{currentVenue?.name?.charAt(0).toLocaleUpperCase() || 'V'}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-sm leading-tight text-left">
                  <span className="font-semibold truncate">{currentVenue?.name || t('venuesSwitcher.selectVenue')}</span>
                  <span className="text-xs truncate">{currentVenue?.city || ''}</span>
                </div>
                <ChevronsUpDown className="ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              align="start"
              side={isMobile ? 'bottom' : 'right'}
              sideOffset={5}
            >
              <DropdownMenuLabel className="text-xs text-muted-foreground">{t('venuesSwitcher.title')}</DropdownMenuLabel>
              {venues.map((venue, index) => {
                const isActive = venue.slug === currentVenue?.slug
                const hasAccess = user?.role === StaffRole.OWNER || user?.role === StaffRole.SUPERADMIN || checkVenueAccess(venue.slug)

                return (
                  <DropdownMenuItem
                    key={venue.id}
                    onClick={() => handleVenueChange(venue)}
                    className={`gap-2 p-2 ${isActive ? 'bg-accent' : ''} ${
                      !hasAccess ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                    disabled={!hasAccess || isLoading}
                  >
                    <Avatar className="flex justify-center items-center rounded-lg aspect-square size-6">
                      <AvatarImage src={venue?.logo} alt={`${venue?.name} Logo`} />
                      <AvatarFallback>{venue?.name?.charAt(0).toLocaleUpperCase() || 'V'}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate">
                      {venue?.name}
                      {isActive && <span className="ml-2 text-xs text-muted-foreground">{t('venuesSwitcher.current')}</span>}
                    </span>
                    <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                  </DropdownMenuItem>
                )
              })}
              <DropdownMenuSeparator />

              {/* Dialog Trigger for Add Venue (only for OWNER, ADMIN, SUPERADMIN) */}
              {canAddVenue && (
                <DropdownMenuItem className="gap-2 p-2 cursor-pointer" onClick={handleAddVenueClick} disabled={isLoading}>
                  <div className="flex justify-center items-center bg-background rounded-md border size-6 border-border">
                    <Plus className="size-4" />
                  </div>
                  <div className="font-medium text-muted-foreground">{t('venuesSwitcher.addVenue')}</div>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      {/* Dialog Component */}
      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <AddVenueDialog onClose={handleDialogClose} navigate={navigate} />
      </Dialog>
    </>
  )
}
