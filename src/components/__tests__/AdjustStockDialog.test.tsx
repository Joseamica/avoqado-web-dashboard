/**
 * D2 (18-nov-2026): «Ajustar existencias» de la lista de Artículos, ahora también en Gratis/Pro.
 * - El historial es Premium: si no se pudo leer (sin plan, sin permiso o sin red), la ventana no dice «no hay movimientos recientes» (Codex r1
 *   #8, r2 #8).
 * - La regla de negativos es la del SERVIDOR: un saldo que una venta ya dejó en negativo se corrige aunque no alcance el cero; un saldo
 *   en 0 o más no se lleva a negativo (Codex r1 #6).
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const historial = vi.hoisted(() => ({ valor: { movements: [], isLoading: false, hasRecentMovements: false, isError: false, isSuccess: true } }))
vi.mock('@/hooks/useRecentMovements', () => ({ useRecentMovements: () => historial.valor }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
const traduce = vi.hoisted(() => ({ t: (k: string) => k }))
vi.mock('react-i18next', () => ({ useTranslation: () => traduce }))
// La sección real lee la sesión y la zona horaria; aquí sólo importa si la ventana la pinta.
vi.mock('@/components/inventory/RecentMovementsSection', () => ({
  RecentMovementsSection: (p: { hasRecentMovements: boolean }) => (p.hasRecentMovements ? 'movimientos' : 'rawMaterials.movements.noRecentMovements'),
}))

import { AdjustStockDialog } from '../AdjustStockDialog'

const producto = (existencia: number) =>
  ({ id: 'p1', name: 'Libreta', unit: 'pz', inventory: { currentStock: existencia } }) as unknown as Parameters<
    typeof AdjustStockDialog
  >[0]['product']

function pintar(existencia: number, onConfirm = vi.fn()) {
  render(<AdjustStockDialog open onOpenChange={() => {}} product={producto(existencia)} onConfirm={onConfirm} />)
  return onConfirm
}

const escribir = (valor: string) =>
  fireEvent.change(screen.getByLabelText(/products\.actions\.adjustStockDialog\.adjustment/), { target: { value: valor } })
const guardar = () => screen.getByRole('button', { name: 'products.actions.adjustStockDialog.save' })

beforeEach(() => {
  historial.valor = { movements: [], isLoading: false, hasRecentMovements: false, isError: false, isSuccess: true }
})

describe('AdjustStockDialog (D2)', () => {
  // NEW FEATURE TESTS
  it('sin poder leer el historial (Gratis/Pro o sin permiso): no dice «no hay movimientos recientes»', () => {
    historial.valor = { ...historial.valor, isError: true, isSuccess: false }
    pintar(10)
    expect(screen.queryByText('rawMaterials.movements.noRecentMovements')).toBeNull()
  })

  it('sin red, con la consulta en pausa (ni cargando ni con error): tampoco (Codex r2 #8)', () => {
    historial.valor = { ...historial.valor, isLoading: false, isError: false, isSuccess: false }
    pintar(10)
    expect(screen.queryByText('rawMaterials.movements.noRecentMovements')).toBeNull()
  })

  it('un saldo que una venta dejó en −5 se corrige con +2 (queda en −3), como lo acepta el SERVIDOR', () => {
    const onConfirm = pintar(-5)
    escribir('2')
    expect(screen.queryByText('products.actions.adjustStockDialog.cannotReduceBelowZero')).toBeNull()
    expect(screen.getByText('-3.00')).toBeTruthy()
    expect(guardar()).not.toBeDisabled()
    fireEvent.click(guardar())
    expect(onConfirm).toHaveBeenCalledWith(2, 'recount', '')
  })

  // REGRESSION TESTS
  it('con historial legible sigue diciendo «no hay movimientos recientes» si de verdad no hay', () => {
    pintar(10)
    expect(screen.getByText('rawMaterials.movements.noRecentMovements')).toBeTruthy()
  })

  it('un saldo de 3 no se lleva a −2 por ajuste: avisa y no deja guardar', () => {
    const onConfirm = pintar(3)
    escribir('-5')
    expect(screen.getByText('products.actions.adjustStockDialog.cannotReduceBelowZero')).toBeTruthy()
    expect(guardar()).toBeDisabled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
