import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Loader2, Plus, User } from 'lucide-react'
import { DateTime } from 'luxon'
import { useEffect, useMemo, useState, type MutableRefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { cn, includesNormalized } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { TimePicker } from '@/components/ui/time-picker'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { SearchCombobox, type SearchComboboxItem } from '@/components/search-combobox'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useDebounce } from '@/hooks/useDebounce'
import { useToast } from '@/hooks/use-toast'
import { useVenueDateTime } from '@/utils/datetime'
import reservationService from '@/services/reservation.service'
import { customerService } from '@/services/customer.service'
import { getProducts } from '@/services/menu.service'
import { teamService } from '@/services/team.service'
import { ProductType, VenueType } from '@/types'
import type { AvailableSlot } from '@/types/reservation'
import CustomerForm from '@/pages/Customers/components/CustomerForm'
import { ServiceTypeSelectorDialog } from '@/pages/Menu/Services/ServiceTypeSelectorDialog'
import { ServiceFormDialog } from '@/pages/Menu/Services/ServiceFormDialog'
import type { ProductType as ServiceProductType } from '@/services/inventory.service'

const VENUE_TYPES_WITH_TABLES = new Set<VenueType>([
  VenueType.RESTAURANT, VenueType.BAR, VenueType.CAFE, VenueType.BAKERY,
  VenueType.FAST_FOOD, VenueType.CATERING, VenueType.FOOD_TRUCK, VenueType.CLOUD_KITCHEN,
  VenueType.HOTEL, VenueType.HOSTEL, VenueType.RESORT,
])

const createSchema = z
  .object({
    date: z.string().min(1, 'Selecciona una fecha'),
    startTime: z.string().min(1, 'Selecciona una hora'),
    endTime: z.string().min(1, 'Selecciona una hora'),
    duration: z.coerce.number().min(15),
    partySize: z.coerce.number().min(1),
    // Service
    productId: z.string().optional(),
    // Guest
    guestMode: z.enum(['existing', 'new']),
    customerId: z.string().optional(),
    guestName: z.string().optional(),
    guestPhone: z.string().optional(),
    guestEmail: z.string().email().optional().or(z.literal('')),
    // Assignment
    tableId: z.string().optional(),
    assignedStaffId: z.string().optional(),
    // Additional
    specialRequests: z.string().optional(),
    internalNotes: z.string().optional(),
  })
  .refine(
    data => {
      if (data.guestMode === 'new' && !data.guestName) return false
      return true
    },
    { message: 'El nombre del invitado es requerido', path: ['guestName'] },
  )

type CreateFormData = z.infer<typeof createSchema>

// --- Reusable form (used in both standalone page and modal) ---

interface CreateReservationFormProps {
  defaultDate?: string
  defaultStartTime?: string
  onSuccess?: (reservation: any) => void
  onCancel?: () => void
  /** Assign submitRef.current = handleSubmit callback so parent can trigger submit */
  submitRef?: MutableRefObject<(() => void) | null>
}

