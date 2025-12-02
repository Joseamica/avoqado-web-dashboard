import { useRouteError, Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FileQuestion, AlertTriangle, Home, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorPageProps {
  statusText?: string
  message?: string
  status?: number
}

export default function ErrorPage() {
  const { t } = useTranslation()
  const error = useRouteError() as ErrorPageProps | null
  const location = useLocation()

  // Determine if this is a 404 (no error object) or an actual error
  const is404 = !error || error.status === 404

  // Only log actual errors, not 404s
  if (error && !is404) {
    console.error(error)
  }

  // 404 - Page Not Found
  if (is404) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          {/* 404 Icon */}
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
            <FileQuestion className="h-12 w-12 text-muted-foreground" />
          </div>

          {/* 404 Number */}
          <h1 className="mb-2 text-8xl font-bold text-foreground/20">404</h1>

          {/* Title */}
          <h2 className="mb-3 text-2xl font-semibold text-foreground">
            {t('error.notFound.title', 'Página no encontrada')}
          </h2>

          {/* Description */}
          <p className="mb-2 text-muted-foreground">
            {t('error.notFound.description', 'La página que buscas no existe o ha sido movida.')}
          </p>

          {/* Show the attempted path */}
          <p className="mb-8 text-sm text-muted-foreground/70 font-mono bg-muted rounded px-3 py-1 inline-block">
            {location.pathname}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('error.notFound.goBack', 'Volver')}
            </Button>
            <Button asChild>
              <Link to="/">
                <Home className="mr-2 h-4 w-4" />
                {t('error.notFound.goHome', 'Ir al inicio')}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Actual Error Page
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="text-center max-w-md">
        {/* Error Icon */}
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-12 w-12 text-destructive" />
        </div>

        {/* Title */}
        <h1 className="mb-3 text-2xl font-semibold text-foreground">
          {t('errorOops', '¡Ups! Algo salió mal')}
        </h1>

        {/* Description */}
        <p className="mb-6 text-muted-foreground">
          {t('errorUnexpected', 'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.')}
        </p>

        {/* Error Details (only in development) */}
        {import.meta.env.DEV && error && (error.statusText || error.message) && (
          <div className="mb-6 rounded-md bg-muted p-4 text-left">
            <p className="text-sm font-medium text-muted-foreground mb-1">
              {error.status ? `Error ${error.status}` : 'Error'}
            </p>
            <p className="text-sm text-muted-foreground font-mono">
              {error.statusText || error.message}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={() => window.location.reload()}>
            {t('error.retry', 'Reintentar')}
          </Button>
          <Button asChild>
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              {t('back_to_home', 'Ir al inicio')}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
