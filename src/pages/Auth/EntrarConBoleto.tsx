/**
 * Canjea el boleto del alta con código (landing) por la sesión y manda a /setup.
 * Pública a propósito: llega sin sesión. El boleto ya no está en la URL (lo guardó
 * capturarBoletoDeAlta antes de PostHog) y nunca se imprime ni se manda a analítica.
 */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, WifiOff, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { tomarBoletoDeAlta } from '@/lib/boleto-de-alta-capture'
import { track } from '@/lib/posthog'
import { AUTH_STATUS_QUERY_KEY, entrarConBoleto, getAuthStatus } from '@/services/auth.service'

export default function EntrarConBoleto() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [fallo, setFallo] = useState(false)
  const [sinRed, setSinRed] = useState(false)
  // El boleto se toma (y se borra del storage) UNA vez: StrictMode monta dos veces. Se queda aquí
  // para poder reintentar si falló la red; nunca vuelve a storage.
  const iniciado = useRef(false)
  const boletoRef = useRef<string | null>(null)

  const canjeado = useRef(false)

  // Tras canjear, la sesión nueva (cookies B) debe reemplazar a cualquier sesión A que el contexto
  // tuviera en vuelo: se cancela esa petición y se pide una fresca; si falla o no hay sesión, no se navega.
  const refrescar = async () => {
    await queryClient.cancelQueries({ queryKey: AUTH_STATUS_QUERY_KEY })
    // Sin fetchQuery: reiniciar una query en error y sin datos la pondría en 'pending' y AuthProvider
    // cambiaría esta pantalla por la de carga (se perdería el boleto). Se pide directo y se guarda.
    const estado = await getAuthStatus()
    queryClient.setQueryData(AUTH_STATUS_QUERY_KEY, estado)
    if (!estado?.authenticated) throw new Error('sin sesión tras canjear')
    track('alta_entrada', { via: 'codigo' })
    navigate('/setup', { replace: true })
  }

  const canjear = (boleto: string) => {
    setSinRed(false)
    // Ya canjeado: «Reintentar» solo refresca la sesión, nunca gasta el boleto dos veces.
    // Antes de canjear se espera el status que ya iba en vuelo (sesión vieja A): si llegara DESPUÉS de las
    // cookies B, su 401 borraría la sesión nueva. fetchQuery se une a la petición pendiente.
    // Solo si ya hay uno en vuelo; si no, no se inicia nada (iniciarlo provocaría una carga en AuthProvider).
    const esperarEnVuelo = () =>
      queryClient.isFetching({ queryKey: AUTH_STATUS_QUERY_KEY }) > 0
        ? queryClient.fetchQuery({ queryKey: AUTH_STATUS_QUERY_KEY, queryFn: getAuthStatus }).then(() => undefined, () => undefined)
        : Promise.resolve()
    ;(canjeado.current
      ? Promise.resolve()
      : esperarEnVuelo().then(() => entrarConBoleto(boleto)).then(() => void (canjeado.current = true))
    )
      .then(refrescar)
      // Sin respuesta del servidor (red caída): el boleto sigue vivo, se puede reintentar.
      // 410 (usado/vencido), 404 (interruptor apagado), 429 y cualquier otra respuesta: la misma tarjeta.
      // Fallo al refrescar tras canjear: mismo estado con «Reintentar» (solo refresca).
      .catch((e: { response?: unknown }) => (e?.response && !canjeado.current ? setFallo(true) : setSinRed(true)))
  }

  useEffect(() => {
    if (iniciado.current) return
    iniciado.current = true
    boletoRef.current = tomarBoletoDeAlta()
    if (boletoRef.current) canjear(boletoRef.current)
    else setFallo(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {sinRed ? <WifiOff className="mx-auto h-8 w-8 text-muted-foreground" /> : fallo ? <XCircle className="mx-auto h-8 w-8 text-destructive" /> : <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />}
          <CardTitle className="mt-2">
            {sinRed ? t('entrarConBoleto.offlineTitle') : fallo ? t('entrarConBoleto.usedTitle') : t('entrarConBoleto.loading')}
          </CardTitle>
          {fallo && <CardDescription>{t('entrarConBoleto.usedDesc')}</CardDescription>}
        </CardHeader>
        {sinRed && (
          <CardContent>
            <Button className="w-full" onClick={() => boletoRef.current && canjear(boletoRef.current)}>
              {t('entrarConBoleto.retry')}
            </Button>
          </CardContent>
        )}
        {fallo && (
          <CardContent className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link to="/login">{t('entrarConBoleto.login')}</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/auth/forgot-password">{t('entrarConBoleto.forgot')}</Link>
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
