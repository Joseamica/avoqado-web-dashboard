import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'

import { useAccess } from '@/hooks/use-access'

/**
 * Bloquea una pantalla del producto escalable para los venues white-label, entren por donde
 * entren.
 *
 * `createVenueRoutes()` se monta ENTERO bajo `/wl/venues/:slug` Y bajo `/venues/:slug`, así que
 * ocultar la entrada del sidebar no basta y mirar sólo el prefijo `/wl/` tampoco: un manager de
 * PlayTelecom podía teclear `/venues/<slug>/asistencia` y abrir la versión genérica sobre los
 * mismos datos (auditoría Codex fase 2, P2-8). La decisión la toma la CONFIGURACIÓN del venue
 * (`isWhiteLabelEnabled`), y la URL sólo dice a dónde mandarlo de vuelta.
 *
 * Se usa para pantallas que en white-label tienen su propia versión (asistencia, expediente) y
 * no deben coexistir sobre los mismos datos.
 */
export function NotWhiteLabelRoute() {
  const location = useLocation()
  const params = useParams<{ slug?: string }>()
  const { isWhiteLabelEnabled, isLoading } = useAccess()

  const enteredByWl = location.pathname.startsWith('/wl/')

  // Mientras carga la configuración se deja pasar, igual que PermissionProtectedRoute: el
  // servidor sigue siendo quien manda, y así no parpadea un "no puedes" a quien sí puede.
  if (isLoading && !enteredByWl) return <Outlet />

  if (enteredByWl || isWhiteLabelEnabled) {
    // Al inicio del venue en SU árbol, no a un 404: la sección sí existe, sólo no aquí.
    const base = enteredByWl ? location.pathname.split('/').slice(0, 4).join('/') : `/wl/venues/${params.slug ?? ''}`
    return <Navigate to={base} replace />
  }
  return <Outlet />
}
