import { useToast } from '@/hooks/use-toast'
import type { FilaDePromotor, SucursalDelPromotor } from '@/services/celularesDeCampo.service'
import { useVenueDateTime } from '@/utils/datetime'
import { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'

/** El SERVIDOR contesta los errores como `{ code, message }`: se enseña su `message`, que ya viene en llano. */
export function mensajeDelServidor(err: unknown): string | undefined {
  const e = err as { response?: { data?: { message?: string } }; message?: string } | null
  return e?.response?.data?.message ?? e?.message
}

/**
 * Candado contra el doble clic: `disabled={isPending}` no basta, porque TanStack avisa `isPending` en el siguiente tick y dos
 * clics del mismo instante mandan dos POST (memoria «doble-clic-se-prueba-con-dos-clics-en-un-act»). Mientras una llamada está
 * en vuelo, la siguiente no sale.
 */
export function useUnaALaVez() {
  const enVuelo = useRef(false)
  return useCallback(async (fn: () => Promise<unknown>) => {
    if (enVuelo.current) return
    enVuelo.current = true
    try {
      await fn()
    } catch {
      // El onError de cada mutación ya avisó.
    } finally {
      enVuelo.current = false
    }
  }, [])
}

/**
 * En la sucursal el PIN es de UNA sucursal: la de la pantalla, y si la persona no la tiene no hay dónde ponerlo (undefined).
 * En la organización (sin `venueIdInicial`) basta con la primera suya.
 */
export function sucursalDelPin(fila: FilaDePromotor, venueIdInicial?: string): SucursalDelPromotor | undefined {
  return venueIdInicial ? fila.sucursales.find(s => s.venueId === venueIdInicial) : fila.sucursales[0]
}

/**
 * Un 422 `NO_SE_PUDO_APLICAR` trae el rechazo en `details.rechazo` (`{ code, message }`) o, si la persona ya no tiene
 * asignación, `details.motivo = PERSONA_SIN_ASIGNACION`. Devuelve el mensaje en llano y si hay que sugerir reactivar.
 */
export function rechazoDeAplicar(err: unknown): { message: string; sinAsignacion: boolean } | null {
  const data = (err as { response?: { data?: { code?: string; message?: string; details?: Record<string, unknown> } } } | null)?.response
    ?.data
  if (data?.code !== 'NO_SE_PUDO_APLICAR') return null
  const rechazo = data.details?.rechazo as { code?: string; message?: string } | undefined
  const sinAsignacion = rechazo?.code === 'PERSONA_SIN_ASIGNACION' || data.details?.motivo === 'PERSONA_SIN_ASIGNACION'
  return { message: rechazo?.message ?? data.message ?? '', sinAsignacion }
}

/** «Cambiar PIN» si ya tiene uno donde se va a poner; en la organización, si tiene uno en alguna sucursal. */
export function tienePin(fila: FilaDePromotor, venueIdInicial?: string): boolean {
  if (venueIdInicial) return !!sucursalDelPin(fila, venueIdInicial)?.tienePin
  return fila.sucursales.some(s => s.tienePin)
}

/** Lo que hace falta para enseñar o mandar un código: sale de la respuesta de «Generar» o de la fila. */
export interface CodigoParaMandar {
  nombre: string
  telefono: string | null
  codigo: string
  expiraAt: string
}

/**
 * `https://wa.me/52XXXXXXXXXX?text=…` con los últimos 10 dígitos del teléfono; sin teléfono, `https://wa.me/?text=…` y la
 * persona elige el chat. ponytail: todo número se trata como de México (+52); uno de otro país necesitaría su lada guardada.
 */
export function enlaceDeWhatsApp(telefono: string | null, texto: string): string {
  const digitos = (telefono ?? '').replace(/\D/g, '')
  const numero = digitos.length >= 10 ? `52${digitos.slice(-10)}` : ''
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
}

/** Copiar y mandar por WhatsApp: lo usan el diálogo y cada fila de la tabla. Nunca manda nada solo. */
export function useMandarCodigo() {
  const { t } = useTranslation('organization')
  const { toast } = useToast()
  const { formatDate } = useVenueDateTime()

  const copiar = useCallback(
    async (codigo: string) => {
      try {
        await navigator.clipboard.writeText(codigo)
        toast({ title: t('celulares.codigo.copiado', { defaultValue: 'Código copiado' }), duration: 2000 })
      } catch {
        toast({
          variant: 'destructive',
          title: t('celulares.codigo.errorCopiar', { defaultValue: 'No se pudo copiar. Selecciónalo y cópialo a mano.' }),
        })
      }
    },
    [t, toast],
  )

  const mandarPorWhatsApp = useCallback(
    (c: CodigoParaMandar) => {
      const texto = t('celulares.codigo.whatsappTexto', {
        nombre: c.nombre,
        codigo: c.codigo,
        fecha: formatDate(c.expiraAt),
        defaultValue:
          'Hola {{nombre}}, tu código para activar la app de campo de Avoqado es {{codigo}}. Vence el {{fecha}}. Escríbelo en la app junto con tu PIN.',
      })
      window.open(enlaceDeWhatsApp(c.telefono, texto), '_blank', 'noopener,noreferrer')
    },
    [t, formatDate],
  )

  return { copiar, mandarPorWhatsApp }
}
