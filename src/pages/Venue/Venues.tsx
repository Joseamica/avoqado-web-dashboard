import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/context/AuthContext'
import { themeClasses } from '@/lib/theme-utils'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

// Define the Venue interface
interface Venue {
  id: string
  name: string
  address?: string
  city?: string
  type: string
  status: 'active' | 'inactive'
  admins?: number
  waiters?: number
}

const Venues = () => {
  const { allVenues } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()

  // Filter venues based on search
  const filteredVenues = allVenues.filter((venue: Venue) => {
    return (
      venue.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (venue.address && venue.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
      venue.id.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

  const handleVenueClick = (venueId: string) => {
    navigate(`/venues/${venueId}`)
  }

  return (
    <div className={`space-y-6 ${themeClasses.pageBg} h-screen p-4`}>
      <div>
        <h2 className={`text-2xl font-bold ${themeClasses.text}`}>Gestión de Venues</h2>
        <p className={`${themeClasses.textMuted}`}>Administra todos los venues registrados en el sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Venues</CardTitle>
          <CardDescription>Vista completa de todos los venues registrados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar venues..."
                className="pl-8 w-[250px]"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Usuarios Asignados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVenues.map(venue => (
                <TableRow key={venue.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleVenueClick(venue.id)}>
                  <TableCell className="font-medium">{venue.name}</TableCell>
                  <TableCell className="text-muted-foreground">{venue.id}</TableCell>
                  <TableCell>{venue.address || 'No especificada'}</TableCell>
                  <TableCell>
                    <Badge variant={venue.status === 'active' ? 'default' : 'secondary'}>
                      {venue.status === 'active' ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell>{venue.admins || 0}</TableCell>
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
