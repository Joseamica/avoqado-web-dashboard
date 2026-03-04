import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog } from '../ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import { useAuth } from '@/context/AuthContext'
import { notifyVenueChange } from '@/services/chatService'

import { Venue, StaffRole, SessionVenue } from '@/types'
import { VenueStatus } from '@/types/superadmin'
import { Building2, ChevronsUpDown, Plus, AlertTriangle, Ban, XCircle, Check } from 'lucide-react'
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
  const { checkVenueAccess, user, switchVenue, isLoading, isAuthenticated } = useAuth()
  const { venue: activeVenue } = useCurrentVenue()
  const { organization, orgId, isOwner } = useCurrentOrganization()
  const { t } = useTranslation()

  const [isDialogOpen, setDialogOpen] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const canAddVenue = (user?.role as StaffRole) === StaffRole.SUPERADMIN

  // Check if user can see organization link (OWNER or SUPERADMIN)
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
        return { isSuspended: true, label: t('venuesSwitcher.closed'), icon: XCircle, textColor: 'text-muted-foreground' }
      default:
        return { isSuspended: false, label: '', icon: null, textColor: '' }
    }
  }

  // Group venues by organization for SUPERADMIN/OWNER users
  const venueGroups = useMemo((): VenueGroup[] => {
    if (!isSuperadmin && !isOwner) {
      return [{
        orgId: orgId || 'default',
        orgName: organization?.name || '',
        venues: venues,
      }]
    }

    const groups = new Map<string, VenueGroup>()

    venues.forEach(venue => {
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

    const sortedGroups = Array.from(groups.values())
      .sort((a, b) => a.orgName.localeCompare(b.orgName))
      .map(group => ({
        ...group,
        venues: group.venues.sort((a, b) => a.name.localeCompare(b.name)),
      }))

    return sortedGroups
  }, [venues, isSuperadmin, isOwner, orgId, organization?.name])

  // Usar el venue actual del contexto, url, localStorage, o fallback al default
  const currentVenueSlug = (() => {
    const path = location.pathname
    const venueMatch = path.match(/^\/venues\/([^/]+)/)
    if (venueMatch) return venueMatch[1]

    const wlVenueMatch = path.match(/^\/wl\/venues\/([^/]+)/)
    if (wlVenueMatch) return wlVenueMatch[1]

    return ''
  })()

  const venueFromSlug = currentVenueSlug ? venues.find(v => v.slug === currentVenueSlug) : null
  const savedVenueSlug = typeof window !== 'undefined' ? localStorage.getItem('avoqado_current_venue_slug') : null
  const venueFromStorage = savedVenueSlug ? venues.find(v => v.slug === savedVenueSlug) : null

  const currentVenue = (venueFromSlug || activeVenue || venueFromStorage || defaultVenue) as Venue | SessionVenue

  useEffect(() => {
    if (!isAuthenticated) return
    if (currentVenue?.slug) {
      localStorage.setItem('avoqado_current_venue_slug', currentVenue.slug)
    }
  }, [currentVenue?.slug, isAuthenticated])

  const handleOpenChange = (open: boolean) => {
    setPopoverOpen(open)
    if (!open) setSearchValue('')
  }

  const handleVenueChange = async (venue: Venue | SessionVenue) => {
    if (venue.slug === currentVenue.slug) {
      setPopoverOpen(false)
      return
    }

    if (user?.role !== StaffRole.OWNER && user?.role !== StaffRole.SUPERADMIN) {
      if (!checkVenueAccess(venue.slug)) {
        console.warn(`Attempted to access unauthorized venue: ${venue.slug}`)
        return
      }
    }

    try {
      await switchVenue(venue.slug)
      notifyVenueChange(venue.slug)
      setPopoverOpen(false)
    } catch (error) {
      console.error('Error switching venue:', error)
    }
  }

  const handleAddVenueClick = () => {
    if (!canAddVenue) return
    setDialogOpen(true)
    setPopoverOpen(false)
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <Popover open={popoverOpen} onOpenChange={handleOpenChange} modal={true}>
            <PopoverTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer rounded-none h-auto! px-4! py-6!"
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
                      <span className="text-xs truncate text-muted-foreground">{currentVenue?.city || ''}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
                  </>
                )}
              </SidebarMenuButton>
            </PopoverTrigger>
            <PopoverContent
              className={`p-0 ${isMobile ? 'w-[calc(100vw-2rem)]' : 'w-[340px] lg:w-[380px]'}`}
              align="start"
              side={isMobile ? 'bottom' : 'right'}
              sideOffset={8}
            >
              <Command shouldFilter={true}>
                <CommandInput
                  placeholder={t('venuesSwitcher.searchPlaceholder')}
                  value={searchValue}
                  onValueChange={setSearchValue}
                />
                <CommandList className="max-h-[min(70vh,600px)] lg:max-h-[min(80vh,800px)]">
                  <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
                    {t('venuesSwitcher.noResults')}
                  </CommandEmpty>

                  {venueGroups.map((group) => {
                    const showOrgHeader = isSuperadmin || group.venues.length > 1

                    return (
                      <CommandGroup
                        key={group.orgId}
                        heading={showOrgHeader ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (group.orgId !== 'unknown' && group.orgId !== 'default') {
                                setPopoverOpen(false)
                                navigate(`/organizations/${group.orgId}`)
                              }
                            }}
                            className="flex items-center gap-2 w-full cursor-pointer hover:text-foreground transition-colors"
                          >
                            <Building2 className="size-3.5 shrink-0" />
                            <span className="truncate">{group.orgName || t('organization:myOrganization')}</span>
                          </button>
                        ) : undefined}
                      >
                        {group.venues.map((venue) => {
                          const isActive = venue.slug === currentVenue?.slug
                          const hasAccess = user?.role === StaffRole.OWNER || user?.role === StaffRole.SUPERADMIN || checkVenueAccess(venue.slug)
                          const suspensionInfo = getSuspensionInfo(venue)
                          const SuspensionIcon = suspensionInfo.icon

                          return (
                            <CommandItem
                              key={venue.id}
                              value={venue.name}
                              keywords={[venue.city || '', venue.slug, group.orgName || '']}
                              onSelect={() => handleVenueChange(venue)}
                              disabled={!hasAccess || isLoading}
                              className="gap-2.5 py-2 cursor-pointer"
                            >
                              <Avatar className="size-7 rounded-lg shrink-0">
                                <AvatarImage src={venue?.logo} alt={`${venue?.name} Logo`} />
                                <AvatarFallback className="text-[10px] rounded-lg">
                                  {venue?.name?.charAt(0).toLocaleUpperCase() || 'V'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <span className="truncate block text-sm">{venue.name}</span>
                                {venue.city && !suspensionInfo.isSuspended && (
                                  <span className="text-xs text-muted-foreground truncate block">{venue.city}</span>
                                )}
                                {suspensionInfo.isSuspended && (
                                  <div className={`flex items-center gap-1 ${suspensionInfo.textColor}`}>
                                    {SuspensionIcon && <SuspensionIcon className="size-3" />}
                                    <span className="text-xs">{suspensionInfo.label}</span>
                                  </div>
                                )}
                              </div>
                              {isActive && <Check className="size-4 text-primary shrink-0" />}
                            </CommandItem>
                          )
                        })}
                      </CommandGroup>
                    )
                  })}

                  {canAddVenue && (
                    <>
                      <CommandSeparator />
                      <CommandGroup>
                        <CommandItem
                          onSelect={handleAddVenueClick}
                          className="gap-2.5 py-2 cursor-pointer"
                          value="__add_venue__"
                        >
                          <div className="flex justify-center items-center rounded-lg border size-7 border-dashed border-muted-foreground/40 shrink-0">
                            <Plus className="size-4 text-muted-foreground" />
                          </div>
                          <span className="text-muted-foreground font-medium text-sm">{t('venuesSwitcher.addVenue')}</span>
                        </CommandItem>
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </SidebarMenuItem>
      </SidebarMenu>

      {/* Dialog Component */}
      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <AddVenueDialog onClose={handleDialogClose} navigate={navigate} />
      </Dialog>
    </>
  )
}
