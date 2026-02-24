import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Users, X } from 'lucide-react'
import { DateTime } from 'luxon'
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'

import DataTable from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useVenueDateTime } from '@/utils/datetime'
import reservationService from '@/services/reservation.service'
import type { WaitlistEntry, WaitlistStatus } from '@/types/reservation'

type TabValue = 'all' | 'waiting' | 'notified'

const addToWaitlistSchema = z.object({
  guestName: z.string().min(1, 'Required'),
  guestPhone: z.string().optional(),
  partySize: z.coerce.number().min(1),
  desiredStartAt: z.string().min(1, 'Required'),
  notes: z.string().optional(),
})

type AddToWaitlistFormData = z.infer<typeof addToWaitlistSchema>

const waitlistStatusVariant: Record<WaitlistStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  WAITING: 'default',
  NOTIFIED: 'secondary',
  PROMOTED: 'outline',
  CANCELLED: 'destructive',
  EXPIRED: 'destructive',
}

export default function Waitlist() {
  const { t } = useTranslation('reservations')
  const { t: tCommon } = useTranslation()
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { formatTime, formatDate, venueTimezone } = useVenueDateTime()

  const [activeTab, setActiveTab] = useState<TabValue>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [removeEntry, setRemoveEntry] = useState<WaitlistEntry | null>(null)

  // Map tab to API status filter
  const statusFilter = useMemo(() => {
    if (activeTab === 'waiting') return 'WAITING'
    if (activeTab === 'notified') return 'NOTIFIED'
    return undefined
  }, [activeTab])

  // Fetch waitlist
  const { data: waitlistData, isLoading } = useQuery({
    queryKey: ['waitlist', venueId, statusFilter],
    queryFn: () => reservationService.getWaitlist(venueId, statusFilter),
  })

  const waitlist = waitlistData || []

  // Add to waitlist form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddToWaitlistFormData>({
    resolver: zodResolver(addToWaitlistSchema),
    defaultValues: {
      guestName: '',
      guestPhone: '',
      partySize: 2,
      desiredStartAt: '',
      notes: '',
    },
  })

  // Add mutation
  const addMutation = useMutation({
    mutationFn: (data: AddToWaitlistFormData) => {
      const desiredStartAt = DateTime.fromISO(data.desiredStartAt, { zone: venueTimezone })
      if (!desiredStartAt.isValid) {
        throw new Error('Invalid waitlist datetime')
      }

      return reservationService.addToWaitlist(venueId, {
        guestName: data.guestName,
        guestPhone: data.guestPhone || undefined,
        partySize: data.partySize,
        desiredStartAt: desiredStartAt.toUTC().toISO() || '',
        notes: data.notes || undefined,
      })
    },
    onSuccess: () => {
      toast({ title: t('toasts.waitlistAddSuccess') })
      queryClient.invalidateQueries({ queryKey: ['waitlist', venueId] })
      setShowAddModal(false)
      reset()
    },
    onError: (error: any) => {
      toast({
        title: tCommon('error'),
        description: error.response?.data?.message || t('toasts.error'),
        variant: 'destructive',
      })
    },
  })

  // Remove mutation
  const removeMutation = useMutation({
    mutationFn: (entryId: string) => reservationService.removeFromWaitlist(venueId, entryId),
    onSuccess: () => {
      toast({ title: t('toasts.waitlistRemoveSuccess') })
      queryClient.invalidateQueries({ queryKey: ['waitlist', venueId] })
      setRemoveEntry(null)
    },
    onError: (error: any) => {
      toast({
        title: tCommon('error'),
        description: error.response?.data?.message || t('toasts.error'),
        variant: 'destructive',
      })
    },
  })

  // Guest display name helper
  const getGuestName = useCallback(
    (entry: WaitlistEntry) => {
      if (entry.customer) return `${entry.customer.firstName} ${entry.customer.lastName}`
      if (entry.guestName) return entry.guestName
      return t('unnamedGuest')
    },
    [t],
  )

  // Column definitions
  const columns: ColumnDef<WaitlistEntry>[] = useMemo(
    () => [
      {
        accessorKey: 'position',
        header: t('waitlist.columns.position'),
        cell: ({ row }) => <span className="font-mono font-medium">#{row.original.position}</span>,
      },
      {
        id: 'guest',
        header: t('waitlist.columns.guest'),
        cell: ({ row }) => {
          const entry = row.original
          const name = getGuestName(entry)
          const phone = entry.customer?.phone || entry.guestPhone
          return (
            <div>
              <div className="font-medium">{name}</div>
              {phone && <div className="text-sm text-muted-foreground">{phone}</div>}
            </div>
          )
        },
      },
      {
        accessorKey: 'partySize',
        header: t('waitlist.columns.partySize'),
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{row.original.partySize}</span>
          </div>
        ),
      },
      {
        accessorKey: 'desiredStartAt',
        header: t('waitlist.columns.desiredTime'),
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <div className="font-medium">{formatDate(row.original.desiredStartAt)}</div>
            <div className="text-sm text-muted-foreground">{formatTime(row.original.desiredStartAt)}</div>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: t('waitlist.columns.status'),
        cell: ({ row }) => (
          <Badge variant={waitlistStatusVariant[row.original.status]}>{t(`waitlist.status.${row.original.status}`)}</Badge>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: t('waitlist.columns.addedAt'),
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const entry = row.original
          if (entry.status !== 'WAITING' && entry.status !== 'NOTIFIED') return null
          return (
            <div className="flex items-center gap-1 justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={e => {
                  e.stopPropagation()
                  setRemoveEntry(entry)
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )
        },
      },
    ],
    [t, formatDate, formatTime, getGuestName],
  )

  return (
    <div className="p-4 bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('waitlist.title')}</h1>
          <p className="text-muted-foreground">{t('waitlist.subtitle')}</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('waitlist.actions.add')}
        </Button>
      </div>

      {/* Tabs */}
      <div className="mb-4">
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabValue)}>
          <TabsList className="rounded-full bg-muted/60 px-1 py-1 border border-border">
            <TabsTrigger value="all" className="rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background">
              {t('tabs.all')}
            </TabsTrigger>
            <TabsTrigger value="waiting" className="rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background">
              {t('waitlist.status.WAITING')}
            </TabsTrigger>
            <TabsTrigger value="notified" className="rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background">
              {t('waitlist.status.NOTIFIED')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Table */}
      <DataTable
        data={waitlist}
        columns={columns}
        isLoading={isLoading}
        tableId="reservations:waitlist"
        rowCount={waitlist.length}
        showColumnCustomizer={false}
      />

      {/* Add to Waitlist — FullScreenModal */}
      <FullScreenModal
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          reset()
        }}
        title={t('waitlist.addForm.title')}
        actions={
          <Button onClick={handleSubmit(data => addMutation.mutate(data))} disabled={addMutation.isPending}>
            {addMutation.isPending ? tCommon('loading') : t('waitlist.actions.add')}
          </Button>
        }
      >
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          <div className="space-y-2">
            <Label>{t('waitlist.addForm.fields.guestName')}</Label>
            <Input {...register('guestName')} />
            {errors.guestName && <p className="text-sm text-destructive">{errors.guestName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>{t('waitlist.addForm.fields.guestPhone')}</Label>
            <Input {...register('guestPhone')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('waitlist.addForm.fields.partySize')}</Label>
              <Input type="number" min={1} {...register('partySize')} />
            </div>
            <div className="space-y-2">
              <Label>{t('waitlist.addForm.fields.desiredTime')}</Label>
              <Input type="datetime-local" {...register('desiredStartAt')} />
              {errors.desiredStartAt && <p className="text-sm text-destructive">{errors.desiredStartAt.message}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('waitlist.addForm.fields.notes')}</Label>
            <Textarea {...register('notes')} rows={3} />
          </div>
        </div>
      </FullScreenModal>

      {/* Remove Confirmation */}
      <AlertDialog open={!!removeEntry} onOpenChange={open => !open && setRemoveEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('waitlist.actions.remove')}</AlertDialogTitle>
            <AlertDialogDescription>{removeEntry && getGuestName(removeEntry)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removeEntry && removeMutation.mutate(removeEntry.id)}
            >
              {t('waitlist.actions.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
