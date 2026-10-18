/**
 * useOnlineOrderingStatus — plan y permisos de Pedidos en línea (molde: use-delivery-status.ts).
 * 🔴 Atender pedidos existentes (ver, contestar, pausar) NO depende del plan; sólo configurar.
 * `useVenueTier` falla ABIERTO mientras carga: las consultas de configurar deben descontar `tierLoading`.
 */
import { useAccess } from '@/hooks/use-access'
import { useVenueTier } from '@/hooks/use-tier-feature-access'

export function useOnlineOrderingStatus() {
  const { can, role } = useAccess()
  const { hasFeatureAccess, isLoading: tierLoading } = useVenueTier()
  const canAnswer = can('orders:update')
  return {
    hasPlan: hasFeatureAccess('ONLINE_ORDERING'),
    tierLoading,
    canManage: can('online-orders:manage'),
    canAnswer,
    canCancel: can('orders:cancel-unpaid'),
    canPause: can('online-orders:pause'),
    // El servidor no registra latido para un superadmin sin membresía (P2-04); `useAccess` no distingue la
    // membresía, así que se trata a todo superadmin como "no mantiene abierta la tienda".
    keepsStoreOpen: canAnswer && role !== 'SUPERADMIN',
  }
}
