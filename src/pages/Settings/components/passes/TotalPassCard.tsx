import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Info, Loader2, PauseCircle, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getTierDef, getTierForFeature } from '@/config/plan-catalog'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useFeaturePrice } from '@/hooks/use-feature-price'
import { useInvalidatePasses } from '@/hooks/use-passes'
import { useToast } from '@/hooks/use-toast'
import { connectTotalPass, disconnectPassProvider, setPassConfirmMode } from '@/services/passes.service'
import { apiErrorDescription } from '@/utils/apiError'
import type { PassConfirmMode, PassConnectionView, PassIntegrationsOverview } from '@/types/passes'
import { passConnectionIsLive } from './passConnection'
import { ProductLinksEditor } from './ProductLinksEditor'

interface TotalPassCardProps {
  venueId: string
  connection: PassConnectionView
  /** Las clases del negocio (tope de 200 del server) para ligarlas con los planes de TotalPass. */
  classProducts: PassIntegrationsOverview['classProducts']
  canManage: boolean
  /** Pausa suave (R62 del server): el negocio perdió el plan con TotalPass vivo. Sólo el aviso, ver planes y Desconectar. */
  planPaused?: boolean
}

const FEATURE = 'AGGREGATOR_PASSES'

/**
 * Aviso de la pausa por el plan (R62). El botón es el MISMO CTA del paywall (`FeatureGate`): «Mejora a Pro», a
 * Suscripciones, y sólo para quien puede contratar (`canPurchase` = `billing:subscriptions:manage`); a los demás se les dice
 * a quién pedírselo. No pinta el precio, así que `useFeaturePrice` no pide el catálogo (`enabled: false`). Tokens
 * `warning-*` del tema: se leen igual en claro y en oscuro.
 *
 * El texto depende del modo (revisión final, Important 2): sin el plan el server sigue validando con TotalPass —en AUTO
 * se confirman solos; en manual, al marcar la asistencia de la reserva (Reservaciones, POS o kiosco)—, pero confirmar
 * desde la pantalla «Pases» tiene el candado del plan. Prometer «se siguen confirmando» en manual era falso.
 */
function PlanPausedNotice({ confirmMode }: { confirmMode: PassConfirmMode }) {
  const { t } = useTranslation('passes')
  const { fullBasePath } = useCurrentVenue()
  const navigate = useNavigate()
  const { canPurchase } = useFeaturePrice(FEATURE, { enabled: false })
  const def = getTierDef(getTierForFeature(FEATURE) ?? 'PRO')
  const TierIcon = def.icon
  // Igual que FeatureGate: «pro» → «Pro» para la interpolación.
  const tierName = def.key.charAt(0).toUpperCase() + def.key.slice(1)
  return (
    <Alert className="border-warning-border bg-warning-muted text-warning-foreground" data-tour="passes-totalpass-plan-paused">
      <PauseCircle className="h-4 w-4" />
      <AlertDescription className="space-y-2 text-foreground">
        <p>{confirmMode === 'AUTO' ? t('totalpass.planPausedAuto') : t('totalpass.planPausedOnCheckin')}</p>
        {canPurchase ? (
          <Button
            type="button"
            size="sm"
            className="cursor-pointer gap-2"
            onClick={() => navigate(`${fullBasePath}/settings/billing/subscriptions`)}
            data-tour="passes-totalpass-upgrade"
          >
            <TierIcon className="h-4 w-4" />
            {t('billing:featureGate.upgrade', { tier: tierName })}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">{t('billing:featureGate.askOwner')}</p>
        )}
      </AlertDescription>
    </Alert>
  )
}

