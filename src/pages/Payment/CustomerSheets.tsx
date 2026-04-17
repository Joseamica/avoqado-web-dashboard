/**
 * Customer picker + create/edit form used by the payment drawer.
 *
 * Two dialogs:
 *  - <AddCustomerSheet />   picker: search existing customers, pick one, or create new
 *  - <CustomerFormSheet />  create or edit form with a subset of customer fields
 *
 * Both live here because they're only used by the payment drawer today.
 * If more callers appear, extract to /components.
 */

import api from '@/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDebounce } from '@/hooks/useDebounce'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

// ==========================================================================
// Types
// ==========================================================================

export interface Customer {
  id: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
}

function fullName(c: Customer | null | undefined): string {
  if (!c) return ''
  return `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.email || c.phone || '—'
}

// ==========================================================================
// AddCustomerSheet — picker modal
// ==========================================================================

interface AddCustomerSheetProps {
  venueId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (customer: Customer) => void
  onCreateNew: () => void
}

export function AddCustomerSheet({ venueId, open, onOpenChange, onConfirm, onCreateNew }: AddCustomerSheetProps) {
  const { t } = useTranslation('payment')
  const { t: tCommon } = useTranslation('common')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 250)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setSearch('')
      setSelectedId(null)
    }
  }, [open])

  const { data, isLoading } = useQuery({
    queryKey: ['customers', venueId, debouncedSearch],
    queryFn: async () => {
      const res = await api.get(`/api/v1/dashboard/venues/${venueId}/customers`, {
        params: { pageSize: 50, ...(debouncedSearch && { search: debouncedSearch }) },
      })
      return res.data
    },
    enabled: open && !!venueId,
  })

  const customers: Customer[] = data?.data ?? data?.customers ?? []
  const selected = customers.find(c => c.id === selectedId) ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 [&>button]:hidden overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/60">
          <Button variant="secondary" size="icon" className="rounded-full h-9 w-9" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
          <h2 className="flex-1 text-center text-lg font-semibold pr-9">
            {t('customer.add.title', { defaultValue: 'Añadir cliente' })}
          </h2>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-border/60">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder={t('customer.add.searchPlaceholder', { defaultValue: 'Buscar clientes' })}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 px-0"
            autoFocus
          />
        </div>

        {/* List / Empty state */}
        <div className="min-h-[320px] max-h-[50vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : customers.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              {debouncedSearch
                ? t('customer.add.noResults', { defaultValue: 'No se encontraron clientes' })
                : t('customer.add.emptyDirectory', { defaultValue: 'Tu directorio está vacío' })}
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {customers.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left px-6 py-3 hover:bg-muted/40 transition-colors ${
                    selectedId === c.id ? 'bg-muted/60' : ''
                  }`}
                >
                  <p className="font-medium text-foreground">{fullName(c)}</p>
                  <p className="text-xs text-muted-foreground">{c.email ?? c.phone ?? ''}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-border/60">
          <Button variant="secondary" className="rounded-full" onClick={() => onOpenChange(false)}>
            {tCommon('cancel', { defaultValue: 'Cancelar' })}
          </Button>
          <Button variant="secondary" className="rounded-full" onClick={onCreateNew}>
            {t('customer.add.createNew', { defaultValue: 'Crear nuevo cliente' })}
          </Button>
          <div className="flex-1" />
          <Button
            className="rounded-full px-6 bg-foreground text-background hover:bg-foreground/90"
            disabled={!selected}
            onClick={() => selected && onConfirm(selected)}
          >
            {t('customer.add.confirm', { defaultValue: 'Añadir cliente' })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ==========================================================================
// CustomerFormSheet — create or edit
// ==========================================================================

interface CustomerFormSheetProps {
  venueId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  customer?: Customer | null // null/undefined = create mode
  onSaved: (customer: Customer) => void
  onRemoveFromTransaction?: () => void // only shown in edit mode
}

export function CustomerFormSheet({
  venueId,
  open,
  onOpenChange,
  customer,
  onSaved,
  onRemoveFromTransaction,
}: CustomerFormSheetProps) {
  const { t } = useTranslation('payment')
  const { t: tCommon } = useTranslation('common')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isEdit = !!customer?.id

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (open) {
      setFirstName(customer?.firstName ?? '')
      setLastName(customer?.lastName ?? '')
      setEmail(customer?.email ?? '')
      setPhone(customer?.phone ?? '')
    }
  }, [open, customer])

  const saveMutation = useMutation({
    mutationFn: async (): Promise<Customer> => {
      const payload: Record<string, unknown> = {}
      if (firstName.trim()) payload.firstName = firstName.trim()
      if (lastName.trim()) payload.lastName = lastName.trim()
      if (email.trim()) payload.email = email.trim()
      if (phone.trim()) payload.phone = phone.trim()

      // Server responses are { message, customer } — unwrap to the Customer.
      if (isEdit && customer) {
        const res = await api.put(`/api/v1/dashboard/venues/${venueId}/customers/${customer.id}`, payload)
        return (res.data?.customer ?? res.data) as Customer
      }
      const res = await api.post(`/api/v1/dashboard/venues/${venueId}/customers`, payload)
      return (res.data?.customer ?? res.data) as Customer
    },
    onSuccess: saved => {
      queryClient.invalidateQueries({ queryKey: ['customers', venueId] })
      toast({
        title: isEdit
          ? t('customer.form.updated', { defaultValue: 'Cliente actualizado' })
          : t('customer.form.created', { defaultValue: 'Cliente creado' }),
      })
      onSaved(saved)
    },
    onError: (err: any) => {
      toast({
        title: t('customer.form.error', { defaultValue: 'No se pudo guardar el cliente' }),
        description: err?.response?.data?.message || err?.message,
        variant: 'destructive',
      })
    },
  })

  const canSave = (firstName.trim() || lastName.trim()) && (email.trim() || phone.trim())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 [&>button]:hidden overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/60">
          <Button variant="secondary" size="icon" className="rounded-full h-9 w-9" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
          <h2 className="flex-1 text-center text-lg font-semibold pr-9">
            {isEdit
              ? t('customer.form.editTitle', { defaultValue: 'Editar cliente' })
              : t('customer.form.createTitle', { defaultValue: 'Crear cliente' })}
          </h2>
        </div>

        {/* Form */}
        <div className="px-6 py-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t('customer.form.firstName', { defaultValue: 'Nombre' })}
              value={firstName}
              onChange={setFirstName}
              autoFocus
            />
            <Field label={t('customer.form.lastName', { defaultValue: 'Apellidos' })} value={lastName} onChange={setLastName} />
          </div>
          <Field
            label={t('customer.form.email', { defaultValue: 'Correo electrónico' })}
            value={email}
            onChange={setEmail}
            type="email"
            placeholder="cliente@ejemplo.com"
          />
          <Field
            label={t('customer.form.phone', { defaultValue: 'Teléfono' })}
            value={phone}
            onChange={setPhone}
            placeholder="+52 55 1234 5678"
            hint={t('customer.form.phoneHint', { defaultValue: 'Incluye código de país (10 a 15 dígitos)' })}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-border/60">
          <Button variant="secondary" className="rounded-full" onClick={() => onOpenChange(false)}>
            {tCommon('cancel', { defaultValue: 'Cancelar' })}
          </Button>
          {isEdit && onRemoveFromTransaction && (
            <Button variant="secondary" className="rounded-full" onClick={onRemoveFromTransaction}>
              {t('customer.form.removeFromTransaction', { defaultValue: 'Eliminar de la transacción' })}
            </Button>
          )}
          <div className="flex-1" />
          <Button
            className="rounded-full px-6 bg-foreground text-background hover:bg-foreground/90"
            disabled={!canSave || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending
              ? tCommon('saving', { defaultValue: 'Guardando...' })
              : tCommon('save', { defaultValue: 'Guardar' })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ==========================================================================
// Helpers
// ==========================================================================

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
  autoFocus,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  hint?: string
  autoFocus?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <Input type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} autoFocus={autoFocus} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
