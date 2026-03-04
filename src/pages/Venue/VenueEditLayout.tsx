import { createContext, useContext, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NavTabs } from '@/components/ui/nav-tabs'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { useCurrentVenue } from '@/hooks/use-current-venue'

// Context para controlar los botones de acción desde las páginas hijas
interface VenueEditContextType {
  setActions: (actions: {
    // Legacy interface (for backwards compatibility)
    onSave?: () => void
    onCancel?: () => void
    isDirty?: boolean
    isLoading?: boolean
    canEdit?: boolean
    // New interface (for batch operations like Documents)
    primary?: {
      label: string
      onClick: () => void
      loading?: boolean
      disabled?: boolean
    }
    secondary?: {
      label: string
      onClick: () => void
      disabled?: boolean
    }
  }) => void
}

const VenueEditContext = createContext<VenueEditContextType | undefined>(undefined)

export const useVenueEditActions = () => {
  const context = useContext(VenueEditContext)
  if (!context) {
    throw new Error('useVenueEditActions must be used within VenueEditLayout')
  }
  return context
}

export default function VenueEditLayout() {
  const { fullBasePath } = useCurrentVenue()
  const navigate = useNavigate()
  const { t } = useTranslation('venue')

  const [actions, setActions] = useState<{
    // Legacy interface
    onSave?: () => void
    onCancel?: () => void
    isDirty?: boolean
    isLoading?: boolean
    canEdit?: boolean
    // New interface
    primary?: {
      label: string
      onClick: () => void
      loading?: boolean
      disabled?: boolean
    }
    secondary?: {
      label: string
      onClick: () => void
      disabled?: boolean
    }
  }>({})

  return (
    <VenueEditContext.Provider value={{ setActions }}>
      <div className="flex flex-col min-h-screen bg-background">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 flex flex-row justify-between w-full px-4 py-3 bg-background/95 backdrop-blur-sm">
          <div className="space-x-3 flex items-center">
            <Button variant="ghost" size="icon" onClick={() => navigate(fullBasePath)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <PageTitleWithInfo
              title={t('edit.title', { defaultValue: 'Venue Settings' })}
              className="text-xl font-semibold text-foreground"
              tooltip={t('info.edit', {
                defaultValue: 'Actualiza datos del venue, documentos e integraciones.',
              })}
            />
          </div>

          {/* Action Buttons - Support both legacy and new interface */}
          {(actions.onSave || actions.onCancel || actions.primary || actions.secondary) && (
            <div className="space-x-2 flex items-center">
              {/* Legacy interface */}
              {actions.isDirty && actions.onCancel && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={actions.onCancel}
                  disabled={actions.isLoading}
                >
                  {t('edit.cancel', { defaultValue: 'Cancel' })}
                </Button>
              )}
              {actions.onSave && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={actions.onSave}
                  disabled={!actions.canEdit || !actions.isDirty || actions.isLoading}
                >
                  {actions.isLoading ? t('edit.saving', { defaultValue: 'Saving...' }) : t('edit.save', { defaultValue: 'Save' })}
                </Button>
              )}

              {/* New interface */}
              {actions.secondary && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={actions.secondary.onClick}
                  disabled={actions.secondary.disabled}
                >
                  {actions.secondary.label}
                </Button>
              )}
              {actions.primary && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={actions.primary.onClick}
                  disabled={actions.primary.disabled || actions.primary.loading}
                >
                  {actions.primary.loading ? t('edit.saving', { defaultValue: 'Saving...' }) : actions.primary.label}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Horizontal Navigation */}
        <NavTabs
          className="sticky top-14 bg-background h-14 z-10"
          items={[
            { to: `${fullBasePath}/edit/basic-info`, label: t('edit.nav.basicInfo', { defaultValue: 'Información Básica' }) },
            { to: `${fullBasePath}/edit/contact-images`, label: t('edit.nav.contactImages', { defaultValue: 'Contacto e Imágenes' }) },
            { to: `${fullBasePath}/edit/documents`, label: t('edit.nav.documents', { defaultValue: 'Documentación' }) },
            { to: `${fullBasePath}/edit/integrations`, label: t('edit.nav.integrations', { defaultValue: 'Integraciones' }) },
          ]}
        />

        {/* Content */}
        <Outlet />
      </div>
    </VenueEditContext.Provider>
  )
}
