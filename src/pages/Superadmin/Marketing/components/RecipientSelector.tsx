/**
 * Recipient Selector Component
 *
 * Allows selecting target audience for marketing campaigns.
 * - All venues or specific venues
 * - Include staff by role (OWNER, ADMIN, MANAGER)
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import api from '@/api'
import * as marketingService from '@/services/superadmin-marketing.service'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Building2, Loader2, Users } from 'lucide-react'
import { useEffect, useMemo } from 'react'

interface Venue {
  id: string
  name: string
  email: string | null
}

interface RecipientSelectorProps {
  targetAllVenues: boolean
  targetVenueIds: string[]
  includeStaff: boolean
  targetStaffRoles: string[]
  onChange: (data: {
    targetAllVenues: boolean
    targetVenueIds: string[]
    includeStaff: boolean
    targetStaffRoles: string[]
  }) => void
  onPreviewUpdate?: (preview: { total: number; venueCount: number; staffCount: number }) => void
}

const STAFF_ROLES = [
  { value: 'OWNER', label: 'Owner' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MANAGER', label: 'Manager' },
]

export function RecipientSelector({
  targetAllVenues,
  targetVenueIds,
  includeStaff,
  targetStaffRoles,
  onChange,
  onPreviewUpdate,
}: RecipientSelectorProps) {
  // Fetch venues
  const { data: venuesData, isLoading: venuesLoading } = useQuery({
    queryKey: ['superadmin-venues-list'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: Venue[] }>('/api/v1/dashboard/superadmin/venues/list')
      return response.data.data
    },
  })

  // Preview recipients mutation
  const previewMutation = useMutation({
    mutationFn: marketingService.previewRecipients,
    onSuccess: data => {
      onPreviewUpdate?.({
        total: data.total,
        venueCount: data.venueCount,
        staffCount: data.staffCount,
      })
    },
  })

  // Update preview when selection changes
  useEffect(() => {
    previewMutation.mutate({
      targetAllVenues,
      targetVenueIds,
      includeStaff,
      targetStaffRoles,
    })
  }, [targetAllVenues, targetVenueIds, includeStaff, targetStaffRoles])

  // Venues with email only
  const venuesWithEmail = useMemo(() => {
    return venuesData?.filter(v => v.email) || []
  }, [venuesData])

  const handleVenueTargetChange = (value: string) => {
    onChange({
      targetAllVenues: value === 'all',
      targetVenueIds: value === 'all' ? [] : targetVenueIds,
      includeStaff,
      targetStaffRoles,
    })
  }

  const handleVenueToggle = (venueId: string) => {
    const newIds = targetVenueIds.includes(venueId) ? targetVenueIds.filter(id => id !== venueId) : [...targetVenueIds, venueId]
    onChange({
      targetAllVenues: false,
      targetVenueIds: newIds,
      includeStaff,
      targetStaffRoles,
    })
  }

  const handleIncludeStaffChange = (checked: boolean) => {
    onChange({
      targetAllVenues,
      targetVenueIds,
      includeStaff: checked,
      targetStaffRoles: checked ? targetStaffRoles : [],
    })
  }

  const handleRoleToggle = (role: string) => {
    const newRoles = targetStaffRoles.includes(role) ? targetStaffRoles.filter(r => r !== role) : [...targetStaffRoles, role]
    onChange({
      targetAllVenues,
      targetVenueIds,
      includeStaff: true,
      targetStaffRoles: newRoles,
    })
  }

  return (
    <div className="space-y-6">
      {/* Venue Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" />
            Venues
          </CardTitle>
          <CardDescription>Selecciona los venues que recibirán el email</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={targetAllVenues ? 'all' : 'specific'} onValueChange={handleVenueTargetChange}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="all-venues" />
              <Label htmlFor="all-venues" className="cursor-pointer">
                Todos los venues con email ({venuesWithEmail.length})
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="specific" id="specific-venues" />
              <Label htmlFor="specific-venues" className="cursor-pointer">
                Seleccionar venues específicos
              </Label>
            </div>
          </RadioGroup>

          {!targetAllVenues && (
            <div className="mt-4">
              {venuesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <ScrollArea className="h-[200px] rounded-md border p-2">
                  <div className="space-y-2">
                    {venuesWithEmail.map(venue => (
                      <div
                        key={venue.id}
                        className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleVenueToggle(venue.id)}
                      >
                        <Checkbox
                          id={`venue-${venue.id}`}
                          checked={targetVenueIds.includes(venue.id)}
                          onCheckedChange={() => handleVenueToggle(venue.id)}
                          onClick={e => e.stopPropagation()}
                        />
                        <Label htmlFor={`venue-${venue.id}`} className="flex-1 cursor-pointer">
                          <span className="font-medium">{venue.name}</span>
                          <span className="text-muted-foreground text-sm ml-2">{venue.email}</span>
                        </Label>
                      </div>
                    ))}
                    {venuesWithEmail.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">No hay venues con email configurado</p>
                    )}
                  </div>
                </ScrollArea>
              )}
              {targetVenueIds.length > 0 && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{targetVenueIds.length} venue(s) seleccionado(s)</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onChange({
                        targetAllVenues: false,
                        targetVenueIds: [],
                        includeStaff,
                        targetStaffRoles,
                      })
                    }
                  >
                    Limpiar selección
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Staff Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Staff
          </CardTitle>
          <CardDescription>Opcionalmente incluye staff de los venues seleccionados</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox id="include-staff" checked={includeStaff} onCheckedChange={checked => handleIncludeStaffChange(!!checked)} />
            <Label htmlFor="include-staff" className="cursor-pointer">
              Incluir staff de los venues
            </Label>
          </div>

          {includeStaff && (
            <div className="ml-6 space-y-2">
              <p className="text-sm text-muted-foreground">Selecciona los roles a incluir:</p>
              <div className="flex flex-wrap gap-2">
                {STAFF_ROLES.map(role => (
                  <Badge
                    key={role.value}
                    variant={targetStaffRoles.includes(role.value) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => handleRoleToggle(role.value)}
                  >
                    {role.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Destinatarios totales</p>
              <p className="text-2xl font-bold">
                {previewMutation.isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : previewMutation.data?.total ?? 0}
              </p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Venues: {previewMutation.data?.venueCount ?? 0}</p>
              <p>Staff: {previewMutation.data?.staffCount ?? 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
