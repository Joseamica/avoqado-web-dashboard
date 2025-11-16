import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import {
  ShoppingCart,
  Plus,
  Edit,
  Trash2,
  Key,
  Copy,
  AlertCircle,
  Loader2,
  Globe,
  Power,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { ecommerceMerchantAPI, type EcommerceMerchant } from '@/services/ecommerceMerchant.service'
import { EcommerceMerchantDialog } from './components/EcommerceMerchantDialog'
import { APIKeysDialog } from './components/APIKeysDialog'

const EcommerceMerchants: React.FC = () => {
  const { t } = useTranslation(['payment', 'common'])
  const { toast } = useToast()
  const { slug } = useParams<{ slug: string }>()
  const { getVenueBySlug } = useAuth()
  const queryClient = useQueryClient()

  // State
  const [merchantDialogOpen, setMerchantDialogOpen] = useState(false)
  const [keysDialogOpen, setKeysDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedMerchant, setSelectedMerchant] = useState<EcommerceMerchant | null>(null)
  const [merchantToDelete, setMerchantToDelete] = useState<EcommerceMerchant | null>(null)

  // Get venue by slug from AuthContext
  const venue = getVenueBySlug(slug!)

  // Fetch e-commerce merchants for this venue
  const {
    data: merchants = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['ecommerce-merchants', venue?.id],
    queryFn: () => ecommerceMerchantAPI.listByVenue(venue!.id),
    enabled: !!venue?.id,
  })

  // Create merchant mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => ecommerceMerchantAPI.create(venue!.id, data),
    onSuccess: (newMerchant) => {
      queryClient.invalidateQueries({ queryKey: ['ecommerce-merchants', venue?.id] })

      // Show secret key alert (only time it's visible!)
      toast({
        title: '✅ Canal creado exitosamente',
        description: (
          <div className="space-y-2">
            <p className="font-semibold">⚠️ Guarda tu Secret Key ahora:</p>
            <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded font-mono text-sm break-all">
              {newMerchant.secretKey}
            </div>
            <p className="text-xs text-muted-foreground">
              No podrás volver a ver esta clave. Guárdala en un lugar seguro.
            </p>
          </div>
        ),
        duration: 30000, // 30 seconds
      })

      setMerchantDialogOpen(false)
      setSelectedMerchant(null)
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'No se pudo crear el canal de e-commerce',
        variant: 'destructive',
      })
    },
  })

  // Update merchant mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      ecommerceMerchantAPI.update(venue!.id, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ecommerce-merchants', venue?.id] })
      toast({
        title: t('common:success'),
        description: 'Canal actualizado exitosamente',
      })
      setMerchantDialogOpen(false)
      setSelectedMerchant(null)
    },
    onError: (error: any) => {
      toast({
        title: t('common:error'),
        description: error.response?.data?.error || 'No se pudo actualizar el canal',
        variant: 'destructive',
      })
    },
  })

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      ecommerceMerchantAPI.toggleStatus(venue!.id, id, active),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ecommerce-merchants', venue?.id] })
      toast({
        title: t('common:success'),
        description: `Canal "${data.channelName}" ${data.active ? 'activado' : 'desactivado'}`,
      })
    },
    onError: (error: any) => {
      toast({
        title: t('common:error'),
        description: error.response?.data?.error || 'No se pudo cambiar el estado',
        variant: 'destructive',
      })
    },
  })

  // Delete merchant mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => ecommerceMerchantAPI.delete(venue!.id, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ecommerce-merchants', venue?.id] })
      toast({
        title: t('common:success'),
        description: 'Canal eliminado exitosamente',
      })
      setDeleteDialogOpen(false)
      setMerchantToDelete(null)
    },
    onError: (error: any) => {
      toast({
        title: t('common:error'),
        description: error.response?.data?.error || 'No se pudo eliminar el canal',
        variant: 'destructive',
      })
    },
  })

  // Handlers
  const handleCreate = () => {
    setSelectedMerchant(null)
    setMerchantDialogOpen(true)
  }

  const handleEdit = (merchant: EcommerceMerchant) => {
    setSelectedMerchant(merchant)
    setMerchantDialogOpen(true)
  }

  const handleViewKeys = (merchant: EcommerceMerchant) => {
    setSelectedMerchant(merchant)
    setKeysDialogOpen(true)
  }

  const handleToggleStatus = (merchant: EcommerceMerchant) => {
    toggleStatusMutation.mutate({
      id: merchant.id,
      active: !merchant.active,
    })
  }

  const handleDeleteClick = (merchant: EcommerceMerchant) => {
    setMerchantToDelete(merchant)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (merchantToDelete) {
      deleteMutation.mutate(merchantToDelete.id)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: 'Copiado',
      description: `${label} copiado al portapapeles`,
    })
  }

  if (!venue) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Venue no encontrado</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Canales de E-commerce</h1>
          <p className="text-muted-foreground">
            Gestiona tus canales de pago online (web, app, marketplace)
          </p>
        </div>
        <Button onClick={handleCreate} size="lg">
          <Plus className="mr-2 h-4 w-4" />
          Crear Canal
        </Button>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Canales de E-commerce
          </CardTitle>
          <CardDescription>
            Cada canal puede tener diferentes credenciales de pago (Blumon, Stripe, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Error al cargar los canales: {(error as any).message}
              </AlertDescription>
            </Alert>
          ) : merchants.length === 0 ? (
            <div className="text-center py-12">
              <Globe className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No hay canales de e-commerce</h3>
              <p className="text-muted-foreground">
                Crea tu primer canal para empezar a recibir pagos online
              </p>
              <Button onClick={handleCreate} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Crear Primer Canal
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead>Email de Contacto</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Public Key</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {merchants.map((merchant) => (
                  <TableRow key={merchant.id}>
                    <TableCell className="font-medium">
                      {merchant.channelName}
                    </TableCell>
                    <TableCell>{merchant.contactEmail}</TableCell>
                    <TableCell>
                      {merchant.provider ? (
                        <Badge variant="outline">{merchant.provider.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {merchant.publicKey.substring(0, 20)}...
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(merchant.publicKey, 'Public Key')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={merchant.sandboxMode ? 'secondary' : 'default'}>
                        {merchant.sandboxMode ? 'Sandbox' : 'Live'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={merchant.active ? 'default' : 'secondary'}>
                        {merchant.active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewKeys(merchant)}
                          title="Ver API Keys"
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleStatus(merchant)}
                          title={merchant.active ? 'Desactivar' : 'Activar'}
                        >
                          <Power
                            className={`h-4 w-4 ${merchant.active ? 'text-green-600' : 'text-muted-foreground'}`}
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(merchant)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(merchant)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <EcommerceMerchantDialog
        open={merchantDialogOpen}
        onOpenChange={setMerchantDialogOpen}
        merchant={selectedMerchant}
        venueId={venue.id}
        onSubmit={(data) => {
          if (selectedMerchant) {
            updateMutation.mutate({ id: selectedMerchant.id, data })
          } else {
            createMutation.mutate(data)
          }
        }}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <APIKeysDialog
        open={keysDialogOpen}
        onOpenChange={setKeysDialogOpen}
        merchant={selectedMerchant}
        venueId={venue?.id || ''}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar canal de e-commerce?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el canal{' '}
              <span className="font-semibold">{merchantToDelete?.channelName}</span> y todas sus
              sesiones de checkout.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default EcommerceMerchants
