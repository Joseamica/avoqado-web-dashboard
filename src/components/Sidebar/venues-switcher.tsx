import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog } from '../ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import { useAuth } from '@/context/AuthContext'
import { notifyVenueChange } from '@/services/chatService'

import { Venue, StaffRole, SessionVenue } from '@/types'
import { VenueStatus } from '@/types/superadmin'
import { Building2, ChevronsUpDown, Plus, AlertTriangle, Ban, XCircle } from 'lucide-react'
import { useState, useMemo, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AddVenueDialog } from './add-venue-dialog'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import { useTranslation } from 'react-i18next'

// Type for grouped venues by organization
interface VenueGroup {
  orgId: string
  orgName: string
  venues: Array<Venue | SessionVenue>
}

interface VenuesSwitcherProps {
  venues: Array<Venue | SessionVenue>
  defaultVenue: Venue | SessionVenue
}

export function VenuesSwitcher({ venues, defaultVenue }: VenuesSwitcherProps) {
  const { isMobile, state: sidebarState } = useSidebar()
  const isCollapsed = sidebarState === 'collapsed' && !isMobile
  const navigate = useNavigate()
  const location = useLocation()
  const { checkVenueAccess, user, switchVenue, isLoading } = useAuth()
  const { venue: activeVenue } = useCurrentVenue()
  const { organization, orgId, isOwner } = useCurrentOrganization()
  const { t } = useTranslation()

  const [isDialogOpen, setDialogOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const canAddVenue = [StaffRole.OWNER, StaffRole.ADMIN, StaffRole.SUPERADMIN].includes(
    (user?.role as StaffRole) ?? (null as any),
  )

  // Check if user can see organization link (OWNER or SUPERADMIN)
  const canViewOrganization = isOwner && !!orgId
  const isSuperadmin = user?.role === StaffRole.SUPERADMIN

  // Helper to get suspension status info for a venue
  const getSuspensionInfo = (venue: Venue | SessionVenue) => {
    const status = (venue as Venue).status as VenueStatus
    switch (status) {
      case VenueStatus.SUSPENDED:
        return { isSuspended: true, label: t('venuesSwitcher.suspended'), icon: AlertTriangle, textColor: 'text-amber-600' }
      case VenueStatus.ADMIN_SUSPENDED:
        return { isSuspended: true, label: t('venuesSwitcher.adminSuspended'), icon: Ban, textColor: 'text-red-600' }
      case VenueStatus.CLOSED:
        return { isSuspended: true, label: t('venuesSwitcher.closed'), icon: XCircle, textColor: 'text-slate-500' }
      default:
        return { isSuspended: false, label: '', icon: null, textColor: '' }
    }
  }

  // Group venues by organization for SUPERADMIN/OWNER users
  const venueGroups = useMemo((): VenueGroup[] => {
    // Only group if user is SUPERADMIN (sees multiple orgs) or OWNER
    if (!isSuperadmin && !isOwner) {
      // For regular users, return a single group with current org
      return [{
        orgId: orgId || 'default',
        orgName: organization?.name || '',
        venues: venues,
      }]
    }

    // Group venues by organizationId
    const groups = new Map<string, VenueGroup>()

    venues.forEach(venue => {
      // Get organizationId from venue - check both Venue and SessionVenue
      const venueOrgId = venue.organizationId || 'unknown'
      const venueOrgName = venue.organization?.name || 'Unknown Organization'

      if (!groups.has(venueOrgId)) {
        groups.set(venueOrgId, {
          orgId: venueOrgId,
          orgName: venueOrgName,
          venues: [],
        })
      }
      groups.get(venueOrgId)!.venues.push(venue)
    })

    // Sort groups by organization name, then sort venues within each group
    const sortedGroups = Array.from(groups.values())
      .sort((a, b) => a.orgName.localeCompare(b.orgName))
      .map(group => ({
        ...group,
        venues: group.venues.sort((a, b) => a.name.localeCompare(b.name)),
      }))

    return sortedGroups
  }, [venues, isSuperadmin, isOwner, orgId, organization?.name])

  // Check if we have multiple organizations (for UI decisions)
  const hasMultipleOrgs = venueGroups.length > 1

  // Usar el venue actual del contexto, url, localStorage, o fallback al default
  const currentVenueSlug = location.pathname.split('/')[2] || '' // Obtener slug de la URL actual

  // Buscar el venue en este orden de prioridad:
  // 1. Desde la URL actual (si estamos en /venues/[slug]/...)
  // 2. Desde el contexto activeVenue
  // 3. Desde localStorage (persistido del último venue usado)
  // 4. Fallback al defaultVenue (primer venue de la lista)
  const venueFromSlug = currentVenueSlug ? venues.find(v => v.slug === currentVenueSlug) : null

  // Intentar recuperar el último venue usado de localStorage
  const savedVenueSlug = typeof window !== 'undefined' ? localStorage.getItem('avoqado_current_venue_slug') : null
  const venueFromStorage = savedVenueSlug ? venues.find(v => v.slug === savedVenueSlug) : null

  const currentVenue = (venueFromSlug || activeVenue || venueFromStorage || defaultVenue) as Venue | SessionVenue

  // Persistir el venue actual en localStorage cuando cambie (para recuperarlo después de login/logout/refresh)
  useEffect(() => {
    if (currentVenue?.slug) {
      localStorage.setItem('avoqado_current_venue_slug', currentVenue.slug)
    }
  }, [currentVenue?.slug])

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
                <Avatar className={`flex justify-center items-center rounded-lg aspect-square ${isCollapsed ? 'size-7' : 'size-8'}`}>
                  <AvatarImage src={currentVenue?.logo} alt={`${currentVenue?.name} Logo`} />
                  <AvatarFallback className="text-xs">{currentVenue?.name?.charAt(0).toLocaleUpperCase() || 'V'}</AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <>
                    <div className="grid flex-1 text-sm leading-tight text-left">
                      <span className="font-semibold truncate">{currentVenue?.name || t('venuesSwitcher.selectVenue')}</span>
                      <span className="text-xs truncate">{currentVenue?.city || ''}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto" />
                  </>
                )}
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg max-h-[70vh] overflow-y-auto"
              align="start"
              side={isMobile ? 'bottom' : 'right'}
              sideOffset={5}
            >
              {/* Render venues grouped by organization */}
              {venueGroups.map((group, groupIndex) => {
                // Handler for clicking organization header
                const handleOrgHeaderClick = () => {
                  if (group.orgId !== 'unknown' && group.orgId !== 'default') {
                    setDropdownOpen(false)
                    navigate(`/organizations/${group.orgId}`)
                  }
                }

                return (
                  <div key={group.orgId}>
                    {/* Organization Header - Clickable for OWNER/SUPERADMIN */}
                    {(hasMultipleOrgs || canViewOrganization) && (
                      <>
                        {groupIndex > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuItem
                          onClick={handleOrgHeaderClick}
                          className="gap-2 p-2 cursor-pointer"
                          disabled={isLoading || group.orgId === 'unknown'}
                        >
                          <div className="flex justify-center items-center bg-muted rounded-lg size-6">
                            <Building2 className="size-4 text-muted-foreground" />
                          </div>
                          <span className="font-medium truncate">
                            {group.orgName || t('organization:myOrganization')}
                          </span>
                        </DropdownMenuItem>
                      </>
                    )}

                    {/* Venues Label */}
                    {!hasMultipleOrgs && !canViewOrganization && (
                      <DropdownMenuLabel className="text-xs text-muted-foreground">{t('venuesSwitcher.title')}</DropdownMenuLabel>
                    )}

                    {/* Venues in this organization */}
                    {group.venues.map((venue) => {
                      const isActive = venue.slug === currentVenue?.slug
                      const hasAccess = user?.role === StaffRole.OWNER || user?.role === StaffRole.SUPERADMIN || checkVenueAccess(venue.slug)
                      const suspensionInfo = getSuspensionInfo(venue)
                      const SuspensionIcon = suspensionInfo.icon

                      return (
                        <DropdownMenuItem
                          key={venue.id}
                          onClick={() => handleVenueChange(venue)}
                          className={`gap-2 p-2 ${(hasMultipleOrgs || canViewOrganization) ? 'pl-4' : ''} ${isActive ? 'bg-accent' : ''} ${
                            !hasAccess ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                          disabled={!hasAccess || isLoading}
                        >
                          <Avatar className="flex justify-center items-center rounded-lg aspect-square size-6">
                            <AvatarImage src={venue?.logo} alt={`${venue?.name} Logo`} />
                            <AvatarFallback>{venue?.name?.charAt(0).toLocaleUpperCase() || 'V'}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate">
                                {venue?.name}
                              </span>
                              {isActive && <span className="text-xs text-muted-foreground shrink-0">{t('venuesSwitcher.current')}</span>}
                            </div>
                            {suspensionInfo.isSuspended && (
                              <div className={`flex items-center gap-1 mt-0.5 ${suspensionInfo.textColor}`}>
                                {SuspensionIcon && <SuspensionIcon className="h-3 w-3" />}
                                <span className="text-xs">{suspensionInfo.label}</span>
                              </div>
                            )}
                          </div>
                        </DropdownMenuItem>
                      )
                    })}
                  </div>
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
