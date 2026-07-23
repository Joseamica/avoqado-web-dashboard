import { useEffect, useMemo } from 'react'
import { useFieldArray, useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'

import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/context/AuthContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { rawMaterialsApi, type RawMaterial } from '@/services/inventory.service'
import {
  interVenueTransferService,
  type InterVenueTransferDetail,
  type InterVenueTransferMode,
} from '@/services/interVenueTransfer.service'

const formSchema = z.object({
  mode: z.enum(['PULL', 'PUSH']),
  counterpartVenueId: z.string().min(1),
  externalReference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
  items: z
    .array(
      z.object({
        sourceRawMaterialId: z.string().min(1),
        destinationRawMaterialId: z.string().min(1),
        quantity: z.coerce.number().positive(),
        notes: z.string().trim().max(1000).optional(),
      }),
    )
    .min(1),
})

type FormValues = z.infer<typeof formSchema>

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (transfer: InterVenueTransferDetail) => void
}

function responseMaterials(response: unknown): RawMaterial[] {
  const payload = (response as { data?: unknown })?.data
  if (Array.isArray(payload)) return payload as RawMaterial[]
  if (Array.isArray((payload as { data?: unknown })?.data)) return (payload as { data: RawMaterial[] }).data
  return []
}

function errorMessage(error: unknown, fallback: string): string {
  const candidate = error as { response?: { data?: { message?: string } } }
  return candidate.response?.data?.message || fallback
}

