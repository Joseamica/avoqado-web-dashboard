import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useBreadcrumb } from '@/context/BreadcrumbContext'
import { ExportRunProgress } from '@/components/export-run-progress'

/** Destino de la campanita y del enlace del correo: `<venueBasePath>/<slug>/exports/<runId>`. Pide sesión (ProtectedRoute). */
export default function ExportRunPage() {
  const { runId } = useParams<{ runId: string }>()
  const { venueId, fullBasePath } = useCurrentVenue()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { setCustomSegment, clearCustomSegment } = useBreadcrumb()
  const titulo = t('exportDialog.run.pageTitle')
  // La miga enseñaría el id crudo del pedido; se llama como el título de la pantalla.
  useEffect(() => {
    if (!runId) return
    setCustomSegment(runId, titulo)
    return () => clearCustomSegment(runId)
  }, [runId, titulo, setCustomSegment, clearCustomSegment])
  if (!runId || !venueId) return null
  return (
    <div className="mx-auto max-w-lg space-y-4 p-6">
      <h1 className="text-xl font-semibold">{titulo}</h1>
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
