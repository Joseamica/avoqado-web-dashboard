import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { CheckCircle2, Copy, ExternalLink, Loader2, MessageCircle, Power, RefreshCcw } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import {
  deactivateVenueChat,
  generateActivation,
  getVenueChatStatus,
  type ActivationGenerationResult,
  type VenueChatStatus,
} from '@/services/venueChat.service'

const CENTRAL_NUMBER = (import.meta.env.VITE_WHATSAPP_CENTRAL_NUMBER as string | undefined) ?? '+525667976805'

export default function VenueChat() {
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [freshActivation, setFreshActivation] = useState<ActivationGenerationResult | null>(null)

  const statusQuery = useQuery<VenueChatStatus>({
    queryKey: ['venue', venueId, 'chat-status'],
    queryFn: () => getVenueChatStatus(venueId as string),
    enabled: !!venueId,
    refetchInterval: 5000,
  })

  const generateMutation = useMutation({
    mutationFn: () => generateActivation(venueId as string),
    onSuccess: result => {
      setFreshActivation(result)
      qc.invalidateQueries({ queryKey: ['venue', venueId, 'chat-status'] })
    },
    onError: () => {
      toast({ title: 'No se pudo generar el código', variant: 'destructive' })
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: () => deactivateVenueChat(venueId as string),
    onSuccess: () => {
      setFreshActivation(null)
      qc.invalidateQueries({ queryKey: ['venue', venueId, 'chat-status'] })
      toast({ title: 'Chat desactivado', description: 'Los clientes ya no podrán escribirte por este canal.' })
    },
    onError: () => {
      toast({ title: 'No se pudo desactivar el chat', variant: 'destructive' })
    },
  })

  if (!venueId) return null
  if (statusQuery.isLoading || !statusQuery.data) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  const status = statusQuery.data

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <header>
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <MessageCircle className="h-6 w-6" /> Chat con clientes
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Responde desde tu WhatsApp los mensajes que envíen los clientes desde la página del booking.
        </p>
      </header>

      {status.mode === 'RELAY' ? (
        <ActiveChatPanel status={status} onDeactivate={() => deactivateMutation.mutate()} isDeactivating={deactivateMutation.isPending} />
      ) : status.mode === 'DISABLED' ? (
        <DisabledPanel />
      ) : (
        <FallbackPanel
          status={status}
          freshActivation={freshActivation}
          onGenerate={() => generateMutation.mutate()}
          isGenerating={generateMutation.isPending}
          onDismissFresh={() => setFreshActivation(null)}
        />
      )}
    </div>
  )
}