export function CreateTransferDialog({ open, onClose, onCreated }: Props) {
  const { t } = useTranslation('inventory')
  const { venue, venueId } = useCurrentVenue()
  const { allVenues } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      mode: 'PULL',
      counterpartVenueId: '',
      externalReference: '',
      notes: '',
      items: [{ sourceRawMaterialId: '', destinationRawMaterialId: '', quantity: 1, notes: '' }],
    },
  })
  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: 'items' })
  const mode = form.watch('mode') as InterVenueTransferMode
  const counterpartVenueId = form.watch('counterpartVenueId')
  const watchedItems = form.watch('items')

  const counterpartVenues = useMemo(
    // Venue "active" gating: the session venue shape (/auth/status) carries `status`,
    // NOT an `active` boolean — filtering on `candidate.active` silently discarded
    // every sibling venue and the destination dropdown was always empty.
    () =>
      allVenues.filter(
        candidate => candidate.id !== venueId && candidate.organizationId === venue?.organizationId && candidate.status === 'ACTIVE',
      ),
    [allVenues, venue?.organizationId, venueId],
  )
  const sourceVenueId = mode === 'PULL' ? counterpartVenueId : venueId
  const destinationVenueId = mode === 'PULL' ? venueId : counterpartVenueId

  const sourceMaterialsQuery = useQuery({
    queryKey: ['raw-materials', 'transfer-source', sourceVenueId],
    queryFn: async () => responseMaterials(await rawMaterialsApi.getAll(sourceVenueId!, { active: true })),
    enabled: open && !!sourceVenueId,
  })
  const destinationMaterialsQuery = useQuery({
    queryKey: ['raw-materials', 'transfer-destination', destinationVenueId],
    queryFn: async () => responseMaterials(await rawMaterialsApi.getAll(destinationVenueId!, { active: true })),
    enabled: open && !!destinationVenueId,
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      mode: 'PULL',
      counterpartVenueId: '',
      externalReference: '',
      notes: '',
      items: [{ sourceRawMaterialId: '', destinationRawMaterialId: '', quantity: 1, notes: '' }],
    })
  }, [form, open])

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const sourceId = values.mode === 'PULL' ? values.counterpartVenueId : venueId!
      const destinationId = values.mode === 'PULL' ? venueId! : values.counterpartVenueId
      return interVenueTransferService.create(venueId!, {
        mode: values.mode,
        sourceVenueId: sourceId,
        destinationVenueId: destinationId,
        externalReference: values.externalReference || undefined,
        notes: values.notes || undefined,
        items: values.items.map(item => ({
          sourceRawMaterialId: item.sourceRawMaterialId!,
          destinationRawMaterialId: item.destinationRawMaterialId!,
          quantity: item.quantity!,
          notes: item.notes || undefined,
        })),
      })
    },
    onSuccess: transfer => {
      void queryClient.invalidateQueries({ queryKey: ['inter-venue-transfers'] })
      toast({ description: t('interVenueTransfers.messages.created') })
      onCreated(transfer)
    },
    onError: error => {
      toast({
        description: errorMessage(error, t('interVenueTransfers.messages.createError')),
        variant: 'destructive',
      })
    },
  })

  const submit = form.handleSubmit(values => {
    let compatible = true
    values.items.forEach((item, index) => {
      const source = sourceMaterialsQuery.data?.find(material => material.id === item.sourceRawMaterialId)
      const destination = destinationMaterialsQuery.data?.find(material => material.id === item.destinationRawMaterialId)
      if (source && destination && source.unit !== destination.unit) {
        form.setError(`items.${index}.destinationRawMaterialId`, {
          message: t('interVenueTransfers.form.unitMismatch'),
        })
        compatible = false
      }
    })
    if (compatible) createMutation.mutate(values)
  })

  const counterpartLabel = mode === 'PULL' ? t('interVenueTransfers.form.sourceVenue') : t('interVenueTransfers.form.destinationVenue')

  return (
    <FullScreenModal
      open={open}
      onClose={onClose}
      title={t('interVenueTransfers.form.title')}
      subtitle={venue?.name}
      actions={
        <Button
          type="submit"
          form="inter-venue-transfer-form"
          disabled={createMutation.isPending || !venueId}
          className="rounded-full"
          data-tour="inter-venue-transfer-submit"
        >
          {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('interVenueTransfers.form.submit')}
        </Button>
      }
    >
      <form id="inter-venue-transfer-form" onSubmit={submit} className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <Card data-tour="inter-venue-transfer-route-section">
          <CardHeader>
            <CardTitle>{t('interVenueTransfers.form.routeSection')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2" data-tour="inter-venue-transfer-mode">
              <Label>{t('interVenueTransfers.form.mode')}</Label>
              <Controller
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={value => {
                      field.onChange(value)
                      form.setValue('counterpartVenueId', '')
                      replace([{ sourceRawMaterialId: '', destinationRawMaterialId: '', quantity: 1, notes: '' }])
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PULL">{t('interVenueTransfers.modes.PULL')}</SelectItem>
                      <SelectItem value="PUSH">{t('interVenueTransfers.modes.PUSH')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2" data-tour="inter-venue-transfer-counterpart">
              <Label>{counterpartLabel}</Label>
              <Controller
                control={form.control}
                name="counterpartVenueId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={value => {
                      field.onChange(value)
                      replace([{ sourceRawMaterialId: '', destinationRawMaterialId: '', quantity: 1, notes: '' }])
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder={t('interVenueTransfers.form.selectVenue')} /></SelectTrigger>
                    <SelectContent>
                      {counterpartVenues.map(candidate => (
                        <SelectItem key={candidate.id} value={candidate.id}>{candidate.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.counterpartVenueId && (
                <p className="text-sm text-destructive">{t('interVenueTransfers.form.required')}</p>
              )}
            </div>
            {counterpartVenues.length === 0 && (
              <Alert className="md:col-span-2"><AlertDescription>{t('interVenueTransfers.form.noCounterpart')}</AlertDescription></Alert>
            )}
          </CardContent>
        </Card>

        <Card data-tour="inter-venue-transfer-items-section">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>{t('interVenueTransfers.form.itemsSection')}</CardTitle>
            <Button
              type="button"
              variant="outline"
              onClick={() => append({ sourceRawMaterialId: '', destinationRawMaterialId: '', quantity: 1, notes: '' })}
              disabled={!counterpartVenueId}
              data-tour="inter-venue-transfer-add-item"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('interVenueTransfers.form.addItem')}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => {
              const selectedSource = sourceMaterialsQuery.data?.find(material => material.id === watchedItems[index]?.sourceRawMaterialId)
              const destinationOptions = selectedSource
                ? destinationMaterialsQuery.data?.filter(material => material.unit === selectedSource.unit)
                : destinationMaterialsQuery.data
              return (
                <div key={field.id} className="grid gap-4 rounded-xl border border-border p-4 md:grid-cols-[1fr_1fr_9rem_auto]" data-tour={`inter-venue-transfer-item-${index + 1}`}>
                  <div className="space-y-2">
                    <Label>{t('interVenueTransfers.form.sourceMaterial')}</Label>
                    <Controller
                      control={form.control}
                      name={`items.${index}.sourceRawMaterialId`}
                      render={({ field: itemField }) => (
                        <Select
                          value={itemField.value}
                          onValueChange={value => {
                            itemField.onChange(value)
                            form.setValue(`items.${index}.destinationRawMaterialId`, '')
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder={t('interVenueTransfers.form.selectMaterial')} /></SelectTrigger>
                          <SelectContent>
                            {(sourceMaterialsQuery.data ?? []).map(material => (
                              <SelectItem key={material.id} value={material.id}>{material.name} · {material.sku}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('interVenueTransfers.form.destinationMaterial')}</Label>
                    <Controller
                      control={form.control}
                      name={`items.${index}.destinationRawMaterialId`}
                      render={({ field: itemField }) => (
                        <Select value={itemField.value} onValueChange={itemField.onChange}>
                          <SelectTrigger><SelectValue placeholder={t('interVenueTransfers.form.selectMaterial')} /></SelectTrigger>
                          <SelectContent>
                            {(destinationOptions ?? []).map(material => (
                              <SelectItem key={material.id} value={material.id}>{material.name} · {material.sku}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {form.formState.errors.items?.[index]?.destinationRawMaterialId?.message && (
                      <p className="text-sm text-destructive">{form.formState.errors.items[index]?.destinationRawMaterialId?.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`transfer-quantity-${index}`}>{t('interVenueTransfers.form.quantity')}</Label>
                    <Input
                      id={`transfer-quantity-${index}`}
                      type="number"
                      min="0.001"
                      step="0.001"
                      {...form.register(`items.${index}.quantity`)}
                    />
                    {selectedSource && <p className="text-xs text-muted-foreground">{selectedSource.unit}</p>}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="self-end cursor-pointer"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                    aria-label={t('interVenueTransfers.form.removeItem')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card data-tour="inter-venue-transfer-notes-section">
          <CardHeader><CardTitle>{t('interVenueTransfers.form.detailsSection')}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="transfer-external-reference">{t('interVenueTransfers.form.externalReference')}</Label>
              <Input id="transfer-external-reference" {...form.register('externalReference')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfer-notes">{t('interVenueTransfers.form.notes')}</Label>
              <Textarea id="transfer-notes" {...form.register('notes')} />
            </div>
          </CardContent>
        </Card>
      </form>
    </FullScreenModal>
  )
}
