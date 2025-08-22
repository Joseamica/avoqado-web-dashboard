import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/context/AuthContext'
import { ArrowLeft, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const Venues = () => {
  const { allVenues } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()

  // Filter venues based on search
  const filteredVenues = allVenues.filter((venue) => {
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
          Volver al Panel de Administración
        </Link>
      )}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Gestión de Venues</h2>
        <p className="text-muted-foreground">Administra todos los venues registrados en el sistema</p>
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
                    <Badge variant={venue.active ? 'default' : 'secondary'}>
                      {venue.active ? 'Activo' : 'Inactivo'}
                    </Badge>
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
