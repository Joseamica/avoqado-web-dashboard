import React, { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
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
  RefreshCcw,
  CheckCircle2,
  PlayCircle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { ecommerceMerchantAPI, type EcommerceMerchant } from '@/services/ecommerceMerchant.service'
import { EcommerceMerchantWizard } from './components/EcommerceMerchantWizard'
import { APIKeysDialog } from './components/APIKeysDialog'

const EcommerceMerchants: React.FC = () => {
  const { t } = useTranslation(['ecommerce', 'payment', 'common'])
  const { toast } = useToast()
  const { slug } = useParams<{ slug: string }>()
  const { getVenueBySlug } = useAuth()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  // State
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardMerchant, setWizardMerchant] = useState<EcommerceMerchant | null>(null)
  const [keysDialogOpen, setKeysDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedMerchant, setSelectedMerchant] = useState<EcommerceMerchant | null>(null)
  const [merchantToDelete, setMerchantToDelete] = useState<EcommerceMerchant | null>(null)

  // Post-Stripe-onboarding return state — driven by URL params Stripe redirects us with.
  // `?status=success&merchantId=X` → green banner + active polling of /onboarding-status
  // `?status=retry&merchantId=X`   → amber banner (user didn't complete onboarding)
  const returnStatus = searchParams.get('status')
  const returnMerchantId = searchParams.get('merchantId')

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

  // After Stripe redirects back with status=success, actively poll the status
  // endpoint until Stripe confirms COMPLETED (or until the user navigates away).
  // The webhook also syncs status async, so this is mostly a UX nicety so the
  // user sees the badge flip without manually clicking refresh.
  useQuery({
    queryKey: ['ecommerce-merchant-onboarding-poll', venue?.id, returnMerchantId],
    queryFn: async () => {
      if (!venue?.id || !returnMerchantId) return null
      const status = await ecommerceMerchantAPI.getStripeOnboardingStatus(venue.id, returnMerchantId)
      queryClient.invalidateQueries({ queryKey: ['ecommerce-merchants', venue.id] })
      return status
    },
    enabled: !!venue?.id && !!returnMerchantId && returnStatus === 'success',
    refetchInterval: query => {
      // Stop polling once Stripe confirms a terminal status. RESTRICTED is
      // terminal in the polling sense — Stripe needs the user to act before
      // anything new happens.
      const status = query.state.data?.status
      return status === 'COMPLETED' || status === 'RESTRICTED' ? false : 3000
    },
    refetchIntervalInBackground: false,
  })

  // Auto-open the wizard in resume mode when user returns with status=retry.
  useEffect(() => {
    if (returnStatus === 'retry' && returnMerchantId) {
      const target = merchants.find(m => m.id === returnMerchantId)
      if (target) {
        setWizardMerchant(target)
        setWizardOpen(true)
      }
    }
  }, [returnStatus, returnMerchantId, merchants])

  // Clear the URL params once we've consumed them so a page refresh doesn't
  // re-trigger banners / auto-open.
  useEffect(() => {
    if (returnStatus) {
      const timeout = setTimeout(() => {
        const next = new URLSearchParams(searchParams)
        next.delete('status')
        next.delete('merchantId')
        setSearchParams(next, { replace: true })
      }, 500)
      return () => clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnStatus])

  // (Create/update mutations live inside EcommerceMerchantWizard now — it handles
  // the multi-step Stripe Connect flow + polling on return.)

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

  const syncStripeStatusMutation = useMutation({
    mutationFn: (merchant: EcommerceMerchant) => ecommerceMerchantAPI.getStripeOnboardingStatus(venue!.id, merchant.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ecommerce-merchants', venue?.id] })
      toast({
        title: t('common:success'),
        description: 'Estado de Stripe actualizado',
      })
    },
    onError: (error: any) => {
      toast({
        title: t('common:error'),
        description: error.response?.data?.error || 'No se pudo actualizar el estado de Stripe',
        variant: 'destructive',
      })
    },
  })

  // Handlers
  const handleCreate = () => {
    setWizardMerchant(null)
    setWizardOpen(true)
  }

  const handleEdit = (merchant: EcommerceMerchant) => {
    setWizardMerchant(merchant)
    setWizardOpen(true)
  }

  /** Resume / continue onboarding for an incomplete Stripe Connect merchant. */
  const handleContinueOnboarding = (merchant: EcommerceMerchant) => {
    setWizardMerchant(merchant)
    setWizardOpen(true)
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

  const renderStripeStatus = (merchant: EcommerceMerchant) => {
    if (merchant.provider?.code !== 'STRIPE_CONNECT') return null
    if (merchant.chargesEnabled) return <Badge variant="default">Stripe listo</Badge>
    if (merchant.onboardingStatus === 'REJECTED') return <Badge variant="destructive">Stripe rechazó</Badge>
    if (merchant.onboardingStatus === 'RESTRICTED') return <Badge variant="destructive">Stripe restringido</Badge>
    if (merchant.onboardingStatus === 'PENDING_VERIFICATION') return <Badge variant="secondary">Stripe revisando</Badge>
    if (merchant.onboardingStatus === 'IN_PROGRESS') return <Badge variant="secondary">Stripe pendiente</Badge>
    return <Badge variant="outline">Stripe sin alta</Badge>
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
        <AlertDescription>{t('venueNotFound')}</AlertDescription>
      </Alert>
    )
  }

  // Show the merchant we just returned from Stripe for, so the banner can
  // include its name. Falls back gracefully if not found.
  const returnedMerchant = returnMerchantId ? merchants.find(m => m.id === returnMerchantId) : null

  return (
    <div className="space-y-6">
      {/* Return-from-Stripe banner */}
      {returnStatus === 'success' && (
        <Alert className="border-emerald-500/40 bg-emerald-500/5">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <AlertDescription className="text-emerald-700 dark:text-emerald-300">
            <strong>{t('wizard.returnBanner.successTitle')}</strong>
            {returnedMerchant && <> — {returnedMerchant.channelName}.</>} {t('wizard.returnBanner.successDesc')}
          </AlertDescription>
        </Alert>
      )}
      {returnStatus === 'retry' && (
        <Alert className="border-amber-500/40 bg-amber-500/5">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <strong>{t('wizard.returnBanner.retryTitle')}</strong>
            {returnedMerchant && <> — {returnedMerchant.channelName}.</>} {t('wizard.returnBanner.retryDesc')}
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
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
              <h3 className="mt-4 text-lg font-semibold">{t('noChannels')}</h3>
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
                  <TableHead>{t('columns.channel')}</TableHead>
                  <TableHead>{t('columns.contactEmail')}</TableHead>
                  <TableHead>{t('columns.provider')}</TableHead>
                  <TableHead>{t('columns.publicKey')}</TableHead>
                  <TableHead>{t('columns.mode')}</TableHead>
                  <TableHead>{t('columns.status')}</TableHead>
                  <TableHead className="text-right">{t('columns.actions')}</TableHead>
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
                      <div className="mt-1">{renderStripeStatus(merchant)}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {merchant.provider?.code === 'STRIPE_CONNECT' && (
                          <>
                            {merchant.onboardingStatus !== 'COMPLETED' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleContinueOnboarding(merchant)}
                                title="Continuar onboarding de Stripe"
                              >
                                <PlayCircle className="h-4 w-4 text-amber-600" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => syncStripeStatusMutation.mutate(merchant)}
                              disabled={syncStripeStatusMutation.isPending}
                              title="Actualizar estado de Stripe"
                            >
                              <RefreshCcw className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewKeys(merchant)}
                          title={t('viewApiKeys')}
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

      {/* Wizard (replaces legacy EcommerceMerchantDialog) */}
      <EcommerceMerchantWizard
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false)
          setWizardMerchant(null)
        }}
        venueId={venue.id}
        merchant={wizardMerchant}
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
            <AlertDialogTitle>{t('deleteConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el canal{' '}
              <span className="font-semibold">{merchantToDelete?.channelName}</span> y todas sus
              sesiones de checkout.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('deleteConfirm.cancel')}</AlertDialogCancel>
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
