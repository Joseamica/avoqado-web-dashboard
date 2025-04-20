import api from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Eye, EyeOff, DollarSign, ClipboardList } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function WaiterId() {
  const { venueId, waiterId } = useParams()
  const location = useLocation()
  const [showPin, setShowPin] = useState(false)

  // Traemos la información del mesero
  const { data: waiter, isLoading } = useQuery({
    queryKey: ['waiter', venueId, waiterId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/waiters/${waiterId}`)
      return response.data
    },
  })

  const from = (location.state as any)?.from || `/dashboard/${venueId}/waiters`

  // Calculate total tips
  const totalTips = waiter?.tips?.reduce((sum: number, tip: any) => sum + (parseFloat(tip.amount) || 0), 0) || 0

  // Count attended bills
  const attendedBills = waiter?.bills?.length || 0

  if (isLoading) {
    return <div className="p-8 text-center">Cargando información del mesero...</div>
  }

  return (
    <div>
      <div className="sticky z-10 flex flex-row justify-between w-full px-4 py-3 mb-4 bg-white border-b-2 top-14">
        <div className="space-x-4 flex-row-center">
          <Link to={from}>
            <ArrowLeft />
          </Link>
          <span>{waiter?.nombre || 'Detalles del mesero'}</span>
        </div>
      </div>

      <div className="max-w-7xl p-6 mx-auto">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 mb-6">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-medium">Propinas Totales</CardTitle>
              <DollarSign className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">${totalTips.toFixed(2)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-medium">Cuentas Atendidas</CardTitle>
              <ClipboardList className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{attendedBills}</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <Label htmlFor="idmesero">ID de Mesero</Label>
              <Input id="idmesero" value={waiter?.idmesero || ''} disabled />
            </div>

            <div className="relative">
              <Label htmlFor="pin">PIN</Label>
              <div className="relative">
                <Input id="pin" type={showPin ? 'text' : 'password'} value={waiter?.pin || ''} disabled className="pr-10" />
                <Button
                  type="button"
                  variant="ghost"
                  className="absolute right-0 top-0 h-full px-3 py-2"
                  onClick={() => setShowPin(!showPin)}
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="nombre">Nombre completo</Label>
            <Input id="nombre" value={waiter?.nombre || ''} disabled />
          </div>

          <div>
            <Label htmlFor="captain">Rol</Label>
            <Input id="captain" value={waiter?.captain ? 'Capitán' : 'Mesero'} disabled />
          </div>
        </div>

        <Separator className="my-6" />

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Información adicional</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">ID</Label>
              <p className="text-sm break-all">{waiter?.id}</p>
            </div>
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">Venue ID</Label>
              <p className="text-sm">{waiter?.venueId}</p>
            </div>
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">Creado</Label>
              <p className="text-sm">{waiter?.createdAt ? new Date(waiter.createdAt).toLocaleString() : '-'}</p>
            </div>
            <div className="p-4 border rounded-md">
              <Label className="text-sm text-muted-foreground">Última actualización</Label>
              <p className="text-sm">{waiter?.updatedAt ? new Date(waiter.updatedAt).toLocaleString() : '-'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
