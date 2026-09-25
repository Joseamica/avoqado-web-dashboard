/**
 * Abre el enlace que llegó al correo NUEVO y confirma el cambio de correo.
 *
 * El correo de una cuenta sólo cambia aquí: el Perfil ya no lo cambia al instante, porque eso
 * permitía ponerse el correo de otra persona. Pública a propósito: se abre desde el correo.
 */
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { confirmEmailChange } from '@/services/auth.service'

type Estado = { tipo: 'cargando' } | { tipo: 'listo'; email: string } | { tipo: 'error'; mensaje: string | null }

export default function ConfirmEmailChange() {
  const { t } = useTranslation('auth')
  const [params] = useSearchParams()
  const token = params.get('token')
  const [estado, setEstado] = useState<Estado>(token ? { tipo: 'cargando' } : { tipo: 'error', mensaje: null })
  // El enlace se canjea UNA vez: StrictMode monta dos veces y el segundo canje diría «ya no es válido».
  const canjeado = useRef(false)

  useEffect(() => {
    if (!token || canjeado.current) return
    canjeado.current = true
    confirmEmailChange(token)
      .then(r => setEstado({ tipo: 'listo', email: r.email }))
      .catch((e: { response?: { data?: { message?: string } } }) =>
        setEstado({ tipo: 'error', mensaje: e?.response?.data?.message ?? null }),
      )
  }, [token])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {estado.tipo === 'cargando' && <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />}
          {estado.tipo === 'listo' && <CheckCircle2 className="mx-auto h-8 w-8 text-green-600" />}
          {estado.tipo === 'error' && <XCircle className="mx-auto h-8 w-8 text-destructive" />}
          <CardTitle className="mt-2">
            {estado.tipo === 'cargando'
              ? t('confirmEmailChange.loading')
              : estado.tipo === 'listo'
                ? t('confirmEmailChange.successTitle')
                : t('confirmEmailChange.errorTitle')}
          </CardTitle>
          {estado.tipo === 'listo' && <CardDescription>{t('confirmEmailChange.successDesc', { email: estado.email })}</CardDescription>}
          {estado.tipo === 'error' && estado.mensaje && <CardDescription>{estado.mensaje}</CardDescription>}
        </CardHeader>
        {estado.tipo !== 'cargando' && (
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/">{t('confirmEmailChange.goHome')}</Link>
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
