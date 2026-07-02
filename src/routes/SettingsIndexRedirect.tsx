import { Navigate } from 'react-router-dom'
import { useAccess } from '@/hooks/use-access'

const ADMIN_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN']

/** Index of /settings — admins land on the venue side, others on their account. */
export default function SettingsIndexRedirect() {
  const { role, isLoading } = useAccess()
  if (isLoading) return null
  return <Navigate to={ADMIN_ROLES.includes(role ?? '') ? 'local' : 'profile'} replace />
}
