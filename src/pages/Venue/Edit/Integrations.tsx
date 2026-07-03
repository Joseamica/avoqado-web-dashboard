import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, ArrowRight, Bitcoin, CheckCircle2, Globe, Landmark, Link2, MessageCircle, Plus, Power, ShoppingCart, Sparkles, Trash2, Unlink } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { useToast } from '@/hooks/use-toast'
import { useAccess } from '@/hooks/use-access'
import { CryptoConfigSection } from '@/pages/Settings/components/CryptoConfigSection'
import { PosType } from '@/types'
import api from '@/api'
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
import { McpConnectGuide } from '@/components/mcp/McpConnectGuide'
import { IntegrationCard } from './components/IntegrationCard'
import { PermissionGate } from '@/components/PermissionGate'
import { financialConnectionAPI } from '@/services/financialConnection.service'
import { getVenueChatStatus } from '@/services/venueChat.service'
import VenueChat from './VenueChat'

interface VenueIntegrations {
  id: string
  name: string
  posType: PosType | null
  posStatus: string
}

export default function VenueIntegrations() {
  const { t } = useTranslation('venue')
  const { venueId, fullBasePath } = useCurrentVenue()
  const { user } = useAuth()
  const { can } = useAccess()
  const navigate = useNavigate()
  // Crypto config requires venue-crypto:manage permission, which only OWNER+
  // has. Skipping the render for ADMIN/MANAGER eliminates noisy 403 warnings
  // from the API call inside CryptoConfigSection.
  const canManageCrypto = user?.role === StaffRole.OWNER || user?.role === StaffRole.SUPERADMIN
  const canManageBanks = can('financialConnections:manage')

  // Each integration manages itself in its own FullScreenModal — the page is
  // a catalog of cards, not a wall of inline management UIs.
  const [mcpOpen, setMcpOpen] = useState(false)
  const [whatsappOpen, setWhatsappOpen] = useState(false)
  const [ecommerceOpen, setEcommerceOpen] = useState(false)
  const [cryptoOpen, setCryptoOpen] = useState(false)

  // Mercado Pago's OAuth callback redirects back to this page with ?mp_status=…
  // The success/error banner renders inside EcommercePaymentsSection (now in a
  // modal), so auto-open the modal when returning from OAuth.
  const [searchParams] = useSearchParams()
  const hasMpReturn = searchParams.get('mp_status') != null
  useEffect(() => {
    if (hasMpReturn) setEcommerceOpen(true)
  }, [hasMpReturn])

  // Status queries for the card footers. These share queryKeys with the
  // management components inside the modals, so the cache is reused.
  const { data: merchants = [] } = useQuery({
    queryKey: ['ecommerce-merchants', venueId],
    queryFn: () => ecommerceMerchantAPI.listByVenue(venueId!),
    enabled: !!venueId,
  })
  const { data: bankConnections = [] } = useQuery({
    queryKey: ['financial-connections', venueId],
    queryFn: () => financialConnectionAPI.listConnections(venueId!),
    enabled: !!venueId && canManageBanks,
  })
  const { data: chatStatus } = useQuery({
    queryKey: ['venue', venueId, 'chat-status'],
    queryFn: () => getVenueChatStatus(venueId!),
    enabled: !!venueId,
  })

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

  const statusLabel = (connected: boolean) => ({
    connected,
    label: connected ? t('edit.integrations.catalog.status.connected') : t('edit.integrations.catalog.status.available'),
  })
  const ctaLabel = (connected: boolean) =>
    connected ? t('edit.integrations.catalog.manage') : t('edit.integrations.catalog.connect')

  const googleConnected = !!googleStatus?.connected
  const whatsappConnected = !!chatStatus?.mode && chatStatus.mode !== 'DISABLED'
  const ecommerceConnected = merchants.length > 0
  const banksConnected = bankConnections.some(c => c.status === 'CONNECTED')

  return (
    <div className="container mx-auto pt-6 pb-20 px-3 md:px-4 space-y-6" data-tour="settings-integrations-page">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t('edit.integrations.title')}</h2>
        <p className="text-muted-foreground mt-2">{t('edit.integrations.subtitle')}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {/* Avoqado MCP — featured first */}
        <IntegrationCard
          icon={Sparkles}
          title={t('edit.integrations.mcp.title')}
          description={t('edit.integrations.mcp.description')}
          badge={t('edit.integrations.mcp.badge')}
          actionLabel={t('edit.integrations.catalog.viewGuide')}
          onAction={() => setMcpOpen(true)}
          dataTour="integration-card-mcp"
        />

        {/* Google Business Profile — manages itself on its own subpage */}
        <IntegrationCard
          icon={Globe}
          title={t('edit.integrations.google.title', { defaultValue: 'Google Business Profile' })}
          description={t('edit.integrations.google.description')}
          status={statusLabel(googleConnected)}
          actionLabel={ctaLabel(googleConnected)}
          actionVariant={googleConnected ? 'outline' : 'default'}
          onAction={() => navigate('google')}
          dataTour="integration-card-google"
        />

        {/* WhatsApp — chat con clientes (activación por QR, ex tab de Información del local) */}
        <IntegrationCard
          icon={MessageCircle}
          title={t('edit.integrations.catalog.whatsapp.title')}
          description={t('edit.integrations.catalog.whatsapp.description')}
          status={statusLabel(whatsappConnected)}
          actionLabel={ctaLabel(whatsappConnected)}
          actionVariant={whatsappConnected ? 'outline' : 'default'}
          onAction={() => setWhatsappOpen(true)}
          dataTour="integration-card-whatsapp"
        />

        {/* E-commerce / Pagos online (Stripe Connect, Mercado Pago, …) */}
        <IntegrationCard
          icon={ShoppingCart}
          title={t('edit.integrations.catalog.ecommerce.title')}
          description={t('edit.integrations.catalog.ecommerce.description')}
          status={statusLabel(ecommerceConnected)}
          actionLabel={ctaLabel(ecommerceConnected)}
          actionVariant={ecommerceConnected ? 'outline' : 'default'}
          onAction={() => setEcommerceOpen(true)}
          dataTour="integration-card-ecommerce"
        />

        {/* Cuentas de banco — OWNER (financialConnections:manage). La gestión vive ahora en el hub
            "Bancos" (sidebar); esta tarjeta solo redirige allá (una sola fuente de verdad). */}
        <PermissionGate permission="financialConnections:manage">
          <IntegrationCard
            icon={Landmark}
            title={t('edit.integrations.catalog.banks.title')}
            description={t('edit.integrations.catalog.banks.description')}
            status={statusLabel(banksConnected)}
            actionLabel={ctaLabel(banksConnected)}
            actionVariant={banksConnected ? 'outline' : 'default'}
            onAction={() => navigate(`${fullBasePath}/bancos`)}
            dataTour="integration-card-banks"
          />
        </PermissionGate>

        {/* Crypto — OWNER+ only. No status dot: connection state isn't known
            at page level and an invented one would lie. */}
        {canManageCrypto && (
          <IntegrationCard
            icon={Bitcoin}
            title={t('edit.integrations.catalog.crypto.title')}
            description={t('edit.integrations.catalog.crypto.description')}
            actionLabel={t('edit.integrations.catalog.manage')}
            onAction={() => setCryptoOpen(true)}
            dataTour="integration-card-crypto"
          />
        )}
      </div>

      {/* ── Management surfaces ── */}

      <FullScreenModal open={mcpOpen} onClose={() => setMcpOpen(false)} title={t('edit.integrations.mcp.title')} contentClassName="bg-muted/30">
        <div className="container mx-auto max-w-3xl p-4 md:p-6">
          <McpConnectGuide />
        </div>
      </FullScreenModal>

      <FullScreenModal
        open={whatsappOpen}
        onClose={() => setWhatsappOpen(false)}
        title={t('edit.integrations.catalog.whatsapp.title')}
        contentClassName="bg-muted/30"
      >
        <div className="container mx-auto max-w-3xl p-4 md:p-6">
          <VenueChat />
        </div>
      </FullScreenModal>

      <FullScreenModal
        open={ecommerceOpen}
        onClose={() => setEcommerceOpen(false)}
        title={t('edit.integrations.catalog.ecommerce.title')}
        contentClassName="bg-muted/30"
      >
        <div className="container mx-auto max-w-3xl p-4 md:p-6">
          <EcommercePaymentsSection venueId={venueId!} />
        </div>
      </FullScreenModal>

      {canManageCrypto && (
        <FullScreenModal
          open={cryptoOpen}
          onClose={() => setCryptoOpen(false)}
          title={t('edit.integrations.catalog.crypto.title')}
          contentClassName="bg-muted/30"
        >
          <div className="container mx-auto max-w-3xl p-4 md:p-6">
            <CryptoConfigSection />
          </div>
        </FullScreenModal>
      )}
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

  // Mercado Pago OAuth return handling. The backend `/callback` endpoint
  // redirects here with `?mp_status=connected&ecommerceMerchantId=…` on success
  // or `?mp_status=error&reason=…[&description=…]` on failure.
  const [searchParams, setSearchParams] = useSearchParams()
  const mpStatus = searchParams.get('mp_status')
  const mpReason = searchParams.get('reason')
  const mpDescription = searchParams.get('description')
  const mpMerchantId = searchParams.get('ecommerceMerchantId')

  useEffect(() => {
    if (!mpStatus) return
    if (mpStatus === 'connected') {
      queryClient.invalidateQueries({ queryKey: ['ecommerce-merchants', venueId] })
    }
    // Clear params after a short delay so the banner has a chance to display
    // before the URL becomes shareable.
    const timeout = setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      next.delete('mp_status')
      next.delete('reason')
      next.delete('description')
      next.delete('ecommerceMerchantId')
      setSearchParams(next, { replace: true })
    }, 4000)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mpStatus])

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

  /**
   * Mercado Pago — disconnect just wipes the OAuth tokens from the merchant
   * row; the EcommerceMerchant itself stays so the operator can reconnect
   * later (or rotate the seller account). For "is this merchant connected?"
   * we trust `providerMerchantId` — it's only populated after OAuth completes.
   */
  const isMpConnected = (m: EcommerceMerchant): boolean =>
    m.provider?.code === 'MERCADO_PAGO' && !!m.providerMerchantId

  const handleConnectMercadoPago = (m: EcommerceMerchant) => {
    const url = ecommerceMerchantAPI.getMercadoPagoConnectUrl(venueId, m.id)
    window.location.assign(url)
  }

  const disconnectMercadoPagoMutation = useMutation({
    mutationFn: async (m: EcommerceMerchant) => {
      await ecommerceMerchantAPI.disconnectMercadoPago(venueId, m.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ecommerce-merchants', venueId] })
      toast({
        title: 'Mercado Pago desconectado',
        description: 'Los tokens del vendedor se borraron. Puedes reconectar cuando quieras.',
      })
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Error al desconectar',
        description: err?.response?.data?.error || err?.message || 'Intenta de nuevo.',
      })
    },
  })

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

  // Read global VAT rate so we can show effective fee (1% + IVA) inline,
  // matching the Superadmin global view.
  const { data: platformSettings } = useQuery<{ vatRateBps: number }>({
    queryKey: ['platform-settings', 'vat'],
    queryFn: async () => {
      const res = await import('@/api').then(m => m.default.get('/api/v1/dashboard/superadmin/platform-settings'))
      return res.data.data
    },
    enabled: isSuperadmin,
    staleTime: 5 * 60_000, // 5 min — VAT changes are exceedingly rare
  })
  const vatRateBps = platformSettings?.vatRateBps ?? 1600
  const formatEffective = (feeBps?: number) => {
    if (typeof feeBps !== 'number') return '—'
    const effective = (feeBps * (10000 + vatRateBps)) / 10000 / 100
    return `${effective.toFixed(2)}%`
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
      {mpStatus === 'connected' && (
        <Alert className="mb-4 border-emerald-500/40 bg-emerald-500/5">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <AlertTitle className="text-emerald-700 dark:text-emerald-300">Mercado Pago conectado</AlertTitle>
          <AlertDescription className="text-emerald-700 dark:text-emerald-300">
            {mpMerchantId && merchants.find(m => m.id === mpMerchantId)
              ? `Canal "${merchants.find(m => m.id === mpMerchantId)?.channelName}" listo para cobrar.`
              : 'El canal quedó listo para cobrar.'}
          </AlertDescription>
        </Alert>
      )}
      {mpStatus === 'error' && (
        <Alert className="mb-4 border-red-500/40 bg-red-500/5">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <AlertTitle className="text-red-700 dark:text-red-300">Error al conectar Mercado Pago</AlertTitle>
          <AlertDescription className="text-red-700 dark:text-red-300">
            {mpReason && <span>{mpReason}.</span>}
            {mpDescription && <span className="block opacity-80 text-xs mt-1">{mpDescription}</span>}
            <span className="block mt-1">Vuelve a intentarlo o contacta a soporte.</span>
          </AlertDescription>
        </Alert>
      )}
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
                    {m.provider?.code === 'MERCADO_PAGO' &&
                      (isMpConnected(m) ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => disconnectMercadoPagoMutation.mutate(m)}
                          disabled={disconnectMercadoPagoMutation.isPending}
                          className="h-8 w-8 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="Desconectar Mercado Pago (mantiene el canal, borra tokens)"
                        >
                          <Unlink className="h-4 w-4 text-red-600" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleConnectMercadoPago(m)}
                          className="h-8 w-8 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="Conectar Mercado Pago"
                        >
                          <Link2 className="h-4 w-4 text-blue-600" />
                        </Button>
                      ))}
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
                          <span className="font-mono">
                            {formatBps(m.platformFeeBps)} + IVA = <strong>{formatEffective(m.platformFeeBps)}</strong>
                          </span>
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
