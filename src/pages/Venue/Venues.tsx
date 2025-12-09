import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/context/AuthContext'
import { ArrowLeft, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { VenueStatus } from '@/types'

/**
 * Get badge variant and label for venue status
 * Maps VenueStatus enum to UI representation
 */
function getVenueStatusBadge(status?: VenueStatus, active?: boolean): { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string } {
  // Fallback to active boolean if status is not available (backwards compatibility)
  if (!status) {
    return active ? { variant: 'default', label: 'Activo' } : { variant: 'secondary', label: 'Inactivo' }
  }

  switch (status) {
    case VenueStatus.ONBOARDING:
      return { variant: 'outline', label: 'Configurando' }
    case VenueStatus.TRIAL:
      return { variant: 'outline', label: 'Demo' }
    case VenueStatus.PENDING_ACTIVATION:
      return { variant: 'outline', label: 'Pendiente KYC' }
    case VenueStatus.ACTIVE:
      return { variant: 'default', label: 'Activo' }
    case VenueStatus.SUSPENDED:
      return { variant: 'secondary', label: 'Suspendido' }
    case VenueStatus.ADMIN_SUSPENDED:
      return { variant: 'destructive', label: 'Suspendido (Admin)' }
    case VenueStatus.CLOSED:
      return { variant: 'secondary', label: 'Cerrado' }
    default:
      return { variant: 'secondary', label: 'Desconocido' }
  }
}

const Venues = () => {
  const { t } = useTranslation('venues')
  const { allVenues } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()

  // Filter venues based on search
  const filteredVenues = allVenues.filter(venue => {
    return (
      venue.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (venue.address && venue.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
      venue.id.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

  const handleVenueClick = (venueId: string) => {
    navigate(`${venueId}`)
  }

  return (
    <div className="py-8 h-screen bg-background md:px-6 lg:px-8">
      {/* Conditional Back link for admin context - consider more robust routing if page used elsewhere extensively */}
      {window.location.pathname.startsWith('/admin/venues') && (
        <Link to="/admin" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('list.backToAdmin')}
        </Link>
      )}
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t('list.title')}</h2>
        <p className="text-muted-foreground">{t('list.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('list.cardTitle')}</CardTitle>
          <CardDescription>{t('list.cardDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder={t('list.searchPlaceholder')}
                className="pl-8 w-[250px]"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('list.columns.name')}</TableHead>
                <TableHead>{t('list.columns.id')}</TableHead>
                <TableHead>{t('list.columns.address')}</TableHead>
                <TableHead>{t('list.columns.status')}</TableHead>
                <TableHead>{t('list.columns.assignedUsers')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVenues.map(venue => (
                <TableRow
                  key={venue.id}
                  className="cursor-pointer hover:bg-muted/50 border-b border-border"
                  onClick={() => handleVenueClick(venue.id)}
                >
                  <TableCell className="font-medium">{venue.name}</TableCell>
                  <TableCell className="text-muted-foreground">{venue.id}</TableCell>
                  <TableCell>{venue.address || t('list.noAddress')}</TableCell>
                  <TableCell>
                    {(() => {
                      const { variant, label } = getVenueStatusBadge(venue.status, venue.active)
                      return <Badge variant={variant}>{label}</Badge>
                    })()}
                  </TableCell>
                  <TableCell>-</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default Venues
