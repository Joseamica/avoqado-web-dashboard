import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import type { FilaDePromotor } from '@/services/celularesDeCampo.service'
import { updateOrgTeamMemberPin } from '@/services/organizationConfig.service'
import { teamService } from '@/services/team.service'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Eye, EyeOff, KeyRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { mensajeDelServidor, sucursalDelPin, tienePin, useUnaALaVez } from '../ayudantes'

const PIN_VALIDO = /^\d{4,6}$/

interface PinModalProps {
  orgId: string
  /** Montada en la sucursal (A7): el PIN va por el equipo de la sucursal. Sin él, por la organización (dueño). */
  venueIdInicial?: string
  fila: FilaDePromotor | null
  onClose: () => void
}

export function PinModal({ orgId, venueIdInicial, fila, onClose }: PinModalProps) {
  const { t } = useTranslation('organization')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const unaALaVez = useUnaALaVez()
  const [pin, setPin] = useState('')
  const [verPin, setVerPin] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [venueElegido, setVenueElegido] = useState<string | undefined>(undefined)

  useEffect(() => {
    setPin('')
    setVerPin(false)
    setAviso(null)
    setVenueElegido(fila && venueIdInicial ? sucursalDelPin(fila, venueIdInicial)?.venueId : undefined)
  }, [fila, venueIdInicial])

  const enSucursal = !!venueIdInicial
  const sucursal = fila && enSucursal ? fila.sucursales.find(s => s.venueId === venueElegido) : undefined

  const mutation = useMutation({
    mutationFn: async (nuevo: string): Promise<{ warning?: string | null }> => {
      if (!fila) return {}
      if (enSucursal) {
        if (!sucursal) throw new Error(t('celulares.pin.sinSucursal', { defaultValue: 'Esta persona no tiene sucursal.' }))
        await teamService.updateTeamMember(sucursal.venueId, sucursal.staffVenueId, { pin: nuevo })
        return {}
      }
      return updateOrgTeamMemberPin(orgId, fila.staffId, nuevo)
    },
    onSuccess: res => {
      queryClient.invalidateQueries({ queryKey: ['celulares-de-campo', orgId] })
      queryClient.invalidateQueries({ queryKey: ['org-config', orgId, 'team'] })
      if (res.warning) {
        // El aviso del servidor (p. ej. una sucursal donde el PIN ya era de otra persona) se lee aquí, no en un toast que se va.
        setAviso(res.warning)
        return
      }
      toast({ title: t('celulares.pin.guardado', { defaultValue: 'PIN guardado' }) })
      onClose()
    },
    onError: err => {
      toast({
        variant: 'destructive',
        title: t('celulares.pin.error', { defaultValue: 'No se pudo guardar el PIN' }),
        description: mensajeDelServidor(err),
      })
    },
  })

  const pinValido = PIN_VALIDO.test(pin)
  const titulo =
    fila && tienePin(fila, venueIdInicial)
      ? t('celulares.acciones.cambiarPin', { defaultValue: 'Cambiar PIN' })
      : t('celulares.acciones.ponerPin', { defaultValue: 'Poner PIN' })

  return (
    <FullScreenModal
      open={!!fila}
      onClose={() => !mutation.isPending && onClose()}
      title={titulo}
      subtitle={fila?.nombre}
      contentClassName="bg-muted/30"
      actions={
        aviso ? (
          <Button onClick={onClose}>{t('celulares.cerrar', { defaultValue: 'Cerrar' })}</Button>
        ) : (
          <Button
            data-tour="celulares-pin-guardar"
            disabled={!pinValido || mutation.isPending || (enSucursal && !sucursal)}
            onClick={() => void unaALaVez(() => mutation.mutateAsync(pin))}
          >
            {t('celulares.pin.guardar', { defaultValue: 'Guardar PIN' })}
          </Button>
        )
      }
    >
      <div className="mx-auto max-w-xl p-6">
        <div className="rounded-2xl border border-border/50 bg-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">{t('celulares.pin.label', { defaultValue: 'PIN de 4 a 6 dígitos' })}</h3>
          </div>

          {enSucursal && fila && fila.sucursales.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {t('celulares.pin.sucursal', { defaultValue: 'Cada sucursal tiene su PIN. ¿En cuál?' })}
              </p>
              <div className="flex flex-wrap gap-2">
                {fila.sucursales.map(s => (
                  <Button
                    key={s.venueId}
                    type="button"
                    size="sm"
                    variant={s.venueId === venueElegido ? 'default' : 'outline'}
                    className="rounded-full cursor-pointer"
                    onClick={() => setVenueElegido(s.venueId)}
                  >
                    {s.nombre}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="relative max-w-[240px]">
            <Input
              data-tour="celulares-pin-input"
              aria-label={t('celulares.pin.label', { defaultValue: 'PIN de 4 a 6 dígitos' })}
              type={verPin ? 'text' : 'password'}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              maxLength={6}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={!!aviso}
              className="h-12 text-base font-mono pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 cursor-pointer"
              onClick={() => setVerPin(v => !v)}
              aria-label={
                verPin
                  ? t('celulares.pin.ocultar', { defaultValue: 'Ocultar PIN' })
                  : t('celulares.pin.mostrar', { defaultValue: 'Mostrar PIN' })
              }
            >
              {verPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {enSucursal
              ? t('celulares.pin.ayudaSucursal', {
                  sucursal: sucursal?.nombre ?? '',
                  defaultValue: 'Con este PIN la persona abre la app de campo en {{sucursal}}.',
                })
              : t('celulares.pin.ayuda', { defaultValue: 'Con este PIN la persona abre la app de campo en todas sus sucursales.' })}
          </p>

          {aviso && (
            <div role="status" className="flex gap-2 rounded-lg border border-input bg-muted p-3 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">{t('celulares.pin.guardadoConAviso', { defaultValue: 'PIN guardado, con un aviso:' })}</p>
                <p className="text-muted-foreground">{aviso}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </FullScreenModal>
  )
}
