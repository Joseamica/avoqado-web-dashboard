import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

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
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/useDebounce'
import { useVenueDateTime } from '@/utils/datetime'
import { ecommerceMerchantAPI } from '@/services/ecommerceMerchant.service'
import paymentLinkService, { type PaymentLink } from '@/services/paymentLink.service'
import { getIntlLocale } from '@/utils/i18n-locale'

import CreatePaymentLinkDialog from './CreatePaymentLinkDialog'

const CHECKOUT_BASE_URL = import.meta.env.VITE_CHECKOUT_URL || 'https://pay.avoqado.io'

export default function PaymentLinks() {
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { t, i18n } = useTranslation('paymentLinks')
  const { t: tCommon } = useTranslation()
  const { formatDate } = useVenueDateTime()

  // ─── State ───────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [archivingLink, setArchivingLink] = useState<PaymentLink | null>(null)

  // FullScreenModal state
  const [showForm, setShowForm] = useState(false)
  const [editingLinkId, setEditingLinkId] = useState<string | undefined>()
  const [dialogKey, setDialogKey] = useState(0)

  // ─── Data ────────────────────────────────────────────────
  const { data: allLinks = [], isLoading } = useQuery({
    queryKey: ['payment-links', venueId, statusFilter, debouncedSearch],
    queryFn: () =>
      paymentLinkService.getPaymentLinks(venueId, {
        status: statusFilter.length === 1 ? statusFilter[0] : undefined,
        search: debouncedSearch || undefined,
      }),
  })

  const {
    data: ecommerceMerchants = [],
    isLoading: isLoadingEcommerceMerchants,
    isSuccess: isEcommerceCheckSuccess,
  } = useQuery({
    queryKey: ['ecommerce-merchants', venueId, 'active-for-payment-links'],
    queryFn: () => ecommerceMerchantAPI.listByVenue(venueId, { limit: 1 }),
    enabled: !!venueId,
  })

  const isEcommerceExplicitlyMissing = isEcommerceCheckSuccess && ecommerceMerchants.length === 0

  const links = useMemo(() => {
    let result = allLinks
    // Client-side multi-status filter (API supports single status)
    if (statusFilter.length > 1) {
      result = result.filter(l => statusFilter.includes(l.status))
    }
    return result
  }, [allLinks, statusFilter])

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

  const statusBadgeVariant = useCallback((status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'default' as const
      case 'PAUSED':
        return 'secondary' as const
      case 'EXPIRED':
        return 'outline' as const
      case 'ARCHIVED':
        return 'outline' as const
      default:
        return 'outline' as const
    }
  }, [])

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

  const handleWhatsApp = useCallback(
    (shortCode: string, title: string) => {
      const url = `${CHECKOUT_BASE_URL}/${shortCode}`
      const message = t('share.whatsappMessage', { title, url })
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
    },
    [t],
  )

  const openCreate = () => {
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
  }

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
        cell: ({ row }) =>
          row.original.amountType === 'FIXED' && row.original.amount ? (
            <span className="font-medium">{formatPrice(row.original.amount, row.original.currency)}</span>
          ) : (
            <span className="text-sm text-muted-foreground">{t('list.openAmount')}</span>
          ),
      },
      {
        accessorKey: 'status',
        header: t('list.columns.status'),
        cell: ({ row }) => (
          <Badge variant={statusBadgeVariant(row.original.status)}>{statusLabels[row.original.status] || row.original.status}</Badge>
        ),
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
              onClick={() => handleWhatsApp(row.original.shortCode, row.original.title)}
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
    [t, formatPrice, formatDate, statusBadgeVariant, statusLabels, handleCopyLink, handleWhatsApp, toggleStatusMutation],
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

      {isEcommerceExplicitlyMissing && (
        <Alert className="mb-4 border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100">
          <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
          <AlertTitle>{t('requirements.merchantMissingTitle')}</AlertTitle>
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <p>{t('emptyState.noEcommerce')}</p>
            <p>{t('requirements.createBlocked')}</p>
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
          onClear={() => setStatusFilter([])}
        >
          <CheckboxFilterContent
            title={t('status.label')}
            options={statusOptions}
            selectedValues={statusFilter}
            onApply={setStatusFilter}
          />
        </FilterPill>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={links}
        rowCount={links.length}
        isLoading={isLoading}
        onRowClick={(row: PaymentLink) => openEdit(row.id)}
        tableId="payment-links:list"
      />

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
    </div>
  )
}
