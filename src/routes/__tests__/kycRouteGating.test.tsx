/**
 * QUÉ vive detrás del candado de KYC (§4.4).
 *
 * 🔴 Decisión del founder: el KYC deja de bloquear el producto y pasa a bloquear SOLO lo que mueve
 * dinero de un procesador. Un negocio sin KYC verificado tiene que poder vender, cortar caja, ver
 * sus reportes y su inventario: eso es la operación diaria, no un trámite bancario.
 *
 * La prueba recorre el ÁRBOL DE RUTAS real en vez de renderizar cada página: lo que decide si algo
 * está bloqueado es exactamente la posición de `<KYCProtectedRoute />` en ese árbol, y así una ruta
 * nueva que alguien cuelgue por debajo del guard aparece aquí sin tener que montar la pantalla.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { isValidElement } from 'react'
import type { RouteObject } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { createVenueRoutes } from '@/routes/venueRoutes'
import { KYCProtectedRoute } from '@/routes/KYCProtectedRoute'

/** Todas las rutas con path completo, y si algún ancestro las mete tras el guard de KYC. */
function recorrer(rutas: RouteObject[], prefijo = '', bajoKyc = false): Array<{ path: string; bajoKyc: boolean }> {
  const salida: Array<{ path: string; bajoKyc: boolean }> = []
  for (const ruta of rutas) {
    const esGuard = isValidElement(ruta.element) && ruta.element.type === KYCProtectedRoute
    const kycAqui = bajoKyc || esGuard
    const segmento = ruta.path && ruta.path !== '' ? ruta.path : ''
    const path = [prefijo, segmento].filter(Boolean).join('/')
    // Solo las HOJAS pintan una pantalla. Los nodos intermedios son estructura (un
    // `PermissionProtectedRoute`, un layout) y contarlos diría que una ruta está libre porque su
    // envoltorio lo está, justo al revés de lo que ve el usuario.
    const esHoja = !ruta.children || ruta.children.length === 0
    if (esHoja) salida.push({ path: ruta.index ? prefijo : path, bajoKyc: kycAqui })
    if (ruta.children) salida.push(...recorrer(ruta.children, path || prefijo, kycAqui))
  }
  return salida
}

const RUTAS = recorrer(createVenueRoutes())

function bloqueada(path: string): boolean {
  const coincidencias = RUTAS.filter(r => r.path === path)
  if (coincidencias.length === 0) throw new Error(`La ruta «${path}» no existe en createVenueRoutes()`)
  return coincidencias.every(r => r.bajoKyc)
}

describe('rutas que el KYC ya NO bloquea (operación diaria)', () => {
  const libres = [
    'orders',
    'orders/:orderId',
    'shifts',
    'shifts/:shiftId',
    'payments',
    'payments/:paymentId',
    'reports/sales-summary',
    'reports/sales-by-item',
    'reports/sales-by-category',
    'reports/payment-methods',
    'reports/refunds',
    'reports/promotions',
    'reports/pay-later-aging',
    'reports/home-charts',
    'commissions',
    'inventory/stock-overview',
    'inventory/raw-materials',
    'devices',
    'devices/:tpvId',
    'devices/orders/:id',
  ]

  it.each(libres)('«%s» se abre sin KYC verificado', path => {
    expect(bloqueada(path)).toBe(false)
  })
})

describe('rutas que el KYC SIGUE bloqueando (dinero de un procesador)', () => {
  it('las reglas de cobro deciden a qué cuenta procesadora va el dinero', () => {
    expect(bloqueada('payments/routing-rules')).toBe(true)
  })

  it('el saldo disponible son liquidaciones reguladas', () => {
    expect(bloqueada('available-balance')).toBe(true)
  })
})

describe('el guard no se quedó huérfano', () => {
  it('sigue existiendo al menos una ruta detrás del candado — si no, el guard sobra', () => {
    expect(RUTAS.some(r => r.bajoKyc)).toBe(true)
  })

  it('la página que explica el bloqueo sigue montada', () => {
    expect(RUTAS.some(r => r.path === 'kyc-required')).toBe(true)
  })
})

/**
 * La COMPRA de terminal (D5) no se puede comprobar con el árbol de rutas: vive DENTRO de la
 * pantalla de aparatos, detrás de `?action=buy` y de un botón. Se fija a nivel de FUENTE, que es
 * lo que puede caerse en un refactor sin que ninguna prueba de comportamiento lo note.
 */
describe('la compra de terminal conserva su candado (D5)', () => {
  const fuente = readFileSync(path.resolve(__dirname, '../../pages/Tpv/Tpvs.tsx'), 'utf8')

  it('el botón se deshabilita con el mismo predicado del dinero', () => {
    expect(fuente).toMatch(/canMoveMoney\(/)
    expect(fuente).toMatch(/disabled=\{!puedeComprarTerminal\}/)
  })

  it('el deeplink ?action=buy respeta el candado — si no, la URL lo saltaría', () => {
    expect(fuente).toMatch(/if \(puedeComprarTerminal\) setWizardOpen\(true\)/)
  })

  it('apagado se VE y se EXPLICA: hay un motivo, no una desaparición', () => {
    expect(fuente).toMatch(/buyBlockedByKyc/)
  })
})
