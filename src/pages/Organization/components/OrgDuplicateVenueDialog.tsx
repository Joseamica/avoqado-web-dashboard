/**
 * «Duplicar tienda»: el dueño de la organización crea una tienda nueva copiando la configuración de otra suya
 * (cobro, tarifa, inventario de SIMs, ajustes y la gente de la organización). Vive en las dos listas de tiendas del
 * dueño: `OrganizationVenues` y la de marca blanca `TiendasList`.
 *
 * El SERVIDOR decide todo (módulo por organización, dueño, número repetido, modelo activa). Aquí sólo: el botón se ve
 * si el módulo está prendido, «Crear tienda» se apaga hasta tener todo o si el número ya existe, una llave por apertura
 * para que un reintento no cree dos tiendas, y el mensaje del servidor dentro de la ventana sin cerrarla.
 */
import { AddressAutocomplete, type PlaceDetails } from '@/components/address-autocomplete'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AUTH_STATUS_QUERY_KEY } from '@/services/auth.service'
import { mensajeDelServidor4xx } from '@/utils/apiError'
import {
  duplicateVenue,
  getVenueDuplicationOptions,
  type DuplicatedVenue,
  type DuplicateVenueBody,
  type VenueDuplicationOptions,
} from '@/services/organization.service'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Copy, Loader2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { nombreChoca } from './venueDuplication.rules'

const optionsKey = (orgId: string) => ['organization', 'venue-duplication-options', orgId] as const

