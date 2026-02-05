/**
 * RoleAccessPreview - Shows which white-label features a role can access
 *
 * Used in the team invitation form to show the user what features
 * the invited team member will have access to based on their role.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { FEATURE_REGISTRY } from '@/config/feature-registry'
import { getAccessibleFeaturesForRole } from '@/hooks/use-access'
import type { EnabledFeature } from '@/types/white-label'
import type { StaffRole } from '@/types'
import { CheckCircle2, XCircle, Shield } from 'lucide-react'

interface RoleAccessPreviewProps {
  /** The role to preview access for */
  role: StaffRole
  /** The enabled features from white-label config */
  enabledFeatures: EnabledFeature[]
}

export function RoleAccessPreview({ role, enabledFeatures }: RoleAccessPreviewProps) {
  const { t } = useTranslation('team')

  // Get accessible and inaccessible features for this role
  const { accessible, inaccessible } = useMemo(() => {
    return getAccessibleFeaturesForRole(enabledFeatures, role)
  }, [enabledFeatures, role])

  // If there are no features configured, don't show the preview
  if (enabledFeatures.length === 0) {
    return null
  }

  return (
    <div className="mt-4 p-4 rounded-xl border border-border/50 bg-muted/30">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          {t('invite.accessPreview.title', { defaultValue: 'Acceso a funciones' })}
        </span>
      </div>

      {/* Accessible Features */}
      {accessible.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            <span className="text-xs text-muted-foreground">
              {t('invite.accessPreview.canAccess', { defaultValue: 'Podra acceder a:' })}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {accessible.map(feature => {
              const def = FEATURE_REGISTRY[feature.code]
              return (
                <Badge
                  key={feature.code}
                  variant="secondary"
                  className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                >
                  {def?.name || feature.code}
                </Badge>
              )
            })}
          </div>
        </div>
      )}

      {/* Inaccessible Features */}
      {inaccessible.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {t('invite.accessPreview.cannotAccess', { defaultValue: 'Sin acceso a:' })}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {inaccessible.map(feature => {
              const def = FEATURE_REGISTRY[feature.code]
              return (
                <Badge
                  key={feature.code}
                  variant="outline"
                  className="text-xs text-muted-foreground"
                >
                  {def?.name || feature.code}
                </Badge>
              )
            })}
          </div>
        </div>
      )}

      {/* All accessible message */}
      {accessible.length === enabledFeatures.length && (
        <p className="text-xs text-green-600 dark:text-green-400">
          {t('invite.accessPreview.fullAccess', { defaultValue: 'Tendra acceso completo a todas las funciones.' })}
        </p>
      )}
    </div>
  )
}

export default RoleAccessPreview
