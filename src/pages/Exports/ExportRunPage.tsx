import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { ExportRunProgress } from '@/components/export-run-progress'

/** Destino de la campanita y del enlace del correo: `<venueBasePath>/<slug>/exports/<runId>`. Pide sesión (ProtectedRoute). */
export default function ExportRunPage() {
  const { runId } = useParams<{ runId: string }>()
  const { venueId, fullBasePath } = useCurrentVenue()
  const navigate = useNavigate()
  const { t } = useTranslation()
  if (!runId || !venueId) return null
  return (
    <div className="mx-auto max-w-lg space-y-4 p-6">
      <h1 className="text-xl font-semibold">{t('exportDialog.run.pageTitle')}</h1>
      <ExportRunProgress
        key={runId}
        venueId={venueId}
        runId={runId}
        autoDescargar
        onNuevoPedido={nuevo => navigate(`${fullBasePath}/exports/${nuevo}`, { replace: true })}
      />
    </div>
  )
}
