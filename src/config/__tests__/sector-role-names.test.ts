/**
 * Los nombres de rol deben seguir la MISMA cadena que el resto de la terminología:
 *   override del venue  >  default del giro  >  FOOD_SERVICE
 *
 * 🔴 El bug que originó estas pruebas (visto capturando la guía de equipo, 27-ago-2026):
 * el escalón de en medio no existía para los roles. `DEFAULT_ROLE_DISPLAY_NAMES` es una
 * lista fija con vocabulario de restaurante, así que una ESTÉTICA veía a su especialista
 * etiquetado como «Mesero» y el sidebar hablaba de «Cocina» — aunque `sector-terminology.ts`
 * ya tenía la palabra correcta para ese giro. Muerde justo al ICP (retail y servicios).
 */
import { describe, it, expect } from 'vitest'
import { getSectorRoleDisplayNames, deriveBusinessCategory } from '@/config/sector-terminology'
import { StaffRole } from '@/types'

describe('nombres de rol por giro', () => {
  it('una estética no llama «Mesero» a su gente', () => {
    const n = getSectorRoleDisplayNames('SERVICES', 'es')
    expect(n[StaffRole.WAITER]).toBe('Especialista')
    expect(n[StaffRole.WAITER]).not.toBe('Mesero')
  })

  it('una tienda dice «Vendedor»', () => {
    expect(getSectorRoleDisplayNames('RETAIL', 'es')[StaffRole.WAITER]).toBe('Vendedor')
  })

  it('un restaurante sigue diciendo «Mesero» — no se le cambia nada', () => {
    const n = getSectorRoleDisplayNames('FOOD_SERVICE', 'es')
    expect(n[StaffRole.WAITER]).toBe('Mesero')
    expect(n[StaffRole.KITCHEN]).toBe('Cocina')
  })

  it('los roles administrativos NO dependen del giro', () => {
    for (const cat of ['FOOD_SERVICE', 'RETAIL', 'SERVICES'] as const) {
      const n = getSectorRoleDisplayNames(cat, 'es')
      expect(n[StaffRole.OWNER]).toBe('Propietario')
      expect(n[StaffRole.ADMIN]).toBe('Administrador')
      expect(n[StaffRole.MANAGER]).toBe('Gerente')
    }
  })

  it('todos los roles tienen nombre en todos los giros — ninguno se queda en el enum crudo', () => {
    for (const cat of ['FOOD_SERVICE', 'RETAIL', 'SERVICES', 'OTHER'] as const) {
      const n = getSectorRoleDisplayNames(cat, 'es')
      for (const role of Object.values(StaffRole)) {
        expect(n[role], `${cat} / ${role}`).toBeTruthy()
        expect(n[role], `${cat} / ${role}`).not.toBe(role)
      }
    }
  })

  it('en inglés también sigue al giro', () => {
    expect(getSectorRoleDisplayNames('SERVICES', 'en')[StaffRole.WAITER]).toBe('Specialist')
    expect(getSectorRoleDisplayNames('FOOD_SERVICE', 'en')[StaffRole.WAITER]).toBe('Waiter')
  })

  it('el giro se deriva del tipo del negocio, con FOOD_SERVICE como red de seguridad', () => {
    expect(deriveBusinessCategory('SALON')).toBe('SERVICES')
    expect(deriveBusinessCategory('RESTAURANT')).toBe('FOOD_SERVICE')
    expect(deriveBusinessCategory('FITNESS_STUDIO')).toBe('SERVICES')
    expect(deriveBusinessCategory('HOTEL_RESTAURANT')).toBe('FOOD_SERVICE')
    expect(deriveBusinessCategory(undefined)).toBe('FOOD_SERVICE')
  })
})
