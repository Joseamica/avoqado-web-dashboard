import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { ToastAction } from '@/components/ui/toast'
import { useToast } from '@/hooks/use-toast'
import { buildMasterCatalogErrorPresentation } from './errors'
import { useMasterCatalogAccess } from './use-master-catalog-access'

export function useMasterCatalogError(organizationId: string | null | undefined) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const navigate = useNavigate()
  const { canRead } = useMasterCatalogAccess({ organizationId })

  return useCallback(
    (error: unknown): boolean => {
      const presentation = buildMasterCatalogErrorPresentation(error, { organizationId, canRead, t })
      if (!presentation) return false

      toast({
        title: presentation.title,
        description: presentation.description,
        variant: 'destructive',
        action: presentation.actionPath ? (
          <ToastAction altText={presentation.actionLabel} onClick={() => navigate(presentation.actionPath!)}>
            {presentation.actionLabel}
          </ToastAction>
        ) : undefined,
      })
      return true
    },
    [canRead, navigate, organizationId, t, toast],
  )
}