export function CreateReservationForm({ defaultDate, defaultStartTime, onSuccess, onCancel, submitRef }: CreateReservationFormProps) {
  const { t } = useTranslation('reservations')
  const { t: tCommon } = useTranslation()
  const { venue, venueId, fullBasePath } = useCurrentVenue()
  const { formatDateISO, venueTimezone } = useVenueDateTime()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [guestMode, setGuestMode] = useState<'existing' | 'new'>('new')
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomerName, setSelectedCustomerName] = useState('')
  const [showCreateCustomerDialog, setShowCreateCustomerDialog] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [showServiceTypeSelector, setShowServiceTypeSelector] = useState(false)
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [newServiceType, setNewServiceType] = useState<ServiceProductType | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateFormData>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      date: defaultDate || formatDateISO(new Date()),
      startTime: defaultStartTime || '',
      endTime: '',
      duration: 60,
      partySize: 2,
      productId: '',
      guestMode: 'new',
      guestName: '',
      guestPhone: '',
      guestEmail: '',
      tableId: '',
      assignedStaffId: '',
      specialRequests: '',
      internalNotes: '',
    },
  })

  const watchDate = watch('date')
  const watchPartySize = watch('partySize')
  const watchDuration = watch('duration')
  const watchProductId = watch('productId')
  const watchStartTime = watch('startTime')

  // Fetch APPOINTMENTS_SERVICE products for the service selector
  const { data: allProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products', venueId, 'all'],
    queryFn: () => getProducts(venueId!),
    enabled: !!venueId,
    staleTime: 60_000,
  })

  // All bookable products
  const bookableProducts = useMemo(
    () =>
      allProducts.filter(
        p => p.active && [ProductType.APPOINTMENTS_SERVICE, ProductType.SERVICE, ProductType.EVENT, ProductType.CLASS].includes(p.type),
      ),
    [allProducts],
  )

  // Product combobox items (filtered by search)
  const productComboboxItems = useMemo<SearchComboboxItem[]>(() => {
    return bookableProducts
      .filter(p => !productSearch || includesNormalized(p.name ?? '', productSearch))
      .map(p => ({
        id: p.id,
        label: p.name,
        description: p.duration ? `${p.duration} min.` : undefined,
        endLabel: Number(p.price) > 0 ? `$${Number(p.price).toFixed(2)}` : undefined,
      }))
  }, [bookableProducts, productSearch])

  // Customer groups for create dialog
  const { data: customerGroupsData } = useQuery({
    queryKey: ['customer-groups', venueId],
    queryFn: () => customerService.getCustomerGroups(venueId!, {}),
    enabled: !!venueId,
    staleTime: 60_000,
  })

  // Auto-fill duration when a service with duration is selected
  const selectedProduct = useMemo(() => bookableProducts.find(p => p.id === watchProductId), [bookableProducts, watchProductId])

  useEffect(() => {
    if (selectedProduct?.duration) {
      setValue('duration', selectedProduct.duration)
    }
  }, [selectedProduct, setValue])

  // Auto-calculate endTime from startTime + duration
  useEffect(() => {
    if (!watchStartTime || !watchDuration) return
    const [h, m] = watchStartTime.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) return
    const totalMinutes = h * 60 + m + watchDuration
    const endH = Math.floor(totalMinutes / 60) % 24
    const endM = totalMinutes % 60
    const endTimeStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
    setValue('endTime', endTimeStr, { shouldValidate: true })
  }, [watchStartTime, watchDuration, setValue])

  // Fetch staff members
  const { data: staffData } = useQuery({
    queryKey: ['team', venueId, 'active'],
    queryFn: () => teamService.getTeamMembers(venueId!, 1, 100),
    enabled: !!venueId,
    staleTime: 60_000,
  })

  const staffMembers = useMemo(() => staffData?.data ?? [], [staffData])

  // Fetch customers with search + infinite scroll (alphabetical)
  const debouncedCustomerSearch = useDebounce(customerSearch, 300)
  const {
    data: customersPages,
    isLoading: customersLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['customers-search', venueId, debouncedCustomerSearch],
    queryFn: ({ pageParam = 1 }) =>
      customerService.getCustomers(venueId!, {
        search: debouncedCustomerSearch || undefined,
        page: pageParam,
        pageSize: 30,
        sortOrder: 'asc',
      }),
    getNextPageParam: (lastPage) => {
      const { currentPage, totalPages } = lastPage.meta
      return currentPage < totalPages ? currentPage + 1 : undefined
    },
    initialPageParam: 1,
    enabled: !!venueId,
    staleTime: 30_000,
  })

  const customerItems = useMemo<SearchComboboxItem[]>(() => {
    const allCustomers = customersPages?.pages.flatMap(p => p.data) ?? []
    return allCustomers.map(c => ({
      id: c.id,
      label: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || c.phone || 'Sin nombre',
      description: [c.phone, c.email].filter(Boolean).join(' · ') || undefined,
    }))
  }, [customersPages])

  // Fetch availability for selected date
  const { data: availabilityData } = useQuery({
    queryKey: ['reservation-availability', venueId, watchDate, watchPartySize, watchDuration],
    queryFn: () =>
      reservationService.getAvailability(venueId, {
        date: watchDate,
        partySize: watchPartySize || undefined,
        duration: watchDuration || undefined,
      }),
    enabled: !!watchDate,
  })

  const availableSlots = availabilityData?.slots || []

  // When a slot is selected, update start/end time and available tables
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null)
  const showTables = venue?.type ? VENUE_TYPES_WITH_TABLES.has(venue.type) : false

  const handleSlotSelect = (slot: AvailableSlot) => {
    setSelectedSlot(slot)
    const start = DateTime.fromISO(slot.startsAt, { zone: 'utc' }).setZone(venueTimezone)
    const end = DateTime.fromISO(slot.endsAt, { zone: 'utc' }).setZone(venueTimezone)
    setValue('startTime', `${String(start.hour).padStart(2, '0')}:${String(start.minute).padStart(2, '0')}`)
    setValue('endTime', `${String(end.hour).padStart(2, '0')}:${String(end.minute).padStart(2, '0')}`)
    if (slot.availableTables.length > 0) {
      setValue('tableId', slot.availableTables[0].id)
    }
  }

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateFormData) => {
      const startsAtDt = DateTime.fromISO(`${data.date}T${data.startTime}:00`, { zone: venueTimezone })
      const endsAtDt = DateTime.fromISO(`${data.date}T${data.endTime}:00`, { zone: venueTimezone })

      if (!startsAtDt.isValid || !endsAtDt.isValid) {
        throw new Error('Invalid reservation datetime')
      }

      const startsAt = startsAtDt.toUTC().toISO()
      const endsAt = endsAtDt.toUTC().toISO()

      if (!startsAt || !endsAt) {
        throw new Error('Invalid reservation datetime')
      }

      return reservationService.createReservation(venueId, {
        startsAt,
        endsAt,
        duration: data.duration,
        partySize: data.partySize,
        channel: 'DASHBOARD',
        productId: data.productId || undefined,
        customerId: data.guestMode === 'existing' && data.customerId ? data.customerId : undefined,
        guestName: data.guestMode === 'new' ? data.guestName : undefined,
        guestPhone: data.guestPhone || undefined,
        guestEmail: data.guestEmail || undefined,
        tableId: data.tableId || undefined,
        assignedStaffId: data.assignedStaffId || undefined,
        specialRequests: data.specialRequests || undefined,
        internalNotes: data.internalNotes || undefined,
      })
    },
    onSuccess: reservation => {
      toast({ title: t('toasts.createSuccess') })
      queryClient.invalidateQueries({ queryKey: ['reservations', venueId] })
      if (onSuccess) {
        onSuccess(reservation)
      } else {
        navigate(`${fullBasePath}/reservations/${reservation.id}`)
      }
    },
    onError: (error: any) => {
      toast({
        title: tCommon('error'),
        description: error.response?.data?.message || t('toasts.error'),
        variant: 'destructive',
      })
    },
  })

  // Expose submit to parent via ref
  const onSubmit = handleSubmit(data => createMutation.mutate(data))
  if (submitRef) {
    submitRef.current = onSubmit
  }

  // Compute subtotal from selected services
  const subtotal = selectedProduct ? Number(selectedProduct.price) : 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
      {/* ─── LEFT COLUMN: Main form ─── */}
      <div className="space-y-8">
        {/* Cliente */}
        <div className="space-y-3">
          <h3 className="text-base font-semibold">{t('form.sections.customer', { defaultValue: 'Cliente' })}</h3>
          {guestMode === 'existing' && selectedCustomerName ? (
            <div className="flex items-center gap-3 h-12 px-4 rounded-lg border border-input">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium flex-1 truncate">{selectedCustomerName}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => {
                  setGuestMode('new')
                  setValue('guestMode', 'new')
                  setValue('customerId', '')
                  setSelectedCustomerName('')
                  setCustomerSearch('')
                }}
              >
                {t('form.changeCustomer', { defaultValue: 'Cambiar' })}
              </Button>
            </div>
          ) : (
            <SearchCombobox
              placeholder={t('form.searchCustomer', { defaultValue: 'Buscar cliente por nombre, teléfono o email...' })}
              items={customerItems}
              isLoading={customersLoading}
              value={customerSearch}
              onChange={setCustomerSearch}
              onSelect={(item) => {
                setGuestMode('existing')
                setValue('guestMode', 'existing')
                setValue('customerId', item.id)
                setSelectedCustomerName(item.label)
                setCustomerSearch('')
              }}
              onCreateNew={() => setShowCreateCustomerDialog(true)}
              createNewLabel={() => `+ ${t('form.createCustomer', { defaultValue: 'Crear cliente' })}`}
              onLoadMore={() => fetchNextPage()}
              hasMore={!!hasNextPage}
              isLoadingMore={isFetchingNextPage}
            />
          )}
        </div>

        {/* Servicios y artículos */}
        <div className="space-y-3">
          <h3 className="text-base font-semibold">{t('form.sections.service', { defaultValue: 'Servicios y artículos' })}</h3>
          {productsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {tCommon('loading')}
            </div>
          ) : bookableProducts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                {t('form.noServicesAvailable', { defaultValue: 'No hay servicios creados. Puedes crear uno en MenuMaker.' })}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowServiceTypeSelector(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                {t('form.createService', { defaultValue: 'Crear servicio' })}
              </Button>
            </div>
          ) : selectedProduct ? (
            <div className="flex items-center gap-3 h-12 px-4 rounded-lg border border-input">
              <span className="text-sm font-medium flex-1 truncate">{selectedProduct.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => {
                  setValue('productId', '')
                  setProductSearch('')
                }}
              >
                {t('form.changeService', { defaultValue: 'Cambiar' })}
              </Button>
            </div>
          ) : (
            <SearchCombobox
              placeholder={t('form.searchService', { defaultValue: 'Buscar servicio por nombre...' })}
              items={productComboboxItems}
              isLoading={productsLoading}
              value={productSearch}
              onChange={setProductSearch}
              onSelect={(item) => {
                setValue('productId', item.id)
                setProductSearch('')
              }}
              onCreateNew={() => setShowServiceTypeSelector(true)}
              createNewLabel={() => t('form.createService', { defaultValue: 'Crear servicio' })}
            />
          )}

          {/* Selected service summary */}
          {selectedProduct && (
            <div className="flex items-center justify-between text-sm px-1">
              <span>{selectedProduct.name}</span>
              <div className="flex items-center gap-3 text-muted-foreground">
                {selectedProduct.duration && <span>{selectedProduct.duration} min.</span>}
                {Number(selectedProduct.price) > 0 && (
                  <span className="text-foreground">${Number(selectedProduct.price).toFixed(2)}</span>
                )}
              </div>
            </div>
          )}

          {/* Subtotal / Total */}
          <div className="border-t border-border pt-3 space-y-1.5">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span>Total</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Fecha y hora */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold">{t('form.sections.dateTime', { defaultValue: 'Fecha y hora' })}</h3>

          {/* Date + Time + Duration + Party — compact grid */}
          <div className="grid grid-cols-2 gap-3">
            <DatePicker
              value={watchDate ? new Date(watchDate + 'T12:00:00') : undefined}
              onChange={date => {
                if (date) {
                  const yyyy = date.getFullYear()
                  const mm = String(date.getMonth() + 1).padStart(2, '0')
                  const dd = String(date.getDate()).padStart(2, '0')
                  setValue('date', `${yyyy}-${mm}-${dd}`, { shouldValidate: true })
                  // Clear slot selection when date changes
                  setSelectedSlot(null)
                }
              }}
            />
            <TimePicker
              value={watchStartTime || undefined}
              onChange={time => {
                setValue('startTime', time, { shouldValidate: true })
                // Find matching slot for manually selected time → keep table data
                const matchingSlot = availableSlots.find(slot => {
                  const start = DateTime.fromISO(slot.startsAt, { zone: 'utc' }).setZone(venueTimezone)
                  const slotTime = `${String(start.hour).padStart(2, '0')}:${String(start.minute).padStart(2, '0')}`
                  return slotTime === time
                })
                setSelectedSlot(matchingSlot || null)
                if (matchingSlot?.availableTables?.length) {
                  setValue('tableId', matchingSlot.availableTables[0].id)
                }
              }}
              error={!!errors.startTime}
            />
          </div>

          {/* Duration + Party size + End time info */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">
                {t('form.fields.duration', { defaultValue: 'Duración' })}
              </Label>
              <Select value={String(watch('duration'))} onValueChange={v => setValue('duration', Number(v))}>
                <SelectTrigger className="w-[88px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[15, 30, 45, 60, 90, 120, 150, 180].map(min => (
                    <SelectItem key={min} value={String(min)}>
                      {min} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">
                {t('form.fields.partySize', { defaultValue: 'Personas' })}
              </Label>
              <Input
                type="number"
                min={1}
                className="w-14 h-8 text-center text-xs"
                {...register('partySize')}
              />
            </div>
            {watchStartTime && watch('endTime') && (
              <>
                <div className="w-px h-4 bg-border" />
                <span className="text-xs text-muted-foreground">
                  {watchStartTime} — {watch('endTime')}
                </span>
              </>
            )}
          </div>

          {/* Availability slots — shown as selectable time grid */}
          {availableSlots.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t('form.availableSlots', { defaultValue: 'Horarios disponibles' })}
                </p>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {availableSlots.length} {availableSlots.length === 1 ? 'horario' : 'horarios'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto rounded-lg border border-border/50 p-3 bg-muted/20">
                {availableSlots.map(slot => {
                  const start = DateTime.fromISO(slot.startsAt, { zone: 'utc' }).setZone(venueTimezone)
                  const timeStr = `${String(start.hour).padStart(2, '0')}:${String(start.minute).padStart(2, '0')}`
                  const isSelected = selectedSlot?.startsAt === slot.startsAt
                  const isCurrentTime = !isSelected && watchStartTime === timeStr
                  return (
                    <button
                      key={slot.startsAt}
                      type="button"
                      onClick={() => handleSlotSelect(slot)}
                      className={cn(
                        'inline-flex items-center h-8 px-3 rounded-md text-xs font-medium tabular-nums transition-all duration-150 cursor-pointer',
                        isSelected
                          ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30'
                          : isCurrentTime
                            ? 'bg-accent text-accent-foreground ring-1 ring-border'
                            : 'bg-background text-foreground hover:bg-accent/60 border border-border/60',
                      )}
                    >
                      {timeStr}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

        </div>

        {/* Assignment — Mesa (solo para venues con mesas) + Personal */}
        <div className={`grid gap-3 ${showTables && selectedSlot && selectedSlot.availableTables.length > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {showTables && selectedSlot && selectedSlot.availableTables.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('form.fields.table', { defaultValue: 'Mesa' })}</Label>
              <Select value={watch('tableId') || 'none'} onValueChange={v => setValue('tableId', v === 'none' ? '' : v)}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder={t('form.selectTable', { defaultValue: 'Seleccionar mesa' })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('noTable', { defaultValue: 'Sin mesa' })}</SelectItem>
                  {selectedSlot.availableTables.map(table => (
                    <SelectItem key={table.id} value={table.id}>
                      {t('form.tableCapacity', { number: table.number, capacity: table.capacity, defaultValue: `Mesa {{number}} ({{capacity}} personas)` })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t('form.fields.staff', { defaultValue: 'Personal asignado' })}</Label>
            <Select value={watch('assignedStaffId') || 'none'} onValueChange={v => setValue('assignedStaffId', v === 'none' ? '' : v)}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder={t('form.selectStaff', { defaultValue: 'Sin asignar' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('noStaff', { defaultValue: 'Sin asignar' })}</SelectItem>
                {staffMembers.map(s => (
                  <SelectItem key={s.staffId} value={s.staffId}>
                    {s.firstName} {s.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Notas */}
        <div className="space-y-3">
          <h3 className="text-base font-semibold">{t('form.sections.notes', { defaultValue: 'Notas' })}</h3>
          <Textarea
            {...register('internalNotes')}
            placeholder={t('form.placeholders.internalNotes', { defaultValue: 'Notas de la cita' })}
            rows={4}
            className="resize-y"
          />
        </div>
      </div>

      {/* ─── RIGHT COLUMN: Customer card ─── */}
      <div>
        <div className="rounded-xl border border-border p-5 sticky top-6">
          {guestMode === 'existing' && watch('customerId') ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">{selectedCustomerName}</h4>
                  <p className="text-xs text-muted-foreground">
                    {t('form.customerSelected', { defaultValue: 'Cliente seleccionado' })}
                  </p>
                </div>
              </div>
              {/* Special requests for existing customer */}
              <div className="space-y-1.5 pt-2">
                <Label className="text-xs text-muted-foreground">{t('form.fields.specialRequests', { defaultValue: 'Peticiones especiales' })}</Label>
                <Textarea
                  {...register('specialRequests')}
                  placeholder={t('form.placeholders.specialRequests', { defaultValue: 'Alergias, preferencias...' })}
                  rows={2}
                  className="resize-y text-sm"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">
                    {guestMode === 'new'
                      ? t('form.newGuest', { defaultValue: 'Nuevo invitado' })
                      : t('form.noCustomerSelected', { defaultValue: 'No se ha seleccionado ningún cliente' })}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {guestMode === 'new'
                      ? t('form.fillGuestInfo', { defaultValue: 'Completa los datos del invitado' })
                      : t('form.selectCustomerHint', { defaultValue: 'Selecciona un cliente para consultar sus datos' })}
                  </p>
                </div>
              </div>

              {guestMode === 'new' && (
                <div className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{t('form.fields.guestName', { defaultValue: 'Nombre' })}</Label>
                    <Input {...register('guestName')} placeholder={t('form.placeholders.guestName', { defaultValue: 'Nombre del invitado' })} />
                    {errors.guestName && <p className="text-xs text-destructive">{t('form.validation.guestNameRequired')}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{t('form.fields.guestPhone', { defaultValue: 'Teléfono' })}</Label>
                    <Input {...register('guestPhone')} placeholder={t('form.placeholders.guestPhone', { defaultValue: '+52 ...' })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{t('form.fields.guestEmail', { defaultValue: 'Email' })}</Label>
                    <Input type="email" {...register('guestEmail')} placeholder={t('form.placeholders.guestEmail', { defaultValue: 'correo@ejemplo.com' })} />
                  </div>

                  {/* Special requests */}
                  <div className="space-y-1.5 pt-2">
                    <Label className="text-xs text-muted-foreground">{t('form.fields.specialRequests', { defaultValue: 'Peticiones especiales' })}</Label>
                    <Textarea
                      {...register('specialRequests')}
                      placeholder={t('form.placeholders.specialRequests', { defaultValue: 'Alergias, preferencias...' })}
                      rows={2}
                      className="resize-y text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Customer Dialog */}
      <Dialog open={showCreateCustomerDialog} onOpenChange={setShowCreateCustomerDialog}>
        {showCreateCustomerDialog && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('form.createCustomer', { defaultValue: 'Crear cliente' })}</DialogTitle>
            </DialogHeader>
            <CustomerForm
              venueId={venueId!}
              groups={customerGroupsData?.data || []}
              onSuccess={() => {
                setShowCreateCustomerDialog(false)
                queryClient.invalidateQueries({ queryKey: ['customers-search', venueId] })
              }}
            />
          </DialogContent>
        )}
      </Dialog>

      {/* Create Service — Type Selector → Form */}
      <ServiceTypeSelectorDialog
        open={showServiceTypeSelector}
        onOpenChange={setShowServiceTypeSelector}
        onSelect={(type) => {
          setNewServiceType(type)
          setShowServiceForm(true)
        }}
      />
      <ServiceFormDialog
        open={showServiceForm}
        onOpenChange={setShowServiceForm}
        mode="create"
        serviceType={newServiceType}
        onSuccess={(productId) => {
          setShowServiceForm(false)
          setValue('productId', productId)
          setProductSearch('')
          queryClient.invalidateQueries({ queryKey: ['products', venueId] })
        }}
      />
    </div>
  )
}

// --- Standalone page wrapper (existing route) ---

export default function CreateReservation() {
  const { t } = useTranslation('reservations')
  const { fullBasePath } = useCurrentVenue()
  const navigate = useNavigate()
  const submitRef = useMemo<MutableRefObject<(() => void) | null>>(() => ({ current: null }), [])

  return (
    <div className="p-4 bg-background text-foreground max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(`${fullBasePath}/reservations`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{t('form.createTitle', { defaultValue: 'Crear cita' })}</h1>
        </div>
        <Button onClick={() => submitRef.current?.()}>{t('actions.save', { defaultValue: 'Guardar' })}</Button>
      </div>

      <CreateReservationForm submitRef={submitRef} />
    </div>
  )
}
