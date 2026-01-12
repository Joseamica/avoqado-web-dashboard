import React, { createContext, useContext, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  const { venueSlug } = useCurrentVenue()
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
        <div className="sticky top-0 z-10 flex flex-row justify-between w-full px-4 py-3 bg-background/95 border-b shadow-md backdrop-blur-sm">
          <div className="space-x-3 flex items-center">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/venues/${venueSlug}`)}>
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
        <VenueEditNav className="sticky top-14 bg-card h-14 z-10 shadow-sm" />

        {/* Content */}
        <Outlet />
      </div>
    </VenueEditContext.Provider>
  )
}

export function VenueEditNav({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  const { t } = useTranslation('venue')
  const { venueSlug } = useCurrentVenue()

  return (
    <nav className={cn('flex items-center space-x-6 lg:space-x-8 border-b border-border px-6', className)} {...props}>
      <NavLink
        to={`/venues/${venueSlug}/edit/basic-info`}
        className={({ isActive }) =>
          `text-sm font-medium transition-colors py-4 border-b-2 ${
            isActive ? 'text-foreground border-primary' : 'text-muted-foreground border-transparent hover:text-primary'
          }`
        }
      >
        {t('edit.nav.basicInfo', { defaultValue: 'Información Básica' })}
      </NavLink>
      <NavLink
        to={`/venues/${venueSlug}/edit/contact-images`}
        className={({ isActive }) =>
          `text-sm font-medium transition-colors py-4 border-b-2 ${
            isActive ? 'text-foreground border-primary' : 'text-muted-foreground border-transparent hover:text-primary'
          }`
        }
      >
        {t('edit.nav.contactImages', { defaultValue: 'Contacto e Imágenes' })}
      </NavLink>
      <NavLink
        to={`/venues/${venueSlug}/edit/documents`}
        className={({ isActive }) =>
          `text-sm font-medium transition-colors py-4 border-b-2 ${
            isActive ? 'text-foreground border-primary' : 'text-muted-foreground border-transparent hover:text-primary'
          }`
        }
      >
        {t('edit.nav.documents', { defaultValue: 'Documentación' })}
      </NavLink>
      <NavLink
        to={`/venues/${venueSlug}/edit/integrations`}
        className={({ isActive }) =>
          `text-sm font-medium transition-colors py-4 border-b-2 ${
            isActive ? 'text-foreground border-primary' : 'text-muted-foreground border-transparent hover:text-primary'
          }`
        }
      >
        {t('edit.nav.integrations', { defaultValue: 'Integraciones' })}
      </NavLink>
    </nav>
  )
}
