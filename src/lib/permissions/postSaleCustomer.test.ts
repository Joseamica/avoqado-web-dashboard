import { describe, expect, it } from 'vitest'
import { StaffRole } from '@/types'
import { hasDefaultPermission, PERMISSION_CATEGORIES } from './defaultPermissions'
import { PERMISSION_DEPENDENCIES } from './generated/permissionDependencies.generated'

describe('asignar el cliente olvidado de una venta cobrada', () => {
  it('lo ofrece de fábrica a gerencia y permite encontrarlo en el editor de roles', () => {
    for (const role of [StaffRole.MANAGER, StaffRole.ADMIN, StaffRole.OWNER, StaffRole.SUPERADMIN]) {
      expect(hasDefaultPermission(role, 'orders:attach-customer'), role).toBe(true)
    }
    expect(PERMISSION_CATEGORIES.ORDERS.permissions).toContain('orders:attach-customer')
  })

  it('no concede atribución histórica a caja ni a los roles operativos', () => {
    for (const role of [StaffRole.CASHIER, StaffRole.WAITER, StaffRole.HOST, StaffRole.KITCHEN, StaffRole.VIEWER]) {
      expect(hasDefaultPermission(role, 'orders:attach-customer'), role).toBe(false)
    }
  })

  it('incluye consultar venta y clientes sin conceder editar clientes o cobrar', () => {
    const included = PERMISSION_DEPENDENCIES['orders:attach-customer'] ?? []
    expect(included).toEqual(expect.arrayContaining(['orders:read', 'payments:read', 'customers:read']))
    expect(included).not.toContain('customers:create')
    expect(included).not.toContain('customers:update')
    expect(included).not.toContain('payments:create')
  })
})
