import React, { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getOrganizationTeam } from '@/services/organization.service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Users, Search, Store } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuth } from '@/context/AuthContext'
import { useVenueDateTime } from '@/utils/datetime'

const OrganizationTeam: React.FC = () => {
  const { t } = useTranslation('organization')
  const { orgId } = useParams<{ orgId: string }>()
  const { allVenues } = useAuth()
  const { formatDate } = useVenueDateTime()
  const [searchTerm, setSearchTerm] = useState('')
  const [venueFilter, setVenueFilter] = useState<string>('all')
  const debouncedSearch = useDebounce(searchTerm, 300)

  const { data: team, isLoading } = useQuery({
    queryKey: ['organization', 'team', orgId],
    queryFn: () => getOrganizationTeam(orgId!),
    enabled: !!orgId,
  })

  const filteredTeam = useMemo(() => {
    if (!team) return []

    let filtered = team

    // Filter by venue
    if (venueFilter !== 'all') {
      filtered = filtered.filter((member) =>
        member.venues.some((v) => v.venueId === venueFilter)
      )
    }

    // Filter by search term
    if (debouncedSearch) {
      const search = debouncedSearch.toLowerCase()
      filtered = filtered.filter(
        (member) =>
          member.firstName.toLowerCase().includes(search) ||
          member.lastName.toLowerCase().includes(search) ||
          member.email.toLowerCase().includes(search) ||
          member.venues.some((v) => v.venueName.toLowerCase().includes(search))
      )
    }

    return filtered
  }, [team, debouncedSearch, venueFilter])

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role.toUpperCase()) {
      case 'OWNER':
        return 'default'
      case 'ADMIN':
        return 'secondary'
      case 'MANAGER':
        return 'outline'
      default:
        return 'outline'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            {t('team.title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('team.subtitle', { count: team?.length || 0 })}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('team.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={venueFilter} onValueChange={setVenueFilter}>
          <SelectTrigger className="w-[200px]">
            <Store className="h-4 w-4 mr-2" />
            <SelectValue placeholder={t('team.allVenues')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('team.allVenues')}</SelectItem>
            {allVenues.map((venue) => (
              <SelectItem key={venue.id} value={venue.id}>
                {venue.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Team Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('team.members')}</CardTitle>
          <CardDescription>
            {t('team.membersDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTeam.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || venueFilter !== 'all'
                ? t('team.noResults')
                : t('team.noMembers')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('team.member')}</TableHead>
                  <TableHead>{t('team.email')}</TableHead>
                  <TableHead>{t('team.phone')}</TableHead>
                  <TableHead>{t('team.venues')}</TableHead>
                  <TableHead>{t('team.joined')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeam.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {getInitials(member.firstName, member.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {member.firstName} {member.lastName}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.email}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.phone || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {member.venues.map((venue) => (
                          <Badge
                            key={`${member.id}-${venue.venueId}`}
                            variant={getRoleBadgeVariant(venue.role)}
                            className="text-xs"
                          >
                            {venue.venueName}: {venue.role}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(member.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default OrganizationTeam
