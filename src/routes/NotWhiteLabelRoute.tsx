import { Navigate, Outlet, useLocation } from 'react-router-dom'

/**
 * Bloquea una ruta cuando se entra por el árbol white-label (`/wl/venues/:slug/...`).
 *
 * `createVenueRoutes()` se monta ENTERO bajo `/wl/`, así que ocultar una entrada del sidebar
 * no basta: la URL directa sigue resolviendo. Se usa para pantallas del producto escalable
 * que en white-label tienen su propia versión (asistencia, expediente) y no deben coexistir
 * sobre los mismos datos.
 */
export function NotWhiteLabelRoute() {
  const location = useLocation()
  if (location.pathname.startsWith('/wl/')) {
    // Al inicio del venue en su propio árbol, no a un 404: la sección sí existe, sólo no aquí.
    const base = location.pathname.split('/').slice(0, 4).join('/')
    return <Navigate to={base} replace />
  }
  return <Outlet />
}
