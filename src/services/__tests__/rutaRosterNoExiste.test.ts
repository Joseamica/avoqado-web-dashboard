import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Tarjeta de la nube na60da83 (encargo 2433fd, 18-nov-2026): en el asistente de AngelPay del SUPERADMIN, el recuadro
 * «Roster de cuentas» salía SIEMPRE en rojo («We couldn't load this information»), también en producción. Llamaba
 * `GET/PATCH /api/v1/dashboard/superadmin/venue-pricing/roster/...`, y el SERVIDOR nunca tuvo esa ruta: el «motor de cobro
 * por roster» (N cuentas por negocio) se quedó en la rama vieja `feat/venue-merchant-accounts` del SERVIDOR (wip del
 * 24-jun, sin su modelo en el schema de `develop`). El panel llegó solo al DASHBOARD.
 *
 * Esta guardia impide que el panel vuelva sin su ruta: si el motor por roster llega al SERVIDOR, se borra esta prueba en
 * el MISMO cambio que trae el recuadro de regreso.
 */
function archivosDe(carpeta: string): string[] {
  return readdirSync(carpeta).flatMap(nombre => {
    const ruta = join(carpeta, nombre)
    if (statSync(ruta).isDirectory()) return nombre === '__tests__' ? [] : archivosDe(ruta)
    return /\.(ts|tsx)$/.test(nombre) && !/\.test\.tsx?$/.test(nombre) ? [ruta] : []
  })
}

describe('na60da83 · el DASHBOARD no llama la ruta del roster que el SERVIDOR no tiene', () => {
  it('🔴 ningún archivo de src/ llama /venue-pricing/roster', () => {
    const quienLaLlama = archivosDe('src').filter(ruta => readFileSync(ruta, 'utf8').includes('venue-pricing/roster'))
    expect(quienLaLlama).toEqual([])
  })
})