/**
 * Conectar / configurar / desconectar TotalPass (spec §8). Conectar y desconectar son el SWITCH de la función; el
 * modo de confirmación es el único ajuste con dos clientes reales que quieren lo contrario (D2).
 *
 * Estados (Plan 2a, P2-9): sólo ACTIVE está conectada de verdad —modo y clases exigen ACTIVE en la API—. PAUSED y
 * REVOKED se arreglan pegando otra llave (connect hace upsert sobre la misma sucursal). Una REVOKED por 401 conserva
 * sucursal y credencial y Desconectar las limpia; una REVOKED ya limpia es «sin conectar». Se distinguen por `lastError`
 * (el 401 lo escribe y desconectar lo borra), NO por `externalPlaceName`, que desconectar deja puesto (C1).
 * Desconectar algo que no está ACTIVE no se bloquea (R41 del server), pero sin una llave que funcione Avoqado no puede
 * quitar las clases de TotalPass: el diálogo lo avisa (C4). Una ACTIVE con clases ligadas responde 409
 * `PASS_DISCONNECT_UNLINKING` (R65): el server ya las está quitando y pide volver a presionar; es avance, no error, así que
 * se avisa en neutro y se refresca la vista (R2b-1). `PASS_DISCONNECT_BLOCKED` (socios próximos) sí es rechazo.
 *
 * `planPaused` (R62, pausa suave): sin el plan el server no publica clases nuevas y conectar, modo, clases y lugares
 * siguen con candado; Desconectar no. La tarjeta sólo explica la pausa (con el CTA del paywall) y deja Desconectar.
 *
 * Los errores del servidor se muestran TAL CUAL y en la tarjeta (no en un toast que se va): el dueño tiene que leer
 * «TotalPass no reconoce esa llave…» o «2 reservas de socios próximas…» para saber qué hacer.
 */
