/**
 * Canjea el boleto del alta con código (landing) por la sesión y manda a /setup.
 * Pública a propósito: llega sin sesión. El boleto ya no está en la URL (lo guardó
 * capturarBoletoDeAlta antes de PostHog) y nunca se imprime ni se manda a analítica.
 */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { tomarBoletoDeAlta } from '@/lib/boleto-de-alta-capture'
import { track } from '@/lib/posthog'
import { entrarConBoleto } from '@/services/auth.service'

export default function EntrarConBoleto() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [fallo, setFallo] = useState(false)
  // El boleto se toma (y se borra) UNA vez: StrictMode monta dos veces.
  const iniciado = useRef(false)

  useEffect(() => {
    if (iniciado.current) return
    iniciado.current = true
    const boleto = tomarBoletoDeAlta()
    if (!boleto) {
      setFallo(true)
      return
    }
    entrarConBoleto(boleto)
      // Como /signup tras verificar el código: esperar la sesión antes de navegar.
      .then(() => queryClient.refetchQueries({ queryKey: ['status'] }))
      .then(() => {
        track('alta_entrada', { via: 'codigo' })
        navigate('/setup', { replace: true })
      })
      // 410 (usado/vencido), 404 (interruptor apagado), 429 y cualquier otro: la misma tarjeta.
      .catch(() => setFallo(true))
  }, [navigate, queryClient])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {fallo ? <XCircle className="mx-auto h-8 w-8 text-destructive" /> : <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />}
          <CardTitle className="mt-2">{fallo ? t('entrarConBoleto.usedTitle') : t('entrarConBoleto.loading')}</CardTitle>
          {fallo && <CardDescription>{t('entrarConBoleto.usedDesc')}</CardDescription>}
        </CardHeader>
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
