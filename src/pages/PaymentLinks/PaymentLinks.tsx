import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import {
  AlertTriangle,
  ArrowUpDown,
  Banknote,
  Copy,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import DataTable from '@/components/data-table'
import { FilterPill, CheckboxFilterContent } from '@/components/filters'
import { PermissionGate } from '@/components/PermissionGate'
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/useDebounce'
import { useVenueDateTime } from '@/utils/datetime'
import { ecommerceMerchantAPI } from '@/services/ecommerceMerchant.service'
import { EcommerceMerchantWizard } from '@/pages/Venue/components/EcommerceMerchantWizard'
import paymentLinkService, { type PaymentLink, type PaymentLinkView } from '@/services/paymentLink.service'
import { getIntlLocale } from '@/utils/i18n-locale'

import { StatusFilterTabs, type StatusTab } from '@/components/StatusFilterTabs'
import { SummaryCards, type SummaryCardItem } from '@/components/SummaryCards'
import CreatePaymentLinkDialog from './CreatePaymentLinkDialog'
import { PaymentLinkDiscountStatus } from './PaymentLinkDiscountStatus'
import { PaymentLinkDetailSheet } from './PaymentLinkDetailSheet'
import { etiquetaDelEstado, varianteDelEstado } from './paymentLinkStatus'
import { SharePaymentLinkDialog } from './SharePaymentLinkDialog'

const CHECKOUT_BASE_URL = import.meta.env.VITE_CHECKOUT_URL || 'https://pay.avoqado.io'

export default function PaymentLinks() {
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { t, i18n } = useTranslation('paymentLinks')
  const { t: tCommon } = useTranslation()
  const { formatDate, formatDateTime } = useVenueDateTime()
  const { can } = useAccess()

  // ─── State ───────────────────────────────────────────────
  const [activeStatusTab, setActiveStatusTab] = useState('all')
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [archivingLink, setArchivingLink] = useState<PaymentLink | null>(null)
  const [detailLink, setDetailLink] = useState<PaymentLink | null>(null)
  // Quitar el descuento cambia el precio de una liga que ya se compartió: se confirma antes.
  const [removingDiscountLink, setRemovingDiscountLink] = useState<PaymentLink | null>(null)

  // FullScreenModal state
  const [showForm, setShowForm] = useState(false)
  const [editingLinkId, setEditingLinkId] = useState<string | undefined>()
  const [dialogKey, setDialogKey] = useState(0)

  // Auto-open create modal when navigated here with ?new=1 (e.g. from the
  // sidebar "Aceptar pago" → "Enviar liga de pago" shortcut). Strip the param
  // immediately so a refresh doesn't re-trigger, and defer opening until the
  // ecommerce-merchant gate below resolves.
  const location = useLocation()
  const navigate = useNavigate()
  const [autoOpenPending, setAutoOpenPending] = useState(false)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('new') !== '1') return
    setAutoOpenPending(true)
    params.delete('new')
    const nextSearch = params.toString()
    navigate(
      { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '', hash: location.hash },
      { replace: true },
    )
  }, [location.search, location.pathname, location.hash, navigate])

  // ─── Data ────────────────────────────────────────────────
  // El servidor pagina, filtra por pestaña y cuenta: antes llegaban sólo 20 ligas y aquí se filtraban y contaban esas 20.
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 })
  // Cambiar de pestaña, de estados o de búsqueda vuelve a la primera página (la 3 de «Todas» puede no existir en «Pagadas»).
  const irAPrimeraPagina = () => setPagination(p => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }))
  useEffect(() => {
    setPagination(p => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }))
  }, [debouncedSearch])
  const cambiarPestana = (tab: string) => {
    setActiveStatusTab(tab)
    irAPrimeraPagina()
  }
  const cambiarEstados = (estados: string[]) => {
    setStatusFilter(estados)
    irAPrimeraPagina()
  }

  const { data: page, isLoading } = useQuery({
    queryKey: ['payment-links', venueId, activeStatusTab, statusFilter, debouncedSearch, pagination.pageIndex, pagination.pageSize],
    queryFn: () =>
      paymentLinkService.getPaymentLinks(venueId, {
        view: activeStatusTab as PaymentLinkView,
        statuses: statusFilter.length ? statusFilter : undefined,
        search: debouncedSearch || undefined,
        limit: pagination.pageSize,
        offset: pagination.pageIndex * pagination.pageSize,
      }),
    // Al pasar de página se queda la anterior a la vista mientras llega la nueva (sin parpadeo a «vacío»).
    placeholderData: keepPreviousData,
  })
  const links = useMemo(() => page?.paymentLinks ?? [], [page])
  const total = page?.total ?? 0
  // Si se archiva la última liga de la última página, esa página deja de existir: se regresa a la última que sí tiene.
  const ultimaPagina = Math.max(0, Math.ceil(total / pagination.pageSize) - 1)
  useEffect(() => {
    if (page && pagination.pageIndex > ultimaPagina) setPagination(p => ({ ...p, pageIndex: ultimaPagina }))
  }, [page, pagination.pageIndex, ultimaPagina])

  const {
    data: ecommerceMerchants = [],
    isLoading: isLoadingEcommerceMerchants,
    isSuccess: isEcommerceCheckSuccess,
  } = useQuery({
    queryKey: ['ecommerce-merchants', venueId, 'chargeable-for-payment-links'],
    // limit 20 (no 1): hay que MIRAR todos los canales para saber si alguno puede
    // cobrar — con limit 1 un canal a medio activar tapaba a otro que si servia.
    queryFn: () => ecommerceMerchantAPI.listByVenue(venueId, { limit: 20 }),
    enabled: !!venueId,
  })

  // 🔴 El backend no pide que EXISTA un canal, pide que pueda COBRAR
  // (`isEcommerceMerchantChargeable`: chargesEnabled, o accessToken si es Blumon).
  // Comprobar solo `length === 0` dejaba pasar el estado mas comun de Stripe Connect
  // —cuenta creada, onboarding sin terminar, `chargesEnabled: false`— y el comerciante
  // llenaba el formulario entero para estrellarse con un 400 al guardar.
  // Blumon se exime aqui porque su credencial no viaja al navegador (ni debe).
  const puedeCobrar = (m: (typeof ecommerceMerchants)[number]) =>
    m.active !== false && (m.chargesEnabled === true || m.onboardingStatus === 'COMPLETED' || m.provider?.code === 'BLUMON')

  const isEcommerceExplicitlyMissing = isEcommerceCheckSuccess && !ecommerceMerchants.some(puedeCobrar)
  const [setupWizardOpen, setSetupWizardOpen] = useState(false)

  // Contadores de las pestañas: los da el servidor (una liga de un solo uso ya cobrada sigue ACTIVE en la base y cuenta
  // como «Usada», no como «Activa»). Mientras llega la primera respuesta no se pinta número.
  const counts = page?.counts
  const plStatusTabs = useMemo<StatusTab[]>(() => [
    { value: 'all', label: t('statusTabs.all'), count: counts?.all },
    { value: 'active', label: t('statusTabs.active'), count: counts?.active },
    { value: 'used', label: t('statusTabs.used'), count: counts?.used },
    { value: 'paused', label: t('statusTabs.paused'), count: counts?.paused },
    { value: 'expired', label: t('statusTabs.expired'), count: counts?.expired },
  ], [t, counts])

  // Tarjetas: totales de la pestaña y filtros completos (del servidor), no de la página que se ve.
  const plSummaryCards = useMemo<SummaryCardItem[]>(() => {
    const totalCollected = page?.summary?.totalCollected ?? 0
    const usageRate = total > 0 ? ((page?.summary?.paidLinks ?? 0) / total) * 100 : 0
    return [
      { label: t('summaryCards.links'), value: total, format: 'number' as const },
      { label: t('summaryCards.collected'), value: totalCollected, format: 'currency' as const },
      { label: t('summaryCards.usageRate'), value: usageRate, format: 'percent' as const },
    ]
  }, [page, total, t])

  const archiveMutation = useMutation({
    mutationFn: (linkId: string) => paymentLinkService.archivePaymentLink(venueId, linkId),
    onSuccess: () => {
      toast({ title: t('toasts.archived') })
      queryClient.invalidateQueries({ queryKey: ['payment-links', venueId] })
      setArchivingLink(null)
    },
    onError: (error: any) => {
      toast({
        title: tCommon('error'),
        description: error.response?.data?.message || error.response?.data?.error || t('toasts.error'),
        variant: 'destructive',
      })
    },
  })

  // Quitar un descuento no pide `discounts:apply`: sólo `payment-link:update`.
  // Un doble clic llega antes de que `isPending` se pinte: el ref frena el segundo en el mismo instante.
  const removingDiscount = useRef(false)
  const removeDiscountMutation = useMutation({
    mutationFn: (linkId: string) => paymentLinkService.updatePaymentLink(venueId, linkId, { discount: null }),
    onSettled: () => {
      removingDiscount.current = false
    },
    onSuccess: () => {
      toast({ title: t('discountStatus.removed') })
      queryClient.invalidateQueries({ queryKey: ['payment-links', venueId] })
    },
    onError: (error: any) => {
      toast({
        title: tCommon('error'),
        description: error.response?.data?.message || error.response?.data?.error || t('toasts.error'),
        variant: 'destructive',
      })
    },
  })

  const toggleStatusMutation = useMutation({
    mutationFn: ({ linkId, status }: { linkId: string; status: 'ACTIVE' | 'PAUSED' }) =>
      paymentLinkService.updatePaymentLink(venueId, linkId, { status }),
    onSuccess: (_, variables) => {
      toast({ title: variables.status === 'ACTIVE' ? t('toasts.resumed') : t('toasts.paused') })
      queryClient.invalidateQueries({ queryKey: ['payment-links', venueId] })
    },
    onError: (error: any) => {
      toast({
        title: tCommon('error'),
        description: error.response?.data?.message || error.response?.data?.error || t('toasts.error'),
        variant: 'destructive',
      })
    },
  })

  // ─── Helpers ─────────────────────────────────────────────
  const formatPrice = useCallback(
    (price: number, currency: string) => new Intl.NumberFormat(getIntlLocale(i18n.language), { style: 'currency', currency }).format(price),
    [i18n.language],
  )

  const statusOptions = useMemo(
    () => [
      { value: 'ACTIVE', label: t('status.active') },
      { value: 'PAUSED', label: t('status.paused') },
      { value: 'EXPIRED', label: t('status.expired') },
    ],
    [t],
  )

  const statusLabels = useMemo(
    () => ({
      ACTIVE: t('status.active'),
      PAUSED: t('status.paused'),
      EXPIRED: t('status.expired'),
      ARCHIVED: t('status.archived'),
    }),
    [t],
  )

  const getFilterDisplayLabel = useCallback((values: string[], label: string, labels: Record<string, string>): string => {
    if (values.length === 0) return label
    if (values.length === 1) return `${label}: ${labels[values[0]] || values[0]}`
    return `${label}: ${values.length}`
  }, [])

  const handleCopyLink = useCallback(
    async (shortCode: string) => {
      const url = `${CHECKOUT_BASE_URL}/${shortCode}`
      try {
        await navigator.clipboard.writeText(url)
        toast({ title: t('share.copied') })
      } catch {
        // Fallback — ignore
      }
    },
    [t, toast],
  )

  // WhatsApp share — opens a dialog where the operator enters the customer's
  // phone, picks a country, and sends the link through Avoqado's approved
  // Meta template (`payment_link_share`). The previous `wa.me` URL is still
  // available as a fallback for operators who'd rather send from their own
  // WhatsApp (toggle on the dialog).
  const [waShareOpen, setWaShareOpen] = useState(false)
  const [waShareLink, setWaShareLink] = useState<PaymentLink | null>(null)
  const handleWhatsApp = useCallback((link: PaymentLink) => {
    setWaShareLink(link)
    setWaShareOpen(true)
  }, [])

  const openCreate = useCallback(() => {
    if (isEcommerceExplicitlyMissing) {
      toast({
        title: tCommon('error'),
        description: t('requirements.createBlocked'),
        variant: 'destructive',
      })
      return
    }
    setEditingLinkId(undefined)
    setDialogKey(prev => prev + 1)
    setShowForm(true)
  }, [isEcommerceExplicitlyMissing, t, tCommon, toast])

  // Consume the deferred ?new=1 trigger once the ecommerce-merchant gate has
  // resolved, so we either open the modal or surface the requirements toast —
  // never open a modal the user can't actually submit.
  useEffect(() => {
    if (!autoOpenPending || isLoadingEcommerceMerchants) return
    setAutoOpenPending(false)
    openCreate()
  }, [autoOpenPending, isLoadingEcommerceMerchants, openCreate])

  const openEdit = (linkId: string) => {
    setEditingLinkId(linkId)
    setShowForm(true)
  }

  // ─── Columns ─────────────────────────────────────────────
  const columns: ColumnDef<PaymentLink>[] = useMemo(
    () => [
      {
        accessorKey: 'title',
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            {t('list.columns.title')}
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: ({ row }) => {
          const PurposeIcon = row.original.purpose === 'ITEM' ? Tag : row.original.purpose === 'DONATION' ? Heart : Banknote
          return (
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted shrink-0">
                <PurposeIcon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <div>
                <div className="font-medium">{row.original.title}</div>
                {row.original.description && (
                  <div className="text-sm text-muted-foreground truncate max-w-[200px]">{row.original.description}</div>
                )}
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'amount',
        header: t('list.columns.amount'),
        cell: ({ row }) => (
          <div className="flex flex-col items-start" onClick={e => e.stopPropagation()}>
            {row.original.amountType === 'FIXED' && row.original.amount ? (
              <span className="font-medium">{formatPrice(row.original.amount, row.original.currency)}</span>
            ) : (
              <span className="text-sm text-muted-foreground">{t('list.openAmount')}</span>
            )}
            <PaymentLinkDiscountStatus
              link={row.original}
              canUpdate={can('payment-link:update')}
              onRemove={() => setRemovingDiscountLink(row.original)}
              onReplace={() => openEdit(row.original.id)}
              onArchive={() => setArchivingLink(row.original)}
            />
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: t('list.columns.status'),
        // Una de un solo uso ya cobrada sigue ACTIVE en la base pero el checkout la rechaza: se ve «Pagada», no «Activa».
        cell: ({ row }) => <Badge variant={varianteDelEstado(row.original)}>{t(etiquetaDelEstado(row.original))}</Badge>,
      },
      {
        accessorKey: 'paymentCount',
        header: t('list.columns.payments'),
        cell: ({ row }) => <span className="text-sm">{row.original.paymentCount}</span>,
      },
      {
        accessorKey: 'totalCollected',
        header: t('list.columns.totalCollected'),
        cell: ({ row }) => <span className="text-sm font-medium">{formatPrice(row.original.totalCollected, row.original.currency)}</span>,
      },
      {
        // Cuándo se pagó (en la zona del venue). Se ve aunque la liga ya esté archivada; en una reutilizable es el último pago.
        accessorKey: 'lastPaidAt',
        header: t('list.columns.lastPaidAt'),
        cell: ({ row }) => {
          const { lastPaidAt, paymentCount } = row.original
          if (!lastPaidAt) return <span className="text-sm text-muted-foreground">—</span>
          return (
            <div className="flex flex-col">
              <span className="text-sm whitespace-nowrap">{formatDateTime(lastPaidAt)}</span>
              {paymentCount > 1 && (
                <span className="text-xs text-muted-foreground">{t('list.lastOfPayments', { count: paymentCount })}</span>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'createdAt',
        header: t('list.columns.createdAt'),
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div onClick={e => e.stopPropagation()} className="flex items-center gap-1">
            {/* Quick actions */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 cursor-pointer"
              onClick={() => handleCopyLink(row.original.shortCode)}
              title={t('share.copyLink')}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 cursor-pointer"
              onClick={() => handleWhatsApp(row.original)}
              title={t('share.whatsapp')}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>

            {/* More actions */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={5} className="w-48">
                <PermissionGate permission="payment-link:create">
                  <DropdownMenuItem onClick={() => openEdit(row.original.id)} className="cursor-pointer">
                    <Pencil className="h-4 w-4 mr-2" />
                    {t('actions.edit')}
                  </DropdownMenuItem>
                </PermissionGate>

                {row.original.status === 'ACTIVE' && (
                  <PermissionGate permission="payment-link:create">
                    <DropdownMenuItem
                      onClick={() => toggleStatusMutation.mutate({ linkId: row.original.id, status: 'PAUSED' })}
                      className="cursor-pointer"
                    >
                      <Pause className="h-4 w-4 mr-2" />
                      {t('actions.pause')}
                    </DropdownMenuItem>
                  </PermissionGate>
                )}

                {row.original.status === 'PAUSED' && (
                  <PermissionGate permission="payment-link:create">
                    <DropdownMenuItem
                      onClick={() => toggleStatusMutation.mutate({ linkId: row.original.id, status: 'ACTIVE' })}
                      className="cursor-pointer"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {t('actions.resume')}
                    </DropdownMenuItem>
                  </PermissionGate>
                )}

                <DropdownMenuSeparator />

                <PermissionGate permission="payment-link:create">
                  <DropdownMenuItem onClick={() => setArchivingLink(row.original)} className="text-destructive cursor-pointer">
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('actions.archive')}
                  </DropdownMenuItem>
                </PermissionGate>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [t, formatPrice, formatDate, formatDateTime, handleCopyLink, handleWhatsApp, toggleStatusMutation, can],
  )

  // ─── Render ──────────────────────────────────────────────
  return (
    <div className="p-4 bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>

        <PermissionGate permission="payment-link:create">
          <Button onClick={openCreate} className="cursor-pointer" disabled={isLoadingEcommerceMerchants || isEcommerceExplicitlyMissing}>
            <Plus className="h-4 w-4 mr-2" />
            {t('create')}
          </Button>
        </PermissionGate>
      </div>

      {/* Status Filter Tabs */}
      <StatusFilterTabs
        tabs={plStatusTabs}
        activeTab={activeStatusTab}
        onTabChange={cambiarPestana}
        className="mb-4"
      />

      {/* Summary Cards */}
      <SummaryCards cards={plSummaryCards} isLoading={isLoading} className="mb-4" />

      {isEcommerceExplicitlyMissing && (
        <Alert className="mb-4 border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100">
          <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
          <AlertTitle>{t('requirements.merchantMissingTitle')}</AlertTitle>
          <AlertDescription className="text-amber-800 dark:text-amber-200 space-y-3">
            <p>{t('emptyState.noEcommerce')}</p>
            <p>{t('requirements.createBlocked')}</p>
            <PermissionGate permission="payment-link:create">
              <Button size="sm" variant="default" onClick={() => setSetupWizardOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('requirements.setupStripe')}
              </Button>
            </PermissionGate>
          </AlertDescription>
        </Alert>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Expandable search */}
        <div className="relative">
          {isSearchOpen ? (
            <div className="flex items-center animate-in fade-in slide-in-from-left-2 duration-200">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder={t('list.search')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-8 h-9 w-64 rounded-full"
                autoFocus
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-0 h-9 w-9 p-0 cursor-pointer"
                onClick={() => {
                  setSearchTerm('')
                  setIsSearchOpen(false)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="h-9 rounded-full cursor-pointer" onClick={() => setIsSearchOpen(true)}>
              <Search className="h-4 w-4 mr-2" />
              {t('list.search')}
            </Button>
          )}
        </div>

        {/* Status filter */}
        <FilterPill
          label={getFilterDisplayLabel(statusFilter, t('status.label'), statusLabels)}
          isActive={statusFilter.length > 0}
          onClear={() => cambiarEstados([])}
        >
          <CheckboxFilterContent
            title={t('status.label')}
            options={statusOptions}
            selectedValues={statusFilter}
            onApply={cambiarEstados}
          />
        </FilterPill>
      </div>

      {/* Table */}
      <div data-tour="payment-links-table">
        <DataTable
          columns={columns}
          data={links}
          rowCount={total}
          pagination={pagination}
          setPagination={setPagination}
          isLoading={isLoading}
          onRowClick={(row: PaymentLink) => setDetailLink(row)}
          tableId="payment-links:list"
        />
      </div>

      {/* Archive confirm dialog */}
      <AlertDialog open={!!archivingLink} onOpenChange={open => !open && setArchivingLink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirm.archiveTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('confirm.archiveDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">{t('confirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => archivingLink && archiveMutation.mutate(archivingLink.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
            >
              {t('confirm.archiveConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quitar descuento: confirmación */}
      <AlertDialog open={!!removingDiscountLink} onOpenChange={open => !open && setRemovingDiscountLink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirm.removeDiscountTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('confirm.removeDiscountDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">{t('confirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!removingDiscountLink || removingDiscount.current) return
                removingDiscount.current = true
                removeDiscountMutation.mutate(removingDiscountLink.id)
              }}
              disabled={removeDiscountMutation.isPending}
              className="cursor-pointer"
            >
              {t('confirm.removeDiscountConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create/Edit modal */}
      <CreatePaymentLinkDialog
        key={editingLinkId || `new-${dialogKey}`}
        open={showForm}
        onClose={() => {
          setShowForm(false)
          setEditingLinkId(undefined)
        }}
        editingLinkId={editingLinkId}
      />

      {/* Stripe Connect setup wizard — opened from the "Configurar Stripe ahora"
          CTA in the empty-state alert. After the user completes onboarding on
          Stripe, they return to settings/integrations (the wizard's redirect),
          so we just need to invalidate the ecommerce-merchants query when the
          modal closes. */}
      <EcommerceMerchantWizard
        open={setupWizardOpen}
        onClose={() => {
          setSetupWizardOpen(false)
          queryClient.invalidateQueries({ queryKey: ['ecommerce-merchants', venueId, 'active-for-payment-links'] })
        }}
        venueId={venueId}
        merchant={null}
      />

      {/* WhatsApp share dialog — replaces the previous wa.me window.open so
          the operator can send the link directly through Avoqado's approved
          Meta template, with a manual wa.me fallback inside the dialog. */}
      <SharePaymentLinkDialog
        open={waShareOpen}
        onOpenChange={open => {
          setWaShareOpen(open)
          if (!open) setWaShareLink(null)
        }}
        link={waShareLink}
        venueId={venueId}
        checkoutBaseUrl={CHECKOUT_BASE_URL}
      />

      {/* Al picar una liga se ve su estado y sus pagos con «Ver recibo»; editar queda dentro del detalle y en «…». */}
      {detailLink && (
        <PaymentLinkDetailSheet
          link={detailLink}
          open={!!detailLink}
          onOpenChange={open => !open && setDetailLink(null)}
          onEdit={linkId => {
            setDetailLink(null)
            openEdit(linkId)
          }}
          onCopy={handleCopyLink}
        />
      )}
    </div>
  )
}
