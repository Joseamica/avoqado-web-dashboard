import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useDebounce } from '@/hooks/useDebounce'
import {
  getCustomerDisplay,
  listCustomerDisplayDevices,
  previewCustomerDisplay,
  type CustomerDisplayDraft,
  type CustomerDisplayFicha,
} from '@/services/customerDisplay.service'
import { tpvSettingsService } from '@/services/tpv-settings.service'
import { textoDelServidor } from '@/utils/apiError'
import { intervaloDeRefresco } from './estado'
import { crearSecuencia, PAGINA_DE_DISPOSITIVOS } from './model'

/**
 * 🔴 UN solo lugar para las claves (toda mutación invalida cada clave que lee lo que cambió). `pasos` es A PROPÓSITO la
 * misma clave que `TpvSettingsForm`: la pestaña Configuración de una TPV y la tarjeta leen la misma ficha.
 */
export const clavesDeLaPantalla = {
  vista: (venueId: string, terminalId: string) => ['customer-display', venueId, terminalId] as const,
  dispositivos: (venueId: string) => ['customer-display-devices', venueId] as const,
  pasos: (terminalId: string) => ['tpvSettings', terminalId] as const,
}

const CONSULTA_ACOTADA = { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } as const

export function useCustomerDisplay(venueId: string, terminalId: string, enabled: boolean) {
  // La ventana del refresco acotado (30 min) cuenta desde el montaje y VUELVE A EMPEZAR cada vez que cambia el diseño
  // (`editToken`: guardar, copiar hacia esta caja, restablecer): un diseño nuevo hay que volver a verlo llegar a la tablet,
  // aunque la tarjeta lleve más de 30 min abierta (revisión final M1). TanStack recalcula el intervalo con cada dato nuevo.
  const ventana = useRef<{ token: string | null; desde: number }>({ token: null, desde: Date.now() })
  return useQuery({
    queryKey: clavesDeLaPantalla.vista(venueId, terminalId),
    queryFn: () => getCustomerDisplay(venueId, terminalId),
    enabled,
    ...CONSULTA_ACOTADA,
    refetchInterval: query => {
      const token = query.state.data?.editToken ?? null
      if (token !== null && token !== ventana.current.token) {
        // El PRIMER token no abre otra ventana: la del montaje ya cuenta desde antes de que llegara.
        ventana.current = { token, desde: ventana.current.token === null ? ventana.current.desde : Date.now() }
      }
      return intervaloDeRefresco(query.state.data, ventana.current.desde, Date.now())
    },
  })
}

/**
 * Los pasos del cobro de un dispositivo. `retry: 1` (no los 3 de la app): tras un guardado incierto la sección muestra
 * «Sin confirmar» mientras relee, y con 3 reintentos eso duraba ~7 s antes de decir «no se pudieron cargar».
 */
export function usePasosDelCobro(terminalId: string, enabled: boolean) {
  return useQuery({
    queryKey: clavesDeLaPantalla.pasos(terminalId),
    queryFn: () => tpvSettingsService.getSettings(terminalId),
    enabled,
    retry: 1,
  })
}

/**
 * La vista previa del editor: la PINTA el server (spec §6.3), con debounce de 300 ms y `previewSeq`. 🔴 Sólo cuenta la
 * ÚLTIMA solicitud (Codex #10): una anterior que llega tarde —éxito o error— se descarta; un error de la vigente se queda
 * hasta que otra solicitud lo reemplace, y la ficha mostrada sigue siendo la última buena.
 */
export function useFichaPreview(entrada: {
  venueId: string
  terminalId: string
  cuerpo: CustomerDisplayDraft
  fichaInicial: CustomerDisplayFicha
  assetRejectedInicial: string[]
}) {
  const { venueId, terminalId, cuerpo, fichaInicial, assetRejectedInicial } = entrada
  // La clave es el TEXTO del cuerpo: un objeto nuevo con los mismos valores no dispara otra solicitud.
  const claveEstable = useDebounce(JSON.stringify(cuerpo), 300)
  const secuencia = useRef(crearSecuencia())
  const [resultado, setResultado] = useState({ ficha: fichaInicial, assetRejected: assetRejectedInicial })
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const seq = secuencia.current.siguiente()
    setCargando(true)
    previewCustomerDisplay(venueId, terminalId, JSON.parse(claveEstable) as CustomerDisplayDraft, seq)
      .then(r => {
        // El número que MANDAMOS (el del cierre), no el eco del server: si el eco faltara, `cargando` se quedaría prendido.
        if (!secuencia.current.esLaVigente(seq)) return
        setResultado({ ficha: r.ficha, assetRejected: r.assetRejected })
        setError(null)
        setCargando(false)
      })
      .catch((e: unknown) => {
        if (!secuencia.current.esLaVigente(seq)) return
        setError(textoDelServidor(e) ?? '')
        setCargando(false)
      })
  }, [venueId, terminalId, claveEstable])

  return { ...resultado, cargando, error }
}

export function useCopyTargets(venueId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: clavesDeLaPantalla.dispositivos(venueId),
    queryFn: ({ pageParam }) => listCustomerDisplayDevices(venueId, { cursor: pageParam, take: PAGINA_DE_DISPOSITIVOS }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: ultima => ultima.nextCursor ?? undefined,
    enabled,
    ...CONSULTA_ACOTADA,
  })
}
