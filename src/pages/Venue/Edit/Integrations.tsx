import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, ArrowRight, CheckCircle2, Plus, Power, ShoppingCart, Trash2, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useForm } from 'react-hook-form'
import { useToast } from '@/hooks/use-toast'
import { CryptoConfigSection } from '@/pages/Settings/components/CryptoConfigSection'
import { PosType } from '@/types'
import api from '@/api'
import { z } from 'zod'
import { useVenueEditActions } from '../VenueEditLayout'
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
import { ecommerceMerchantAPI, type EcommerceMerchant } from '@/services/ecommerceMerchant.service'
import { EcommerceMerchantWizard } from '../components/EcommerceMerchantWizard'
import { useAuth } from '@/context/AuthContext'
import { StaffRole } from '@/types'

// eslint-disable-next-line unused-imports/no-unused-vars
const posFormSchema = z.object({
  posType: z.nativeEnum(PosType).nullable().optional(),
})

type PosFormValues = z.infer<typeof posFormSchema>

interface VenueIntegrations {
  id: string
  name: string
  posType: PosType | null
  posStatus: string
}

export default function VenueIntegrations() {
  const { t } = useTranslation('venue')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { setActions } = useVenueEditActions()

  const { data: venue, isLoading } = useQuery<VenueIntegrations>({
    queryKey: ['venue-integrations', venueId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}`)
      return response.data
    },
    enabled: !!venueId,
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 404) return false
      return failureCount < 2
    },
  })

  // Fetch Google Integration status
  const { data: googleStatus } = useQuery({
    queryKey: ['google-integration', venueId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/integrations/google/status`)
      return response.data
    },
    enabled: !!venueId,
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 404) return false
      return failureCount < 2
    },
  })

  const form = useForm<PosFormValues>({
    defaultValues: {
      posType: null,
    },
  })

  useEffect(() => {
    if (venue) {
      form.reset({
        posType: (venue.posType as PosType) || null,
      })
    }
  }, [venue, form])

  const updateVenue = useMutation({
    mutationFn: async (data: PosFormValues) => {
      const venueData: any = {}
      if (data.posType) venueData.posType = data.posType
      return await api.put(`/api/v1/dashboard/venues/${venueId}`, venueData)
    },
    onSuccess: () => {
      toast({
        title: t('edit.integrations.toast.success'),
        description: t('edit.integrations.toast.successDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['venue-integrations', venueId] })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data', venueId] })
    },
    onError: (error: any) => {
      toast({
        title: t('edit.integrations.toast.error'),
        description: error.response?.data?.message || t('edit.integrations.toast.errorDesc'),
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (data: PosFormValues) => {
    updateVenue.mutate(data)
  }

  // Register actions with parent layout
  useEffect(() => {
    setActions({
      onSave: form.handleSubmit(onSubmit),
      onCancel: () => form.reset(),
      isDirty: form.formState.isDirty,
      isLoading: updateVenue.isPending,
      canEdit: true, // No permission check for integrations
    })
  }, [form.formState.isDirty, updateVenue.isPending, setActions, form])

  if (isLoading) {
    return (
      <div className="container mx-auto pt-6 pb-20 px-3 md:px-4 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!venue) {
    return (
      <div className="container mx-auto pt-6 pb-20 px-3 md:px-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('edit.integrations.error', { defaultValue: 'Error' })}</AlertTitle>
          <AlertDescription>{t('edit.integrations.errorLoading')}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto pt-6 pb-20 px-3 md:px-4 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t('edit.integrations.title')}</h2>
        <p className="text-muted-foreground mt-2">{t('edit.integrations.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('edit.integrations.pos.title')}</CardTitle>
          <CardDescription>{t('edit.integrations.pos.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="posType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('edit.integrations.pos.system')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('edit.integrations.pos.selectPlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={PosType.SOFTRESTAURANT}>
                          {t('edit.integrations.pos.types.softRestaurant')}
                        </SelectItem>
                        <SelectItem value={PosType.SQUARE}>{t('edit.integrations.pos.types.square')}</SelectItem>
                        <SelectItem value={PosType.TOAST}>{t('edit.integrations.pos.types.toast')}</SelectItem>
                        <SelectItem value={PosType.CLOVER}>{t('edit.integrations.pos.types.clover')}</SelectItem>
                        <SelectItem value={PosType.ALOHA}>{t('edit.integrations.pos.types.aloha')}</SelectItem>
                        <SelectItem value={PosType.MICROS}>{t('edit.integrations.pos.types.micros')}</SelectItem>
                        <SelectItem value={PosType.NCR}>{t('edit.integrations.pos.types.ncr')}</SelectItem>
                        <SelectItem value={PosType.CUSTOM}>{t('edit.integrations.pos.types.custom')}</SelectItem>
                        <SelectItem value={PosType.NONE}>{t('edit.integrations.pos.types.none')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </CardContent>
      </Card>

      <Separator />

      {/* E-commerce / Pagos online (Stripe Connect, Blumon eCommerce, ...) */}
      <EcommercePaymentsSection venueId={venueId!} />

      <Separator />

      {/* Google Business Profile Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('edit.integrations.google.title', { defaultValue: 'Google Business Profile' })}</CardTitle>
              <CardDescription>{t('edit.integrations.google.description')}</CardDescription>
            </div>
            {googleStatus?.connected ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {t('edit.integrations.google.connected')}
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <XCircle className="h-3 w-3" />
                {t('edit.integrations.google.notConnected')}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {googleStatus?.connected ? (
            <>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t('edit.integrations.google.connectedTo')}: <span className="font-medium text-foreground">{googleStatus.email}</span>
                </p>
                {googleStatus.locationName && (
                  <p className="text-sm text-muted-foreground">
                    {t('edit.integrations.google.location')}: <span className="font-medium text-foreground">{googleStatus.locationName}</span>
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('edit.integrations.google.notConnectedDesc')}</p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 dark:text-green-400 shrink-0" />
                  {t('edit.integrations.google.benefit1')}
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 dark:text-green-400 shrink-0" />
                  {t('edit.integrations.google.benefit2')}
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 dark:text-green-400 shrink-0" />
                  {t('edit.integrations.google.benefit3')}
                </li>
              </ul>
            </div>
          )}

          <Button asChild>
            <Link to="google">
              {googleStatus?.connected ? t('edit.integrations.google.manage') : t('edit.integrations.google.connect')}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* B4Bit Crypto Payments */}
      <CryptoConfigSection />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// E-commerce / Pagos online (Stripe Connect & co.)
// Lists this venue's ecommerce merchants with their onboarding state and a
// single CTA to create a new one. Reuses the EcommerceMerchantWizard so the
// flow is identical to the one from the SUPERADMIN list page.
// ─────────────────────────────────────────────────────────────────────────

function EcommercePaymentsSection({ venueId }: { venueId: string }) {
  const { t } = useTranslation('ecommerce')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isSuperadmin = user?.role === StaffRole.SUPERADMIN
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardMerchant, setWizardMerchant] = useState<EcommerceMerchant | null>(null)
  const [merchantToDelete, setMerchantToDelete] = useState<EcommerceMerchant | null>(null)
  const [feeEditingId, setFeeEditingId] = useState<string | null>(null)
  const [feeDraft, setFeeDraft] = useState<string>('')

  const { data: merchants = [], isLoading } = useQuery({
    queryKey: ['ecommerce-merchants', venueId],
    queryFn: () => ecommerceMerchantAPI.listByVenue(venueId),
    enabled: !!venueId,
  })

  const deleteMutation = useMutation({
    mutationFn: (merchantId: string) => ecommerceMerchantAPI.delete(venueId, merchantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ecommerce-merchants', venueId] })
      toast({ title: 'Canal eliminado' })
      setMerchantToDelete(null)
    },
    onError: (err: any) => {
      toast({
        title: 'Error',
        description: err?.response?.data?.error || err?.message || 'No se pudo eliminar el canal',
        variant: 'destructive',
      })
    },
  })

  // Soft-delete (deactivate) for COMPLETED Stripe Connect merchants. Backend
  // refuses to hard-delete them because the underlying Stripe acct_* is live
  // and may still receive disputes / payouts. "Desactivar" sets active=false
  // and pauses the channel without orphaning the Stripe account.
  const toggleActiveMutation = useMutation({
    mutationFn: ({ merchantId, active }: { merchantId: string; active: boolean }) =>
      ecommerceMerchantAPI.toggleStatus(venueId, merchantId, active),
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['ecommerce-merchants', venueId] })
      toast({ title: vars.active ? 'Canal reactivado' : 'Canal desactivado' })
    },
    onError: (err: any) => {
      toast({
        title: 'Error',
        description: err?.response?.data?.error || err?.message || 'No se pudo cambiar el estado',
        variant: 'destructive',
      })
    },
  })

  /**
   * For Stripe Connect merchants that are already processing payments
   * (chargesEnabled), the OWNER can only deactivate (not delete). Hard-delete
   * stays available for everything else (NOT_STARTED / IN_PROGRESS /
   * RESTRICTED Stripe, or non-Stripe providers).
   */
  const requiresSoftDelete = (m: EcommerceMerchant): boolean =>
    m.provider?.code === 'STRIPE_CONNECT' && !!m.chargesEnabled

  // SUPERADMIN-only: update the platform fee (Avoqado margin).
  const platformFeeMutation = useMutation({
    mutationFn: ({ merchantId, bps }: { merchantId: string; bps: number }) =>
      ecommerceMerchantAPI.updatePlatformFee(venueId, merchantId, bps),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ecommerce-merchants', venueId] })
      toast({ title: 'Comisión actualizada' })
      setFeeEditingId(null)
    },
    onError: (err: any) => {
      toast({
        title: 'Error',
        description: err?.response?.data?.error || err?.message || 'No se pudo actualizar la comisión',
        variant: 'destructive',
      })
    },
  })

  const formatBps = (bps?: number) => {
    if (typeof bps !== 'number') return '—'
    // 100 bps = 1.00%
    return `${(bps / 100).toFixed(2)}%`
  }

  const renderStatus = (m: EcommerceMerchant) => {
    if (m.provider?.code !== 'STRIPE_CONNECT') {
      return <Badge variant={m.active ? 'default' : 'secondary'}>{m.active ? 'Activo' : 'Inactivo'}</Badge>
    }
    if (m.chargesEnabled)
      return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20">✓ Listo</Badge>
    // Order matters: REJECTED is terminal failure (worst), then RESTRICTED
    // (user must act), then PENDING_VERIFICATION (waiting on Stripe, user
    // can't act), then IN_PROGRESS (in the middle of doing the flow).
    if (m.onboardingStatus === 'REJECTED')
      return <Badge variant="destructive">Stripe rechazó</Badge>
    if (m.onboardingStatus === 'RESTRICTED')
      return <Badge variant="destructive">Stripe pide más info</Badge>
    if (m.onboardingStatus === 'PENDING_VERIFICATION')
      return <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20">Stripe revisando</Badge>
    if (m.onboardingStatus === 'IN_PROGRESS')
      return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20">Pendiente</Badge>
    return <Badge variant="outline">Sin alta</Badge>
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Pagos online (E-commerce)</CardTitle>
                <CardDescription>
                  Conecta Stripe u otro procesador para cobrar en tu sitio web, app o ligas de pago.
                </CardDescription>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setWizardMerchant(null)
                setWizardOpen(true)
              }}
              data-tour="ecommerce-add-channel-btn"
            >
              <Plus className="h-4 w-4 mr-2" />
              {merchants.length === 0 ? 'Configurar Stripe' : 'Agregar canal'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : merchants.length === 0 ? (
            <div className="rounded-xl border border-dashed border-input p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Aún no tienes canales de pago online. Conecta Stripe en ~5 minutos para empezar a recibir pagos en tu sitio web,
                ligas de pago y reservaciones.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {merchants.map(m => (
                <div
                  key={m.id}
                  className="flex flex-col gap-2 rounded-xl border border-input p-4 hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setWizardMerchant(m)
                        setWizardOpen(true)
                      }}
                      className="flex flex-1 min-w-0 items-center justify-between gap-3 text-left cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{m.channelName}</span>
                          {m.provider?.name && (
                            <Badge variant="outline" className="text-xs">
                              {m.provider.name}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{m.contactEmail}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {renderStatus(m)}
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                    {requiresSoftDelete(m) ? (
                      /* COMPLETED Stripe → toggle active (soft delete). Hard
                         delete needs Superadmin offboarding because the live
                         acct_* in Stripe must be properly closed. */
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleActiveMutation.mutate({ merchantId: m.id, active: !m.active })}
                        disabled={toggleActiveMutation.isPending}
                        className="h-8 w-8 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title={m.active ? 'Desactivar canal (pausa pagos sin eliminar)' : 'Reactivar canal'}
                      >
                        <Power className={`h-4 w-4 ${m.active ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMerchantToDelete(m)}
                        className="h-8 w-8 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Eliminar canal"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  {/* SUPERADMIN-only inline editor for Avoqado's platform fee
                      (application_fee on Stripe Connect). OWNERs should never
                      see/edit their own commission. */}
                  {isSuperadmin && m.provider?.code === 'STRIPE_CONNECT' && (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                        <span className="font-medium">Comisión Avoqado:</span>
                        {feeEditingId === m.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              inputMode="decimal"
                              value={feeDraft}
                              onChange={e => setFeeDraft(e.target.value)}
                              placeholder="100"
                              className="h-7 w-20 text-xs"
                              autoFocus
                            />
                            <span className="text-muted-foreground">bps (100 = 1%)</span>
                          </div>
                        ) : (
                          <span className="font-mono">{formatBps(m.platformFeeBps)}</span>
                        )}
                      </div>
                      {feeEditingId === m.id ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => setFeeEditingId(null)}
                            disabled={platformFeeMutation.isPending}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 px-3"
                            onClick={() => {
                              const parsed = parseInt(feeDraft, 10)
                              if (!Number.isFinite(parsed)) return
                              platformFeeMutation.mutate({ merchantId: m.id, bps: parsed })
                            }}
                            disabled={platformFeeMutation.isPending || !feeDraft.trim()}
                          >
                            {platformFeeMutation.isPending ? 'Guardando...' : 'Guardar'}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-amber-700 dark:text-amber-300"
                          onClick={() => {
                            setFeeEditingId(m.id)
                            setFeeDraft(String(m.platformFeeBps ?? 100))
                          }}
                        >
                          Editar
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <EcommerceMerchantWizard
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false)
          setWizardMerchant(null)
        }}
        venueId={venueId}
        merchant={wizardMerchant}
      />

      {/* Delete confirmation. Strong warning when the merchant has an active
          Stripe Connect account — deleting the local record does NOT close
          the Stripe Connect account itself (admins do that from /superadmin
          via the offboarding endpoint). */}
      <AlertDialog open={!!merchantToDelete} onOpenChange={open => !open && setMerchantToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar canal de e-commerce?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Vas a eliminar el canal <span className="font-semibold text-foreground">{merchantToDelete?.channelName}</span>. Esto
                  borra las API keys, sesiones de checkout y la configuración local.
                </p>
                {merchantToDelete?.provider?.code === 'STRIPE_CONNECT' && merchantToDelete?.chargesEnabled && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      <strong>Stripe Connect activo.</strong> Tu cuenta de Stripe Connect <em>NO</em> se cierra automáticamente — pídele
                      a soporte que la archive si ya no la usarás.
                    </AlertDescription>
                  </Alert>
                )}
                <p className="text-sm text-muted-foreground">Esta acción no se puede deshacer.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => merchantToDelete && deleteMutation.mutate(merchantToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
