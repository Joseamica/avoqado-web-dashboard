/**
 * Bancos → Beneficiarios. Libreta de contactos para SPEI/dispersiones (a quién le pago).
 * Beta: el CRUD funciona de verdad (crear/editar/eliminar), pero corre contra un stub en
 * memoria (src/services/bankingHub.service.ts) — no hay backend todavía, así que la lista
 * se reinicia al recargar la página. Guardar un beneficiario NO mueve dinero: solo cuando
 * SPEI/Dispersiones tengan backend real, esta libreta se usa para autocompletar el destino.
 */
import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, MoreHorizontal, Pencil, Plus, Trash2, Users } from 'lucide-react'

import DataTable from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { LoadingButton } from '@/components/loading-button'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { BancosPageHeader } from '@/pages/Bancos/BancosPageHeader'
import { beneficiariesService, DuplicateClabeError, type Beneficiary, type BeneficiaryInput } from '@/services/bankingHub.service'
import { isValidClabe } from '@/utils/clabe'

function BeneficiaryFormModal({
  open,
  onClose,
  venueId,
  beneficiary,
}: {
  open: boolean
  onClose: () => void
  venueId: string
  beneficiary: Beneficiary | null
}) {
  const { t } = useTranslation('financialConnections')
  const { t: tCommon } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isEditing = !!beneficiary

  const form = useForm<BeneficiaryInput>({
    defaultValues: {
      name: beneficiary?.name ?? '',
      clabe: beneficiary?.clabe ?? '',
      bankName: beneficiary?.bankName ?? '',
      alias: beneficiary?.alias ?? '',
    },
  })

  const mutation = useMutation({
    mutationFn: (input: BeneficiaryInput) =>
      isEditing ? beneficiariesService.update(venueId, beneficiary.id, input) : beneficiariesService.create(venueId, input),
    onSuccess: () => {
      toast({ title: isEditing ? t('hub.beneficiaries.toasts.updated') : t('hub.beneficiaries.toasts.created') })
      queryClient.invalidateQueries({ queryKey: ['banking-hub-beneficiaries', venueId] })
      onClose()
    },
    onError: err => {
      const title = err instanceof DuplicateClabeError ? t('hub.beneficiaries.form.validation.clabeDuplicate') : tCommon('error')
      toast({ title, variant: 'destructive' })
    },
  })

  return (
    <FullScreenModal
      open={open}
      onClose={onClose}
      title={form.watch('name') || (isEditing ? t('hub.beneficiaries.form.editTitle') : t('hub.beneficiaries.form.createTitle'))}
      contentClassName="bg-muted/30"
      actions={
        <LoadingButton loading={mutation.isPending} onClick={form.handleSubmit(v => mutation.mutate(v))}>
          {mutation.isPending ? tCommon('saving') : t('hub.beneficiaries.form.save')}
        </LoadingButton>
      }
    >
      <div className="mx-auto max-w-2xl px-6 py-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-4 rounded-2xl border border-border/50 bg-card p-6">
            <FormField
              control={form.control}
              name="name"
              rules={{
                required: t('hub.beneficiaries.form.validation.nameRequired'),
                validate: v => v.trim().length > 0 || t('hub.beneficiaries.form.validation.nameRequired'),
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('hub.beneficiaries.form.fields.name')}</FormLabel>
                  <FormControl>
                    <Input
                      data-tour="beneficiary-form-name"
                      className="h-12 text-base"
                      placeholder={t('hub.beneficiaries.form.placeholders.name')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="clabe"
              rules={{
                required: t('hub.beneficiaries.form.validation.clabeRequired'),
                validate: v => isValidClabe(v) || t('hub.beneficiaries.form.validation.clabeInvalid'),
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('hub.beneficiaries.form.fields.clabe')}</FormLabel>
                  <FormControl>
                    <Input
                      data-tour="beneficiary-form-clabe"
                      className="h-12 text-base font-mono"
                      inputMode="numeric"
                      maxLength={18}
                      placeholder="000000000000000000"
                      {...field}
                      onChange={e => field.onChange(e.target.value.replace(/\D/g, ''))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bankName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('hub.beneficiaries.form.fields.bankName')}</FormLabel>
                  <FormControl>
                    <Input
                      data-tour="beneficiary-form-bank-name"
                      className="h-12 text-base"
                      placeholder={t('hub.beneficiaries.form.placeholders.bankName')}
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="alias"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('hub.beneficiaries.form.fields.alias')}</FormLabel>
                  <FormControl>
                    <Input
                      data-tour="beneficiary-form-alias"
                      className="h-12 text-base"
                      placeholder={t('hub.beneficiaries.form.placeholders.alias')}
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </div>
    </FullScreenModal>
  )
}

function BeneficiariesList({ venueId }: { venueId: string }) {
  const { t } = useTranslation('financialConnections')
  const { t: tCommon } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Beneficiary | null>(null)
  const [deleting, setDeleting] = useState<Beneficiary | null>(null)
  // Cambia en CADA apertura (crear o editar) — usado como `key` del modal para forzar un remount
  // siempre. `editing?.id` solo no alcanza: "crear" → "crear otro" son ambos `editing===null`,
  // mismo key, y sin remount el form reusado conserva lo último tecleado (incluido el registro
  // recién guardado).
  const [formSession, setFormSession] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ['banking-hub-beneficiaries', venueId],
    queryFn: () => beneficiariesService.list(venueId),
  })
  const beneficiaries = useMemo(() => data ?? [], [data])

  const deleteMutation = useMutation({
    mutationFn: (id: string) => beneficiariesService.remove(venueId, id),
    onSuccess: () => {
      toast({ title: t('hub.beneficiaries.toasts.deleted') })
      queryClient.invalidateQueries({ queryKey: ['banking-hub-beneficiaries', venueId] })
      setDeleting(null)
    },
    onError: () => toast({ title: tCommon('error'), variant: 'destructive' }),
  })

  const handleSearch = useCallback((search: string, rows: Beneficiary[]) => {
    const q = search.toLowerCase()
    return rows.filter(b => b.name.toLowerCase().includes(q) || b.clabe.includes(q) || (b.alias ?? '').toLowerCase().includes(q))
  }, [])

  const columns: ColumnDef<Beneficiary>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: t('hub.beneficiaries.columns.name'),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            {row.original.alias && <span className="text-xs text-muted-foreground">{row.original.alias}</span>}
          </div>
        ),
      },
      {
        accessorKey: 'clabe',
        header: t('hub.beneficiaries.columns.clabe'),
        cell: ({ row }) => <span className="font-mono text-sm">{row.original.clabe}</span>,
      },
      {
        accessorKey: 'bankName',
        header: t('hub.beneficiaries.columns.bank'),
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.bankName || '—'}</span>,
      },
      {
        id: 'actions',
        header: tCommon('actions'),
        cell: ({ row }) => (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={() => {
                  setEditing(row.original)
                  setFormSession(s => s + 1)
                  setFormOpen(true)
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                {tCommon('common.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDeleting(row.original)} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                {tCommon('common.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [t, tCommon],
  )

  return (
    <>
      <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>{t('hub.beneficiaries.notPersistedWarning')}</span>
      </div>

      <DataTable
        data={beneficiaries}
        columns={columns}
        rowCount={beneficiaries.length}
        isLoading={isLoading}
        tableId="banking-hub-beneficiaries:list"
        enableSearch
        searchPlaceholder={t('hub.beneficiaries.searchPlaceholder')}
        onSearch={handleSearch}
        toolbarRight={
          <Button
            data-tour="bancos-beneficiary-new-btn"
            onClick={() => {
              setEditing(null)
              setFormSession(s => s + 1)
              setFormOpen(true)
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            {t('hub.beneficiaries.newCta')}
          </Button>
        }
      />

      {!isLoading && beneficiaries.length === 0 && (
        <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-input bg-muted/30 px-4 py-10 text-center">
          <Users className="h-6 w-6 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">{t('hub.beneficiaries.empty')}</p>
        </div>
      )}

      {/* key=formSession fuerza remount en CADA apertura: useForm solo lee defaultValues en el
          primer render, así que sin esto el form reabierto conserva lo último tecleado — incluso
          entre "crear" → "crear otro" (editing===null en ambos casos, así que un key atado solo a
          editing?.id no alcanza). Riesgo real evitado: guardar la CLABE equivocada bajo el
          nombre equivocado, o crear un duplicado por descuido al reabrir con datos viejos. */}
      <BeneficiaryFormModal
        key={formSession}
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        venueId={venueId}
        beneficiary={editing}
      />

      <AlertDialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('hub.beneficiaries.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('hub.beneficiaries.deleteDesc', { name: deleting?.name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? tCommon('deleting') : tCommon('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default function BancosBeneficiarios() {
  const { t } = useTranslation('financialConnections')
  const { venueId } = useCurrentVenue()
  const { hasAccess } = useTierFeatureAccess('BANKING_HUB')

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4 sm:p-6">
      <BancosPageHeader
        title={
          <span className="flex items-center gap-2">
            {t('hub.beneficiaries.title')}
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              {t('hub.beneficiaries.betaBadge')}
            </Badge>
          </span>
        }
        description={t('hub.beneficiaries.description')}
      />
      <FeatureGate feature="BANKING_HUB">{hasAccess && venueId && <BeneficiariesList venueId={venueId} />}</FeatureGate>
    </div>
  )
}
