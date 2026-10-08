import { useAccess } from '@/hooks/use-access'
import { useStaffPayAccess } from '@/hooks/useStaffPay'

/**
 * Niveles y asignaciones exigen «Configurar pago al personal» (`staffpay:manage`) en TODAS las sedes de la organización, no sólo en
 * la actual (E6a-fix3 C2, hermano de `puedeAdministrarOrganizacion`). `GET /access.puedeConfigurarOrganizacion` es la misma regla
 * que decide el 403; un servidor previo no lo manda ⇒ se trata como `true`. `falta`: lo tiene aquí pero no en todas ⇒ se ve
 * apagado y se dice por qué (`orgConfigPermission`). Sin el permiso aquí, el módulo sigue como siempre (oculto o sólo lectura).
 */
export function usePermisoDeConfigurar() {
  const { can } = useAccess()
  const { data: acceso } = useStaffPayAccess(can('staffpay:read'))
  const aqui = can('staffpay:manage')
  const falta = aqui && acceso?.puedeConfigurarOrganizacion === false
  return { aqui, puede: aqui && !falta, falta }
}
