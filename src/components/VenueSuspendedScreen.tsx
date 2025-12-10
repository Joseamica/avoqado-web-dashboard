import { useTranslation } from 'react-i18next'
import { AlertTriangle, Ban, XCircle, MessageCircle, Mail, RefreshCw, Building2, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

interface VenueSuspendedScreenProps {
  status: 'SUSPENDED' | 'ADMIN_SUSPENDED' | 'CLOSED'
  venueName: string
  suspensionReason?: string | null
  canReactivate: boolean
  onReactivate?: () => void
  isReactivating?: boolean
  otherVenuesAvailable: boolean
}

const SUPPORT_WHATSAPP = 'https://wa.me/525640070001?text=Hola%2C%20necesito%20ayuda%20con%20mi%20establecimiento%20suspendido'
const SUPPORT_EMAIL = 'hola@avoqado.io'

export function VenueSuspendedScreen({
  status,
  venueName,
  suspensionReason,
  canReactivate,
  onReactivate,
  isReactivating = false,
  otherVenuesAvailable,
}: VenueSuspendedScreenProps) {
  const { t } = useTranslation('venue')
  const { logout } = useAuth()

  const getStatusConfig = () => {
    switch (status) {
      case 'SUSPENDED':
        return {
          icon: AlertTriangle,
          title: t('venueSuspended.title', { defaultValue: 'Establecimiento Suspendido' }),
          description: t('venueSuspended.description', {
            defaultValue: 'Este establecimiento ha sido suspendido temporalmente.',
          }),
          gradientFrom: 'from-amber-500',
          gradientTo: 'to-orange-600',
          iconBg: 'bg-amber-500/10',
          iconColor: 'text-amber-500',
          borderColor: 'border-amber-500/20',
        }
      case 'ADMIN_SUSPENDED':
        return {
          icon: Ban,
          title: t('venueSuspended.adminTitle', { defaultValue: 'Suspendido por Administrador' }),
          description: t('venueSuspended.adminDescription', {
            defaultValue: 'Este establecimiento ha sido suspendido por el administrador de la plataforma.',
          }),
          gradientFrom: 'from-red-500',
          gradientTo: 'to-rose-600',
          iconBg: 'bg-red-500/10',
          iconColor: 'text-red-500',
          borderColor: 'border-red-500/20',
        }
      case 'CLOSED':
        return {
          icon: XCircle,
          title: t('venueSuspended.closedTitle', { defaultValue: 'Establecimiento Cerrado' }),
          description: t('venueSuspended.closedDescription', {
            defaultValue: 'Este establecimiento ha sido cerrado permanentemente.',
          }),
          gradientFrom: 'from-slate-500',
          gradientTo: 'to-slate-600',
          iconBg: 'bg-muted',
          iconColor: 'text-muted-foreground',
          borderColor: 'border-border',
        }
    }
  }

  const config = getStatusConfig()
  const IconComponent = config.icon

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-lg w-full">
        {/* Main card */}
        <div className={`rounded-2xl border ${config.borderColor} bg-card shadow-xl overflow-hidden`}>
          {/* Gradient header */}
          <div className={`h-2 bg-gradient-to-r ${config.gradientFrom} ${config.gradientTo}`} />

          <div className="p-8 space-y-6">
            {/* Icon and Title */}
            <div className="flex flex-col items-center text-center space-y-4">
              <div className={`p-4 rounded-full ${config.iconBg}`}>
                <IconComponent className={`h-12 w-12 ${config.iconColor}`} />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground">{config.title}</h1>
                <p className="text-muted-foreground">{config.description}</p>
              </div>
            </div>

            {/* Venue name */}
            <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-muted/50">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-foreground">{venueName}</span>
            </div>

            {/* Suspension reason */}
            {suspensionReason && (
              <div className={`p-4 rounded-lg border ${config.borderColor} bg-muted/30`}>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  {t('venueSuspended.reason', { defaultValue: 'Motivo:' })}
                </p>
                <p className="text-sm text-foreground">{suspensionReason}</p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              {/* Reactivate button - only for SUSPENDED with permission */}
              {status === 'SUSPENDED' && canReactivate && onReactivate && (
                <Button
                  onClick={onReactivate}
                  disabled={isReactivating}
                  className={`w-full bg-gradient-to-r ${config.gradientFrom} ${config.gradientTo} text-primary-foreground hover:opacity-90 transition-opacity`}
                >
                  {isReactivating ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      {t('venueSuspended.reactivating', { defaultValue: 'Reactivando...' })}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {t('venueSuspended.reactivate', { defaultValue: 'Reactivar Establecimiento' })}
                    </>
                  )}
                </Button>
              )}

              {/* Contact support */}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" asChild>
                  <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    WhatsApp
                  </a>
                </Button>
                <Button variant="outline" className="flex-1" asChild>
                  <a href={`mailto:${SUPPORT_EMAIL}?subject=Ayuda%20con%20establecimiento%20suspendido%20-%20${encodeURIComponent(venueName)}`}>
                    <Mail className="mr-2 h-4 w-4" />
                    Email
                  </a>
                </Button>
              </div>

              {/* Link to select another venue */}
              {otherVenuesAvailable && (
                <Button variant="ghost" className="w-full text-muted-foreground" asChild>
                  <Link to="/venues">
                    {t('venueSuspended.selectOther', { defaultValue: 'Seleccionar otro establecimiento' })}
                  </Link>
                </Button>
              )}

              {/* Logout button */}
              <div className="pt-3 border-t border-border">
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground hover:text-destructive"
                  onClick={() => logout()}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('venueSuspended.logout', { defaultValue: 'Cerrar sesión' })}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Help text */}
        <p className="text-center text-sm text-muted-foreground mt-4">
          {t('venueSuspended.helpText', {
            defaultValue: '¿Necesitas ayuda? Contáctanos a través de WhatsApp o email.',
          })}
        </p>
      </div>
    </div>
  )
}