/** Botón «Duplicar tienda» + su ventana. No pinta nada si el módulo está apagado o la consulta falla. */
export function OrgDuplicateVenue({
  orgId,
  existingNames,
  onCreated,
}: {
  orgId: string | null | undefined
  /** Nombres de las tiendas de la organización, para avisar del número repetido antes de enviar. */
  existingNames: string[]
  onCreated: (venue: DuplicatedVenue) => void
}) {
  const { t } = useTranslation('organization')
  const [open, setOpen] = useState(false)
  const { data } = useQuery({
    queryKey: optionsKey(orgId ?? ''),
    queryFn: () => getVenueDuplicationOptions(orgId!),
    enabled: !!orgId,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  if (!orgId || !data?.enabled) return null

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} data-tour="org-duplicate-venue">
        <Copy className="h-4 w-4 mr-2" />
        {t('venues.duplicate.button')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent hasTitle className="max-w-lg">
          {/* Se monta en cada apertura: estado y llave nuevos cada vez. */}
          <DuplicateVenueForm
            orgId={orgId}
            options={data}
            existingNames={existingNames}
            onCancel={() => setOpen(false)}
            onCreated={venue => {
              setOpen(false)
              onCreated(venue)
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

function DuplicateVenueForm({
  orgId,
  options,
  existingNames,
  onCancel,
  onCreated,
}: {
  orgId: string
  options: VenueDuplicationOptions
  existingNames: string[]
  onCancel: () => void
  onCreated: (venue: DuplicatedVenue) => void
}) {
  const { t } = useTranslation('organization')
  const queryClient = useQueryClient()
  // Una llave por apertura: el reintento de ESTA ventana no crea otra tienda.
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [templateVenueId, setTemplateVenueId] = useState('')
  const [name, setName] = useState('')
  const [addressText, setAddressText] = useState('')
  const [place, setPlace] = useState<PlaceDetails | null>(null)
  const [supervisorStaffId, setSupervisorStaffId] = useState('')

  const template = options.templates.find(v => v.id === templateVenueId)
  const trimmedName = name.trim()
  const clash = useMemo(() => (trimmedName ? nombreChoca(trimmedName, existingNames) : { choca: false as const }), [trimmedName, existingNames])
  const placeComplete =
    !!place && !!place.address && !!place.city && !!place.state && !!place.zipCode && !(place.latitude === 0 && place.longitude === 0)

  const mutation = useMutation({
    mutationFn: (body: DuplicateVenueBody) => duplicateVenue(orgId, body),
    onSuccess: venue => {
      queryClient.invalidateQueries({ queryKey: ['organization', 'venues', orgId] })
      queryClient.invalidateQueries({ queryKey: optionsKey(orgId) })
      // La tienda nueva entra a «mis tiendas» del usuario: sin esto los enlaces de los pendientes no la conocen.
      queryClient.invalidateQueries({ queryKey: AUTH_STATUS_QUERY_KEY })
      onCreated(venue)
    },
  })

  const canSubmit = !!template && trimmedName.length >= 3 && !clash.choca && placeComplete && !!supervisorStaffId && !mutation.isPending

  const submit = () => {
    if (!canSubmit || !place) return
    mutation.mutate({
      idempotencyKey,
      templateVenueId,
      name: trimmedName,
      address: {
        address: place.address,
        city: place.city,
        state: place.state,
        zipCode: place.zipCode,
        ...(place.country ? { country: place.country } : {}),
        latitude: place.latitude,
        longitude: place.longitude,
      },
      supervisorStaffId,
    })
  }

  // El `message` de un 4xx tal cual (número repetido, módulo apagado…). `{ error: 'owner_required' }` es un código, no un
  // texto: cae al genérico.
  const serverError = mutation.isError ? mensajeDelServidor4xx(mutation.error) ?? t('venues.duplicate.errorGeneric') : null

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('venues.duplicate.title')}</DialogTitle>
        <DialogDescription>{t('venues.duplicate.description')}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="duplicate-venue-template">{t('venues.duplicate.template')}</Label>
          <Select name="template" value={templateVenueId} onValueChange={setTemplateVenueId}>
            <SelectTrigger id="duplicate-venue-template">
              <SelectValue placeholder={t('venues.duplicate.templatePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {options.templates.map(v => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {options.templates.length ? t('venues.duplicate.templateHint') : t('venues.duplicate.noTemplates')}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="duplicate-venue-name">{t('venues.duplicate.name')}</Label>
          <Input
            id="duplicate-venue-name"
            value={name}
            maxLength={120}
            onChange={e => setName(e.target.value)}
            placeholder={t('venues.duplicate.namePlaceholder')}
            aria-invalid={clash.choca}
          />
          {clash.choca && (
            <p className="text-xs text-destructive">
              {clash.numero ? t('venues.duplicate.numberTaken', { numero: clash.numero }) : t('venues.duplicate.nameTaken')}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>{t('venues.duplicate.address')}</Label>
          <AddressAutocomplete
            value={addressText}
            placeholder={t('venues.duplicate.addressPlaceholder')}
            onAddressSelect={p => {
              setPlace(p)
              setAddressText(p.address)
            }}
            onTextChange={texto => {
              setAddressText(texto)
              setPlace(null)
            }}
          />
          {place && placeComplete && (
            <p className="text-xs text-muted-foreground">{[place.city, place.state, place.zipCode].join(', ')}</p>
          )}
          {place && place.address && !placeComplete && <p className="text-xs text-destructive">{t('venues.duplicate.addressIncomplete')}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="duplicate-venue-supervisor">{t('venues.duplicate.supervisor')}</Label>
          <Select name="supervisor" value={supervisorStaffId} onValueChange={setSupervisorStaffId}>
            <SelectTrigger id="duplicate-venue-supervisor">
              <SelectValue placeholder={t('venues.duplicate.supervisorPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {options.supervisors.map(s => (
                <SelectItem key={s.staffId} value={s.staffId}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!options.supervisors.length && <p className="text-xs text-muted-foreground">{t('venues.duplicate.noSupervisors')}</p>}
        </div>

        {template && (
          <div className="rounded-lg border border-dashed border-input bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            <p>{t('venues.duplicate.copied', { template: template.name })}</p>
            <p>{t('venues.duplicate.notEditable')}</p>
          </div>
        )}

        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={mutation.isPending}>
          {t('venues.duplicate.cancel')}
        </Button>
        <Button type="button" onClick={submit} disabled={!canSubmit}>
          {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {t('venues.duplicate.create')}
        </Button>
      </DialogFooter>
    </>
  )
}

/** Aviso de éxito arriba de la lista, con los dos pendientes para empezar a vender. */
export function DuplicatedVenueNotice({
  venue,
  venueBasePath,
  onDismiss,
}: {
  venue: DuplicatedVenue
  /** '/venues' o '/wl/venues', según la lista desde la que se creó. */
  venueBasePath: string
  onDismiss: () => void
}) {
  const { t } = useTranslation('organization')
  const base = `${venueBasePath}/${venue.slug}`
  return (
    <div role="status" className="relative rounded-xl border border-input bg-card p-4 text-sm">
      <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2 h-7 w-7" onClick={onDismiss} aria-label={t('venues.duplicate.dismiss')}>
        <X className="h-4 w-4" />
      </Button>
      <p className="flex items-center gap-2 font-medium text-foreground">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        {t('venues.duplicate.success', { name: venue.name })}
      </p>
      <p className="mt-2 text-muted-foreground">{t('venues.duplicate.pendingTitle')}</p>
      <ul className="mt-1 space-y-1">
        <li>
          <Link to={`${base}/devices`} className="text-foreground underline-offset-4 hover:underline">
            {t('venues.duplicate.pendingTpv')} → {t('venues.duplicate.pendingTpvLink')}
          </Link>
        </li>
        <li>
          <Link to={`${base}/team`} className="text-foreground underline-offset-4 hover:underline">
            {t('venues.duplicate.pendingTeam')} → {t('venues.duplicate.pendingTeamLink')}
          </Link>
        </li>
      </ul>
    </div>
  )
}
