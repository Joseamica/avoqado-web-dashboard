/**
 * «Activar cobros» en el Home — la puerta para cobrar con tarjeta (§4.2).
 *
 * 🔴 NO se puede descartar, a diferencia de `HomeSetupChecklist`. Sí se puede contraer, y ese
 * estado vive en `localStorage`. El motivo de apartarse del checklist normal es simple: sin esto
 * el negocio no puede cobrar con tarjeta, y un «no me lo enseñes más» lo dejaría sin entender por
 * qué nunca le llega su dinero.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, ChevronUp, Lock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { paymentActivationService, type PaymentActivationStatus } from '@/services/paymentActivation.service'
import { cn } from '@/lib/utils'
import { StaffRole } from '@/types'

const CLAVE_CONTRAIDO = 'avq_payment_activation_collapsed'

type ItemId = 'profile' | 'documents' | 'online' | 'terminal'

function leerContraido(): boolean {
  try {
    return window.localStorage?.getItem(CLAVE_CONTRAIDO) === '1'
  } catch {
    return false
  }
}

export function PaymentActivationCard() {
  const { t } = useTranslation('home')
  const navigate = useNavigate()
  const { fullBasePath, venueId, venue } = useCurrentVenue()
  const { user } = useAuth()
  const [contraido, setContraido] = useState(leerContraido)

  const rol = (venue as { role?: string } | null)?.role ?? user?.role
  const esDueño = rol === StaffRole.OWNER || rol === StaffRole.ADMIN || rol === StaffRole.SUPERADMIN

  const { data } = useQuery<PaymentActivationStatus | null>({
    queryKey: ['payment-activation', venueId],
    queryFn: async () => {
      const res = await paymentActivationService.get(venueId!)
      return (res.data?.data ?? null) as PaymentActivationStatus | null
    },
    enabled: !!venueId && esDueño,
    retry: false,
  })

  const kycStatus = data?.kycStatus ?? (venue as { kycStatus?: string } | null)?.kycStatus ?? null
  const kycEnviado = kycStatus === 'PENDING_REVIEW' || kycStatus === 'IN_REVIEW' || kycStatus === 'VERIFIED'

  const items = useMemo(
    () =>
      [
        {
          id: 'profile' as ItemId,
          titulo: t('paymentActivation.items.profile', { defaultValue: 'Datos fiscales, dirección y cuenta para depósitos' }),
          destino: 'activar-cobros',
          hecho: !!data?.profile?.complete,
          bloqueado: false,
        },
        {
          id: 'documents' as ItemId,
          titulo: t('paymentActivation.items.documents', { defaultValue: 'Sube tus documentos' }),
          destino: 'settings/local/documents',
          hecho: kycEnviado,
          bloqueado: false,
        },
        {
          id: 'online' as ItemId,
          titulo: t('paymentActivation.items.online', { defaultValue: 'Cobros en línea (opcional)' }),
          destino: 'settings/integrations',
          hecho: !!data?.onlinePaymentsConnected,
          bloqueado: false,
        },
        {
          id: 'terminal' as ItemId,
          titulo: t('paymentActivation.items.terminal', { defaultValue: 'Compra tu terminal (opcional)' }),
          destino: 'devices?action=buy',
          hecho: (data?.terminalsCount ?? 0) > 0,
          // 🔴 D5: la compra conserva su candado hasta que el KYC esté enviado. Se muestra
          // DESHABILITADA con su explicación, nunca se esconde.
          bloqueado: !kycEnviado,
        },
      ],
    [data, kycEnviado, t],
  )

  if (!esDueño) return null
  if (kycStatus === 'VERIFIED') return null

  const hechos = items.filter(i => i.hecho).length

  const alternar = () => {
    const siguiente = !contraido
    setContraido(siguiente)
    try {
      window.localStorage?.setItem(CLAVE_CONTRAIDO, siguiente ? '1' : '0')
    } catch {
      /* el estado contraído es una comodidad; su pérdida no importa */
    }
  }

  return (
    <section className="rounded-2xl border border-input p-5" data-tour="payment-activation-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t('paymentActivation.title', { defaultValue: 'Activa tus cobros' })}</h2>
          <p className="text-sm text-muted-foreground">
            {t('paymentActivation.subtitle', {
              defaultValue: 'Para cobrar con tarjeta y recibir tu dinero necesitamos estos datos. Tardas menos de 10 minutos.',
            })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('paymentActivation.progress', { defaultValue: '{{done}} de {{total}} listos', done: hechos, total: items.length })}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={alternar} aria-expanded={!contraido}>
          {contraido ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          <span className="sr-only">{t('paymentActivation.toggle', { defaultValue: 'Mostrar u ocultar' })}</span>
        </Button>
      </div>

      {!contraido && (
        <ul className="mt-4 flex flex-col gap-2">
          {items.map(item => (
            <li key={item.id} className="flex items-center justify-between gap-4 rounded-xl border border-input p-3">
              <span className={cn('flex items-center gap-2 text-sm', item.hecho && 'text-muted-foreground line-through')}>
                {item.hecho ? <Check className="h-4 w-4 text-primary" /> : item.bloqueado ? <Lock className="h-4 w-4" /> : null}
                {item.titulo}
              </span>
              <div className="flex flex-col items-end gap-1">
                <Button
                  size="sm"
                  variant={item.hecho ? 'ghost' : 'outline'}
                  disabled={item.bloqueado}
                  onClick={() => navigate(`${fullBasePath}/${item.destino}`)}
                >
                  {item.hecho
                    ? t('paymentActivation.review', { defaultValue: 'Revisar' })
                    : t('paymentActivation.start', { defaultValue: 'Empezar' })}
                </Button>
                {item.bloqueado && (
                  <span className="max-w-[16rem] text-right text-xs text-muted-foreground">
                    {t('paymentActivation.terminalBlocked', {
                      defaultValue: 'Disponible cuando envíes tus documentos: una terminal sin cobros activos no puede cobrar.',
                    })}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
