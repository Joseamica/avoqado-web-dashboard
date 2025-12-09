import { useState } from 'react'
import { ChevronRight, Building2, Store, ChevronsUpDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import { StaffRole, Venue, SessionVenue } from '@/types'
import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

/**
 * HierarchicalNavigator Component
 *
 * Displays a hierarchical navigation dropdown in the header:
 * - For OWNER: [Organization ▼] > [Venue ▼]
 * - For others: [Venue name] (no dropdown)
 *
 * Clicking on Organization navigates to /organizations/:orgId/dashboard
 * Clicking on Venue shows a dropdown with all available venues
 */
export function HierarchicalNavigator() {
  const { t } = useTranslation('organization')
  const navigate = useNavigate()
  const { user, allVenues, switchVenue, checkVenueAccess } = useAuth()
  const { venue: currentVenue, venueSlug } = useCurrentVenue()
  const { organization, orgId, isOwner } = useCurrentOrganization()

  // Controlled dropdown state to prevent race conditions with navigation
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false)
  const [venueDropdownOpen, setVenueDropdownOpen] = useState(false)

  // Only show for authenticated users
  if (!user) return null

  const handleOrgClick = () => {
    if (orgId) {
      setOrgDropdownOpen(false)
      navigate(`/organizations/${orgId}`)
    }
  }

  const handleVenueChange = async (venue: Venue | SessionVenue) => {
    if (venue.slug === venueSlug) {
      setVenueDropdownOpen(false)
      return
    }

    // For non-privileged users, check access
    if (user.role !== StaffRole.OWNER && user.role !== StaffRole.SUPERADMIN) {
      if (!checkVenueAccess(venue.slug)) {
        console.warn(`Attempted to access unauthorized venue: ${venue.slug}`)
        return
      }
    }

    setVenueDropdownOpen(false)
    await switchVenue(venue.slug)
  }

  // For non-OWNER users, just show the venue name (no hierarchy)
  if (!isOwner) {
    return (
      <div className="flex items-center gap-2">
        <Store className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium truncate max-w-[150px]">
          {currentVenue?.name || t('common:venuesSwitcher.selectVenue')}
        </span>
      </div>
    )
  }

  // For OWNER/SUPERADMIN: show hierarchical navigation
  return (
    <div className="flex items-center gap-1">
      {/* Organization Dropdown */}
      <DropdownMenu open={orgDropdownOpen} onOpenChange={setOrgDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1.5 px-2 h-8 hover:bg-muted"
          >
            <Building2 className="h-4 w-4 text-primary" />
            <span className="font-medium truncate max-w-[120px]">
              {organization?.name || t('myOrganization')}
            </span>
            <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {t('organization')}
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={handleOrgClick}
            className="cursor-pointer"
          >
            <Building2 className="h-4 w-4 mr-2" />
            <div className="flex flex-col">
              <span className="font-medium">{organization?.name || t('myOrganization')}</span>
              <span className="text-xs text-muted-foreground">
                {organization?.venueCount || 0} {t('venues')}
              </span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleOrgClick}
            className="cursor-pointer text-primary"
          >
            {t('viewDashboard')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Separator */}
      <ChevronRight className="h-4 w-4 text-muted-foreground" />

      {/* Venue Dropdown */}
      <DropdownMenu open={venueDropdownOpen} onOpenChange={setVenueDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1.5 px-2 h-8 hover:bg-muted"
          >
            <Avatar className="h-5 w-5 rounded">
              <AvatarImage src={currentVenue?.logo} alt={currentVenue?.name} />
              <AvatarFallback className="text-xs">
                {currentVenue?.name?.charAt(0).toUpperCase() || 'V'}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium truncate max-w-[120px]">
              {currentVenue?.name || t('common:venuesSwitcher.selectVenue')}
            </span>
            <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {t('common:venuesSwitcher.title')}
          </DropdownMenuLabel>
          {allVenues.map(venue => {
            const isActive = venue.slug === venueSlug
            const hasAccess =
              user.role === StaffRole.OWNER ||
              user.role === StaffRole.SUPERADMIN ||
              checkVenueAccess(venue.slug)

            return (
              <DropdownMenuItem
                key={venue.id}
                onClick={() => handleVenueChange(venue)}
                className={cn(
                  'cursor-pointer gap-2',
                  isActive && 'bg-accent',
                  !hasAccess && 'opacity-50 cursor-not-allowed'
                )}
                disabled={!hasAccess}
              >
                <Avatar className="h-6 w-6 rounded">
                  <AvatarImage src={venue.logo} alt={venue.name} />
                  <AvatarFallback className="text-xs">
                    {venue.name?.charAt(0).toUpperCase() || 'V'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="truncate">{venue.name}</span>
                  {venue.city && (
                    <span className="text-xs text-muted-foreground truncate">
                      {venue.city}
                    </span>
                  )}
                </div>
                {isActive && (
                  <span className="text-xs text-muted-foreground">
                    {t('common:venuesSwitcher.current')}
                  </span>
                )}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