function ActiveChatPanel({
  status,
  onDeactivate,
  isDeactivating,
}: {
  status: VenueChatStatus
  onDeactivate: () => void
  isDeactivating: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-700">
          <CheckCircle2 className="h-5 w-5" /> Chat activo
        </CardTitle>
        <CardDescription>Los clientes pueden escribirte desde el booking y tú respondes desde WhatsApp.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Tu WhatsApp conectado</dt>
            <dd className="font-medium">{status.optInPhone}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Activado el</dt>
            <dd className="font-medium">
              {status.optInAt ? new Date(status.optInAt).toLocaleString('es-MX') : '—'}
            </dd>
          </div>
        </dl>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={isDeactivating}>
              <Power className="mr-2 h-4 w-4" />
              {isDeactivating ? 'Desactivando…' : 'Desactivar chat'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Desactivar el chat con clientes?</AlertDialogTitle>
              <AlertDialogDescription>
                Los clientes ya no podrán enviarte mensajes por este canal. Las conversaciones abiertas se cerrarán. Puedes reactivarlo
                cuando quieras generando un nuevo código.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onDeactivate}>Sí, desactivar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}

function DisabledPanel() {
  return (
    <Alert>
      <AlertTitle>Necesitas un teléfono en tu venue antes de activar el chat</AlertTitle>
      <AlertDescription>
        Configura el teléfono principal del venue en la pestaña <strong>Contacto e Imágenes</strong>. Ese número se usa como
        fallback cuando el chat está apagado.
      </AlertDescription>
    </Alert>
  )
}

function FallbackPanel({
  status,
  freshActivation,
  onGenerate,
  isGenerating,
  onDismissFresh,
}: {
  status: VenueChatStatus
  freshActivation: ActivationGenerationResult | null
  onGenerate: () => void
  isGenerating: boolean
  onDismissFresh: () => void
}) {
  const pending = freshActivation
    ? { token: freshActivation.token, last4: freshActivation.last4, expiresAt: freshActivation.expiresAt }
    : status.pendingActivation
    ? { token: null, last4: status.pendingActivation.tokenLast4, expiresAt: status.pendingActivation.expiresAt }
    : null

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Activa el chat para responder más rápido</CardTitle>
          <CardDescription>
            Cuando lo actives, los clientes podrán escribirte desde la página de booking y tú les respondes desde tu WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pending ? (
            <ActivationPanel pending={pending} onRegenerate={onGenerate} isGenerating={isGenerating} onDismissFresh={freshActivation ? onDismissFresh : undefined} />
          ) : (
            <Button onClick={onGenerate} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
              {isGenerating ? 'Generando…' : 'Activar chat'}
            </Button>
          )}
          {status.fallbackPhone && (
            <p className="text-xs text-muted-foreground">
              Mientras tanto, los clientes pueden contactarte por WhatsApp directo al <strong>{status.fallbackPhone}</strong>.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ActivationPanel({
  pending,
  onRegenerate,
  isGenerating,
  onDismissFresh,
}: {
  pending: { token: string | null; last4: string; expiresAt: string }
  onRegenerate: () => void
  isGenerating: boolean
  onDismissFresh?: () => void
}) {
  const { toast } = useToast()
  const waUrl = pending.token
    ? `https://wa.me/${CENTRAL_NUMBER.replace(/\D/g, '')}?text=${encodeURIComponent(`ACTIVAR ${pending.token}`)}`
    : null
  const expiresAtDate = new Date(pending.expiresAt)
  const minutesLeft = Math.max(0, Math.round((expiresAtDate.getTime() - Date.now()) / 60000))

  const copyToken = async () => {
    if (!pending.token) return
    await navigator.clipboard.writeText(`ACTIVAR ${pending.token}`)
    toast({ title: 'Copiado', description: 'Pega el mensaje en tu WhatsApp para activar.' })
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTitle>Escanea o toca para activar</AlertTitle>
        <AlertDescription>
          {pending.token ? (
            <>Envía el mensaje desde el WhatsApp del venue al número central de Avoqado para conectar este chat.</>
          ) : (
            <>
              Ya generaste un código (termina en <code>…{pending.last4}</code>). Si lo perdiste, genera uno nuevo abajo.
            </>
          )}
        </AlertDescription>
      </Alert>

      {waUrl && (
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <div className="rounded-lg border bg-card p-3">
            <QRCodeSVG value={waUrl} size={180} bgColor="#ffffff" fgColor="#000000" />
          </div>
          <div className="space-y-3 flex-1">
            <div>
              <p className="text-xs text-muted-foreground">Número central</p>
              <p className="font-medium">{CENTRAL_NUMBER}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Código</p>
              <p className="font-mono text-sm">ACTIVAR {pending.token}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Expira en ~{minutesLeft} minuto{minutesLeft === 1 ? '' : 's'} (
              {expiresAtDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}).
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button asChild size="sm">
                <a href={waUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> Abrir en mi celular
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={copyToken}>
                <Copy className="mr-2 h-4 w-4" /> Copiar mensaje
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t">
        <Button variant="outline" size="sm" onClick={onRegenerate} disabled={isGenerating}>
          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
          Generar código nuevo
        </Button>
        {onDismissFresh && (
          <Button variant="ghost" size="sm" onClick={onDismissFresh}>
            Ocultar
          </Button>
        )}
      </div>
    </div>
  )
}
