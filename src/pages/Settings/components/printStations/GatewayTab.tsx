import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Router, Tablet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { useToast } from '@/hooks/use-toast'
import { useVenueDateTime } from '@/utils/datetime'
import { getGateway, updateGateway, type Gateway } from '@/services/printStations.service'

const FORM_ID = 'gateway-form'

const apiError = (e: any, fallback: string): string =>
  e?.response?.data?.message ?? e?.response?.data?.error ?? fallback

export function GatewayTab({ venueId }: { venueId: string }) {
  const { t } = useTranslation('printStations')
  const { formatDateTime } = useVenueDateTime()
  const [isFormOpen, setFormOpen] = useState(false)

  const { data: gateway, isLoading } = useQuery({
    queryKey: ['printGateway', venueId],
    queryFn: () => getGateway(venueId),
    enabled: !!venueId,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-input bg-muted/40 p-4 text-sm">
        <Router className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <p>{t('gateway.intro')}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> {t('loading')}
        </div>
      ) : !gateway ? (
        <Card className="border-input">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <Tablet className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('gateway.none')}</p>
            <Button onClick={() => setFormOpen(true)} data-tour="print-gateway-set">
              {t('gateway.set')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-input">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Tablet className="h-5 w-5 text-muted-foreground" />
                <span className="text-lg font-semibold">{gateway.terminalId}</span>
                <Badge variant={gateway.active ? 'default' : 'outline'}>
                  {gateway.active ? t('gateway.statusActive') : t('gateway.statusInactive')}
                </Badge>
              </div>
              <Button variant="outline" onClick={() => setFormOpen(true)}>
                {t('gateway.edit')}
              </Button>
            </div>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t('gateway.colAddress')}</dt>
                <dd className="font-mono">{gateway.address ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('gateway.colHeartbeat')}</dt>
                <dd>{gateway.lastHeartbeat ? formatDateTime(gateway.lastHeartbeat) : t('gateway.never')}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      {isFormOpen && <GatewayFormModal venueId={venueId} gateway={gateway ?? null} onClose={() => setFormOpen(false)} />}
    </div>
  )
}

// ── Form modal ────────────────────────────────────────────────────────────────

const gatewaySchema = z.object({
  terminalId: z.string().trim().min(1),
  address: z.string().trim(),
  active: z.boolean(),
})
type GatewayForm = z.infer<typeof gatewaySchema>

function GatewayFormModal({ venueId, gateway, onClose }: { venueId: string; gateway: Gateway | null; onClose: () => void }) {
  const { t } = useTranslation('printStations')
  const { toast } = useToast()
  const qc = useQueryClient()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<GatewayForm>({
    resolver: zodResolver(gatewaySchema),
    defaultValues: {
      terminalId: gateway?.terminalId ?? '',
      address: gateway?.address ?? '',
      active: gateway?.active ?? true,
    },
  })

  const active = watch('active')

  const mutation = useMutation({
    mutationFn: (values: GatewayForm) =>
      updateGateway(venueId, {
        terminalId: values.terminalId.trim(),
        address: values.address.trim() || undefined,
        active: values.active,
      }),
    onSuccess: () => {
      toast({ title: t('gateway.saved') })
      qc.invalidateQueries({ queryKey: ['printGateway', venueId] })
      onClose()
    },
    onError: e => toast({ title: t('errors.title'), description: apiError(e, t('errors.generic')), variant: 'destructive' }),
  })

  return (
    <FullScreenModal
      open
      onClose={onClose}
      title={gateway ? t('gateway.editTitle') : t('gateway.createTitle')}
      contentClassName="bg-muted/30"
      actions={
        <Button type="submit" form={FORM_ID} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {mutation.isPending ? t('actions.saving') : t('actions.save')}
        </Button>
      }
    >
      <form
        id={FORM_ID}
        onSubmit={handleSubmit(values => mutation.mutate(values))}
        className="mx-auto max-w-xl space-y-6 p-4 md:p-6"
      >
        <div className="space-y-5 rounded-2xl border border-border/50 bg-card p-6">
          <div className="space-y-2">
            <Label htmlFor="gateway-terminal">{t('gateway.fields.terminalId')}</Label>
            <Input
              id="gateway-terminal"
              className="h-12 text-base"
              placeholder={t('gateway.fields.terminalIdPlaceholder')}
              {...register('terminalId')}
            />
            {errors.terminalId && <p className="text-xs text-destructive">{t('gateway.validation.terminalRequired')}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="gateway-address">{t('gateway.fields.address')}</Label>
            <Input
              id="gateway-address"
              className="h-12 font-mono text-base"
              placeholder={t('gateway.fields.addressPlaceholder')}
              {...register('address')}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-input p-3">
            <p className="text-sm font-medium">{t('gateway.fields.active')}</p>
            <Switch checked={active} onCheckedChange={v => setValue('active', v, { shouldDirty: true })} />
          </div>
        </div>
      </form>
    </FullScreenModal>
  )
}
