import { matchRoutes, type RouteObject } from 'react-router-dom'

/**
 * Al cambiar de sucursal, la parte de la página que sigue valiendo en la nueva: el prefijo más largo de `pagePart` que
 * existe bajo `basePath` sin más parámetro que la sucursal. Así `team/<persona>` queda en `team`: el id era de la
 * sucursal anterior y en la nueva responde «no encontrado» (visto en prod el 12-oct). '' si ninguno sirve.
 */
export function pageForOtherVenue(routes: RouteObject[], basePath: string, pagePart: string): string {
  const segments = pagePart.split('/').filter(Boolean)
  for (let k = segments.length; k > 0; k--) {
    const candidate = segments.slice(0, k).join('/')
    const matches = matchRoutes(routes, `${basePath}/${candidate}`)
    const params = matches?.[matches.length - 1].params
    if (params && Object.keys(params).every(key => key === 'slug')) return candidate
  }
  return ''
}
