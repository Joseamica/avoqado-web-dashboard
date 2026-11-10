import { useToast } from '@/hooks/use-toast'
import type { FilaDePromotor, SucursalDelPromotor } from '@/services/celularesDeCampo.service'
import { useVenueDateTime } from '@/utils/datetime'
import type { PaginationState } from '@tanstack/react-table'
import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * El SERVIDOR contesta los errores como `{ code, message }`: se enseña su `message`, que ya viene en llano. Sin él (404 sin
 * cuerpo, 502, «Network Error») no hay texto: el de axios va en inglés y no le dice nada a quien usa la pantalla.
 */
export function mensajeDelServidor(err: unknown): string | undefined {
  const data = (err as { response?: { data?: unknown } } | null)?.response?.data
  const message = data && typeof data === 'object' ? (data as { message?: unknown }).message : undefined
  return typeof message === 'string' && message.trim() ? message : undefined
}

/** El texto de un error para un aviso: el del servidor, o «No hubo respuesta del servidor…» si no trajo uno. */
export function useMensajeDeError() {
  const { t } = useTranslation('organization')
  return useCallback(
    (err: unknown) =>
      mensajeDelServidor(err) ?? t('celulares.sinRespuesta', { defaultValue: 'No hubo respuesta del servidor. Intenta de nuevo.' }),
    [t],
  )
}

/** El SERVIDOR ya está aplicando ese retenido (otro clic u otra persona): se avisa y se suelta el diálogo. */
export const esAplicacionEnCurso = (err: unknown) =>
  (err as { response?: { data?: { code?: unknown } } } | null)?.response?.data?.code === 'APLICACION_EN_CURSO'

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
 * Un 422 `NO_SE_PUDO_APLICAR` trae el rechazo en la raíz (`rechazo { code, message }`, `motivo`; o bajo `details`). Devuelve el mensaje en llano y si hay que sugerir reactivar.
 */
export function rechazoDeAplicar(err: unknown): { message: string; sinAsignacion: boolean } | null {
  type Rechazo = { code?: string; message?: string }
  const data = (
    err as {
      response?: {
        data?: { code?: string; message?: string; motivo?: string; rechazo?: Rechazo; details?: { motivo?: string; rechazo?: Rechazo } }
      }
    } | null
  )?.response?.data
  if (data?.code !== 'NO_SE_PUDO_APLICAR') return null
  // El servidor los manda en la raíz del cuerpo; `details` queda por si algún día los anida.
  const rechazo = data.rechazo ?? data.details?.rechazo
  const motivo = data.motivo ?? data.details?.motivo
  const sinAsignacion = rechazo?.code === 'PERSONA_SIN_ASIGNACION' || motivo === 'PERSONA_SIN_ASIGNACION'
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

/** Lo más que pide una página el SERVIDOR (`pageSize` ≤ 100); el selector de «Filas por página» también ofrece 200. */
export const TOPE_DE_PAGINA = 100

/** La paginación de una tabla de esta página: arranca en 20 y nunca pasa del tope del SERVIDOR (si eligen 200, son 100). */
export function usePaginacion(): [PaginationState, Dispatch<SetStateAction<PaginationState>>] {
  const [pagination, set] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 })
  const setPagination = useCallback<Dispatch<SetStateAction<PaginationState>>>(
    u =>
      set(p => {
        const n = typeof u === 'function' ? u(p) : u
        return { ...n, pageSize: Math.min(n.pageSize, TOPE_DE_PAGINA) }
      }),
    [],
  )
  return [pagination, setPagination]
}
