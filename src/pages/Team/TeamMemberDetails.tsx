import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  ArrowLeft, 
  Mail, 
  Calendar, 
  DollarSign, 
  ShoppingCart, 
  Star,
  Edit3,
  Trash2,
  Shield,
  Clock,
  TrendingUp
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { themeClasses } from '@/lib/theme-utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import { StaffRole } from '@/types'
import teamService from '@/services/team.service'
import { canViewSuperadminInfo, getRoleDisplayName, getRoleBadgeColor } from '@/utils/role-permissions'

import EditTeamMemberForm from './components/EditTeamMemberForm'


export default function TeamMemberDetails() {
  const { venueId } = useCurrentVenue()
  const { memberId } = useParams<{ memberId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { staffInfo } = useAuth()
  const queryClient = useQueryClient()

  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)

  // Fetch team member details
  const { data: memberDetails, isLoading } = useQuery({
    queryKey: ['team-member', venueId, memberId],
    queryFn: () => teamService.getTeamMember(venueId, memberId!),
    enabled: !!memberId,
  })

  // Remove team member mutation
  const removeTeamMemberMutation = useMutation({
    mutationFn: () => teamService.removeTeamMember(venueId, memberId!),
    onSuccess: () => {
      toast({
        title: 'Miembro eliminado',
        description: 'El miembro del equipo ha sido eliminado correctamente.',
      })
      navigate(-1)
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo eliminar el miembro del equipo.',
        variant: 'destructive',
      })
    },
  })

  const handleGoBack = () => {
    navigate(-1)
  }

  const handleEditSuccess = () => {
    setShowEditDialog(false)
    queryClient.invalidateQueries({ queryKey: ['team-member', venueId, memberId] })
    queryClient.invalidateQueries({ queryKey: ['team-members', venueId] })
  }

  const handleRemoveConfirm = () => {
    removeTeamMemberMutation.mutate()
    setShowRemoveDialog(false)
  }

  if (isLoading) {
    return (
      <div className={`p-6 ${themeClasses.pageBg} ${themeClasses.text}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-48 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!memberDetails) {
    return (
      <div className={`p-6 ${themeClasses.pageBg} ${themeClasses.text}`}>
        <div className="text-center py-12">
          <h1 className="text-xl font-semibold text-gray-900">Miembro no encontrado</h1>
          <p className="text-gray-600 mt-2">El miembro del equipo que buscas no existe o ha sido eliminado.</p>
          <Button onClick={handleGoBack} className="mt-4">
            Volver al Equipo
          </Button>
        </div>
      </div>
    )
  }

  // Hide superadmin members from non-superadmin users
  if (memberDetails.role === StaffRole.SUPERADMIN && !canViewSuperadminInfo(staffInfo?.role)) {
    return (
      <div className={`p-6 ${themeClasses.pageBg} ${themeClasses.text}`}>
        <div className="text-center py-12">
          <h1 className="text-xl font-semibold text-gray-900">Acceso denegado</h1>
          <p className="text-gray-600 mt-2">No tienes permisos para ver este miembro del equipo.</p>
          <Button onClick={handleGoBack} className="mt-4">
            Volver al Equipo
          </Button>
        </div>
      </div>
    )
  }

  const canEdit = memberDetails.role !== StaffRole.SUPERADMIN
  const canRemove = memberDetails.role !== StaffRole.OWNER && memberDetails.role !== StaffRole.SUPERADMIN

  return (
    <div className={`p-6 ${themeClasses.pageBg} ${themeClasses.text}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={handleGoBack} className="p-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {memberDetails.firstName} {memberDetails.lastName}
            </h1>
            <p className="text-gray-600">Detalles del miembro del equipo</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {canEdit && (
            <Button id="member-edit-button" variant="outline" onClick={() => setShowEditDialog(true)}>
              <Edit3 className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
          {canRemove && (
            <Button
              variant="outline"
              onClick={() => setShowRemoveDialog(true)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Member Profile Card */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {memberDetails.firstName[0]}{memberDetails.lastName[0]}
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">
                    {memberDetails.firstName} {memberDetails.lastName}
                  </CardTitle>
                  <Badge className={getRoleBadgeColor(memberDetails.role, staffInfo?.role)}>
                    {getRoleDisplayName(memberDetails.role, staffInfo?.role)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-sm">{memberDetails.email}</span>
              </div>
              
              <div className="flex items-center space-x-3">
                <Calendar className="h-4 w-4 text-gray-400" />
                <div>
                  <div className="text-sm">Fecha de inicio</div>
                  <div className="text-xs text-gray-600">
                    {new Date(memberDetails.startDate).toLocaleDateString('es-ES')}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Shield className="h-4 w-4 text-gray-400" />
                <div>
                  <div className="text-sm">Estado</div>
                  <Badge variant={memberDetails.active ? 'default' : 'secondary'}>
                    {memberDetails.active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </div>

              {memberDetails.pin && (
                <div className="flex items-center space-x-3">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="text-sm">PIN configurado</div>
                    <div className="text-xs text-gray-600">••••</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Performance Metrics */}
        <div className="lg:col-span-2 space-y-6">
          {/* Performance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Ventas Totales</p>
                    <p className="text-2xl font-bold text-green-600">
                      ${memberDetails.totalSales.toLocaleString()}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Órdenes Totales</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {memberDetails.totalOrders.toLocaleString()}
                    </p>
                  </div>
                  <ShoppingCart className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Calificación Promedio</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {memberDetails.averageRating.toFixed(1)}
                    </p>
                  </div>
                  <Star className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Additional Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Métricas de Rendimiento
              </CardTitle>
              <CardDescription>
                Estadísticas detalladas del desempeño del miembro
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Propinas Totales:</span>
                    <span className="font-medium">${memberDetails.totalTips.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Promedio por Orden:</span>
                    <span className="font-medium">
                      ${memberDetails.totalOrders > 0 
                        ? (memberDetails.totalSales / memberDetails.totalOrders).toFixed(2) 
                        : '0.00'}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Días Activos:</span>
                    <span className="font-medium">
                      {Math.floor((Date.now() - new Date(memberDetails.startDate).getTime()) / (1000 * 60 * 60 * 24))} días
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Venue:</span>
                    <span className="font-medium">{memberDetails.venue.name}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Organization Info */}
          <Card>
            <CardHeader>
              <CardTitle>Información de la Organización</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Organización:</span>
                  <span className="font-medium">{memberDetails.venue.organization.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Establecimiento:</span>
                  <span className="font-medium">{memberDetails.venue.name}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      {showEditDialog && (
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent
            className="max-w-md"
            onCloseAutoFocus={(e) => {
              // Restore focus to the Edit button for accessibility
              e.preventDefault()
              const el = document.getElementById('member-edit-button') as HTMLButtonElement | null
              el?.focus()
            }}
          >
            <DialogHeader>
              <DialogTitle>Editar Miembro del Equipo</DialogTitle>
              <DialogDescription>
                Actualiza el rol y configuración de {memberDetails.firstName} {memberDetails.lastName}.
              </DialogDescription>
            </DialogHeader>
            <EditTeamMemberForm
              venueId={venueId}
              teamMember={memberDetails}
              onSuccess={handleEditSuccess}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Remove Confirmation Dialog */}
      {showRemoveDialog && (
        <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar miembro del equipo?</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que deseas eliminar a {memberDetails.firstName} {memberDetails.lastName} del equipo?
                Esta acción no se puede deshacer y el miembro perderá acceso al dashboard.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemoveConfirm}
                disabled={removeTeamMemberMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {removeTeamMemberMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}