export function TotalPassCard({ venueId, connection, classProducts, canManage, planPaused = false }: TotalPassCardProps) {
  const { t } = useTranslation('passes')
  const { toast } = useToast()
  const invalidate = useInvalidatePasses()
  const [key, setKey] = useState('')
  const [keyError, setKeyError] = useState<string | null>(null)
  // Oculta por default; el ojo la enseña para encontrar el carácter que sobra (revisión final, Minor 7).
  const [showKey, setShowKey] = useState(false)
  // R2b-18: ya conectada, el dueño puede volver a pegar la llave (conectar la MISMA sucursal hace upsert y re-lee los planes).
  const [rekeyOpen, setRekeyOpen] = useState(false)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  // Lo que contestó el último Desconectar: `unlinking` = el server ya está quitando las clases (aviso neutral), si no, error.
  const [disconnectResult, setDisconnectResult] = useState<{ text: string; unlinking: boolean } | null>(null)
  // Ese resultado habla de la conexión de ESE momento: si el server ya trae otra (otro estado, o guardada de nuevo), sobra.
  // Un refetch igual no la cambia: el «Vuelve a presionar…» de UNLINKING sólo desliga clases y no toca la conexión.
  useEffect(() => setDisconnectResult(null), [connection.status, connection.updatedAt])

  const active = connection.status === 'ACTIVE'
  const paused = connection.status === 'PAUSED'
  const pending = connection.status === 'PENDING'
  // REVOKED con algo que limpiar = la revocó un 401, que deja `lastError`. NO `externalPlaceName`: desconectar no lo borra (C1).
  const revokedWithLeftovers = connection.status === 'REVOKED' && !!connection.lastError
  // ACTIVE, PAUSED, PENDING (un conectar a medias que ya reservó la sucursal: si no, «Desconéctala primero» no tiene
  // salida) o REVOKED con algo que limpiar. Mismo criterio con el que la página decide la pausa por el plan.
  const canDisconnect = passConnectionIsLive(connection)

  // Cada onSuccess DEVUELVE la invalidación: isPending dura hasta que el overview nuevo llegó (P2-8). Los onError también
  // recargan la vista (H1): aunque la petición falle, el server pudo haber cambiado de estado (un conectar que reservó la
  // sucursal y quedó PENDING, uno interrumpido que quedó REVOKED, una conexión revocada en segundo plano al cambiar el modo).
  const connect = useMutation({
    mutationFn: () => connectTotalPass(venueId, key),
    onSuccess: () => {
      setKey('')
      setKeyError(null)
      setShowKey(false)
      setRekeyOpen(false)
      toast({ title: t('totalpass.connected') })
      return invalidate(venueId, 'connection')
    },
    // La llave tecleada se conserva: casi siempre el arreglo es «quítale un carácter», no «vuélvela a pegar».
    onError: (error: unknown) => {
      setKeyError(apiErrorDescription(error) || t('errors.generic'))
      return invalidate(venueId, 'connection')
    },
  })
  const mode = useMutation({
    mutationFn: (confirmMode: PassConfirmMode) => setPassConfirmMode(venueId, 'TOTALPASS', confirmMode),
    onSuccess: () => {
      toast({ title: t('totalpass.mode.saved') })
      return invalidate(venueId, 'connection')
    },
    onError: (error: unknown) => {
      toast({ variant: 'destructive', title: apiErrorDescription(error) || t('errors.generic') })
      return invalidate(venueId, 'connection')
    },
  })
  const disconnect = useMutation({
    mutationFn: () => disconnectPassProvider(venueId, 'TOTALPASS'),
    onMutate: () => setDisconnectResult(null),
    onSuccess: () => {
      setDisconnectOpen(false)
      // El error de un conectar anterior («Desconéctala primero»…) ya no aplica (H2).
      setKeyError(null)
      toast({ title: t('totalpass.disconnected') })
      return invalidate(venueId, 'connection')
    },
    onError: (error: unknown) => {
      setDisconnectOpen(false)
      const text = apiErrorDescription(error) || t('errors.generic')
      const code = (error as { response?: { data?: { code?: unknown } } } | null)?.response?.data?.code
      setDisconnectResult({ text, unlinking: code === 'PASS_DISCONNECT_UNLINKING' })
      // Siempre se refresca (H1): con UNLINKING las clases ya se desligaron en esa llamada; con otro error el server pudo
      // haber cambiado igual (p. ej. revocó y la respuesta se perdió). El botón espera a que lleguen los datos (P2-8).
      return invalidate(venueId, 'connection')
    },
  })

  // Una sola mutación en vuelo por tarjeta: dos escrituras encimadas se pisarían con valores viejos.
  const disabled = !canManage || connect.isPending || mode.isPending || disconnect.isPending
  // Mientras guarda, el selector y su consecuencia enseñan lo elegido, no el valor viejo (H4).
  const confirmMode = mode.isPending ? (mode.variables ?? connection.confirmMode) : connection.confirmMode

  const badge = planPaused ? (
    <Badge variant="secondary" className="gap-1">
      <PauseCircle className="h-3 w-3" />
      {t('totalpass.status.planPaused')}
    </Badge>
  ) : active ? (
    <Badge variant="default" className="gap-1">
      <CheckCircle2 className="h-3 w-3" />
      {t('totalpass.status.connected')}
    </Badge>
  ) : paused ? (
    <Badge variant="secondary" className="gap-1">
      <PauseCircle className="h-3 w-3" />
      {t('totalpass.status.paused')}
    </Badge>
  ) : revokedWithLeftovers ? (
    <Badge variant="destructive" className="gap-1">
      <AlertTriangle className="h-3 w-3" />
      {t('totalpass.status.revoked')}
    </Badge>
  ) : (
    <Badge variant="secondary" className="gap-1">
      <XCircle className="h-3 w-3" />
      {t('totalpass.status.notConnected')}
    </Badge>
  )

  // El motivo que dejó el server. H6: el de un conectar a medias se dice en claro, con el texto técnico abajo, chico, para
  // soporte. Lo usan el formulario y la pausa por el plan (que no tiene formulario, pero el dueño debe saber que además la
  // llave está rechazada antes de mejorar el plan).
  const lastErrorBlock = !connection.lastError ? null : pending ? (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <p>{t('totalpass.pendingHint')}</p>
        <p className="text-xs text-muted-foreground">{connection.lastError}</p>
      </AlertDescription>
    </Alert>
  ) : (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>{connection.lastError}</AlertDescription>
    </Alert>
  )

  // El mismo formulario conecta y, ya conectada, vuelve a pegar la llave (R2b-18). En ese caso el `lastError` de la conexión
  // ya se ve arriba y hay un Cancelar.
  const keyForm = (
    <form
      className="space-y-3"
      onSubmit={e => {
        e.preventDefault()
        if (key.trim()) connect.mutate()
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="totalpass-key">{t('totalpass.keyLabel')}</Label>
        <div className="relative">
          <Input
            id="totalpass-key"
            type={showKey ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder={t('totalpass.keyPlaceholder')}
            value={key}
            onChange={e => setKey(e.target.value)}
            disabled={disabled}
            className="pr-10"
            data-tour="passes-totalpass-key"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full cursor-pointer text-muted-foreground hover:text-foreground"
            onClick={() => setShowKey(v => !v)}
            disabled={disabled}
            aria-label={t('totalpass.showKey')}
            aria-pressed={showKey}
            data-tour="passes-totalpass-key-show"
          >
            {showKey ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t('totalpass.keyHint')}</p>
      </div>
      {keyError ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{keyError}</AlertDescription>
        </Alert>
      ) : active ? null : (
        lastErrorBlock
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={disabled || !key.trim()} data-tour="passes-totalpass-connect">
          {connect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {connect.isPending ? t('totalpass.connecting') : t('totalpass.connect')}
        </Button>
        {active && (
          <Button
            type="button"
            variant="ghost"
            disabled={connect.isPending}
            onClick={() => {
              setRekeyOpen(false)
              setKey('')
              setKeyError(null)
              setShowKey(false)
            }}
            data-tour="passes-totalpass-rekey-cancel"
          >
            {t('common:cancel')}
          </Button>
        )}
      </div>
    </form>
  )

  const place = (
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">{t('totalpass.place')}</p>
      <p className="text-sm text-muted-foreground">{connection.externalPlaceName ?? '—'}</p>
    </div>
  )

  return (
    <>
      <Card className="border-input shadow-sm" data-tour="passes-totalpass-card">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">{t('totalpass.title')}</CardTitle>
            {badge}
          </div>
          <CardDescription>{t('totalpass.description')}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* R62: sin plan, sólo la sucursal, el aviso con el CTA, el motivo si la llave falló y (abajo) Desconectar. Llave,
              modo y clases tienen candado. */}
          {planPaused && (
            <>
              {place}
              <PlanPausedNotice confirmMode={connection.confirmMode} />
              {lastErrorBlock}
            </>
          )}

          {!planPaused && (paused || revokedWithLeftovers) && (
            <div className="space-y-1">
              {place}
              <p className="text-xs text-muted-foreground">
                {paused ? t('totalpass.pausedHint') : t('totalpass.revokedHint', { place: connection.externalPlaceName ?? '—' })}
              </p>
            </div>
          )}

          {planPaused ? null : !active ? (
            keyForm
          ) : (
            <>
              {place}

              {connection.lastError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{connection.lastError}</AlertDescription>
                </Alert>
              )}

              {canManage &&
                (rekeyOpen ? (
                  keyForm
                ) : (
                  <div className="space-y-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={disabled}
                      onClick={() => setRekeyOpen(true)}
                      data-tour="passes-totalpass-rekey"
                    >
                      {t('totalpass.rekey')}
                    </Button>
                    <p className="text-xs text-muted-foreground">{t('totalpass.rekeyHint')}</p>
                  </div>
                ))}

              <div className="space-y-1.5">
                <Label htmlFor="totalpass-mode">{t('totalpass.mode.label')}</Label>
                <Select value={confirmMode} disabled={disabled} onValueChange={value => mode.mutate(value as PassConfirmMode)}>
                  <SelectTrigger id="totalpass-mode" data-tour="passes-totalpass-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUTO">{t('totalpass.mode.auto')}</SelectItem>
                    <SelectItem value="ON_VENUE_CHECKIN">{t('totalpass.mode.onCheckin')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {confirmMode === 'AUTO' ? t('totalpass.mode.autoHint') : t('totalpass.mode.onCheckinHint')}
                </p>
              </div>

              <ProductLinksEditor
                venueId={venueId}
                provider="TOTALPASS"
                plans={connection.plans}
                productLinks={connection.productLinks}
                classProducts={classProducts}
                canManage={canManage}
              />
            </>
          )}

          {canDisconnect && (
            <>
              {disconnectResult &&
                (disconnectResult.unlinking ? (
                  <Alert className="border-input bg-muted/40">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-foreground">{disconnectResult.text}</AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{disconnectResult.text}</AlertDescription>
                  </Alert>
                ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => {
                  setDisconnectResult(null)
                  setDisconnectOpen(true)
                }}
                data-tour="passes-totalpass-disconnect"
              >
                {t('totalpass.disconnect')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning-foreground" />
              {t('totalpass.disconnectTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('totalpass.disconnectBody')}</AlertDialogDescription>
            {/* C4: sin una llave que funcione el server desliga aquí, pero no puede quitar lo publicado en TotalPass (R41) */}
            {!active && <p className="text-sm font-medium text-foreground">{t('totalpass.disconnectNoKey')}</p>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => disconnect.mutate()} data-tour="passes-totalpass-disconnect-confirm">
              {t('totalpass.disconnectConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
