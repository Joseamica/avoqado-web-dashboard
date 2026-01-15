/**
 * Step1Setup - Venue selection, preset choice, and branding
 *
 * First step of the white-label wizard where:
 * 1. Select target venue
 * 2. Choose a preset (telecom, jewelry, retail, custom)
 * 3. Configure basic branding (name, logo, color)
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import {
  Building2,
  AlertCircle,
  Phone,
  Gem,
  ShoppingBag,
  Puzzle,
  Check,
  Upload,
  Palette,
  Loader2,
} from 'lucide-react'
import type { WhiteLabelTheme, PresetName } from '@/types/white-label'
import { getAllPresets } from '@/config/white-label-presets'
import { getAllVenues, type SuperadminVenue } from '@/services/superadmin.service'

// ============================================
// Types
// ============================================

interface Step1SetupProps {
  venueId: string
  venueName: string
  preset: PresetName | null
  theme: WhiteLabelTheme
  onVenueChange: (id: string, name: string) => void | Promise<void>
  onPresetChange: (preset: PresetName) => void
  onThemeChange: (theme: WhiteLabelTheme) => void
  errors: string[]
  isLoadingConfig?: boolean
  isEditMode?: boolean // True when editing existing config (venue is locked)
}

interface VenueOption {
  id: string
  name: string
  slug: string
}

// ============================================
// Preset Card Icons
// ============================================

const PRESET_ICONS: Record<PresetName, React.ElementType> = {
  telecom: Phone,
  jewelry: Gem,
  retail: ShoppingBag,
  custom: Puzzle,
}

// ============================================
// Component
// ============================================

export default function Step1Setup({
  venueId,
  venueName,
  preset,
  theme,
  onVenueChange,
  onPresetChange,
  onThemeChange,
  errors,
  isLoadingConfig = false,
  isEditMode = false,
}: Step1SetupProps) {
  const { t } = useTranslation('superadmin')
  const presets = useMemo(() => getAllPresets(), [])

  // Fetch venues for selection using superadmin service
  const { data: allVenues = [], isLoading: isLoadingVenues } = useQuery<SuperadminVenue[]>({
    queryKey: ['superadmin-venues'],
    queryFn: () => getAllVenues(true), // includeDemos = true to see all venues
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Map to simple venue options
  const venues: VenueOption[] = useMemo(
    () => allVenues.map(v => ({ id: v.id, name: v.name, slug: v.slug })),
    [allVenues]
  )

  // Color picker state
  const [showColorPicker, setShowColorPicker] = useState(false)

  // Handle venue selection - loads existing config if available
  const handleVenueSelect = (selectedVenueId: string) => {
    const venue = venues.find(v => v.id === selectedVenueId)
    if (venue) {
      // onVenueChange (loadExistingConfig) handles loading existing config and setting brand name
      onVenueChange(venue.id, venue.name)
    }
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Errors */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Section 1: Venue Selection */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{t('whiteLabelWizard.setup.venueTitle')}</h2>
          <p className="text-sm text-muted-foreground">
            {isEditMode
              ? t('whiteLabelWizard.setup.venueDescriptionEdit')
              : t('whiteLabelWizard.setup.venueDescription')}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Show dropdown only in create mode */}
          {!isEditMode && (
            <div className="space-y-2">
              <Label htmlFor="venue-select">{t('whiteLabelWizard.setup.selectVenue')}</Label>
              <Select value={venueId || '__none__'} onValueChange={(val) => val !== '__none__' && handleVenueSelect(val)}>
                <SelectTrigger id="venue-select">
                  <SelectValue placeholder={t('whiteLabelWizard.setup.venuePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" disabled>
                    {t('whiteLabelWizard.setup.venuePlaceholder')}
                  </SelectItem>
                  {isLoadingVenues ? (
                    <SelectItem value="loading" disabled>
                      {t('common.loading')}
                    </SelectItem>
                  ) : venues.length === 0 ? (
                    <SelectItem value="empty" disabled>
                      {t('whiteLabelWizard.setup.noVenues')}
                    </SelectItem>
                  ) : (
                    venues.map(venue => (
                      <SelectItem key={venue.id} value={venue.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <span>{venue.name}</span>
                          <span className="text-muted-foreground text-xs">({venue.slug})</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Show selected venue in both modes */}
          {venueId && (
            <div className={cn('space-y-2', isEditMode && 'sm:col-span-2')}>
              <Label>{isEditMode ? t('whiteLabelWizard.setup.editingVenue') : t('whiteLabelWizard.setup.selectedVenue')}</Label>
              <div className={cn(
                'flex items-center gap-2 p-3 rounded-lg border',
                isEditMode
                  ? 'bg-gradient-to-r from-amber-400/10 to-pink-500/10 border-amber-400/30'
                  : 'bg-primary/5 border-primary/20'
              )}>
                {isLoadingConfig ? (
                  <>
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    <span className="font-medium text-muted-foreground">{t('whiteLabelWizard.setup.loadingConfig')}</span>
                  </>
                ) : (
                  <>
                    <Building2 className={cn('w-5 h-5', isEditMode ? 'text-amber-500' : 'text-primary')} />
                    <span className="font-medium">{venueName}</span>
                    {isEditMode && (
                      <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {t('whiteLabelWizard.setup.locked')}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section 2: Preset Selection */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{t('whiteLabelWizard.setup.presetTitle')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('whiteLabelWizard.setup.presetDescription')}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {presets.map(presetOption => {
            const Icon = PRESET_ICONS[presetOption.name]
            const isSelected = preset === presetOption.name

            return (
              <Card
                key={presetOption.name}
                className={cn(
                  'cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5',
                  isSelected && 'ring-2 ring-primary border-primary'
                )}
                onClick={() => onPresetChange(presetOption.name)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div
                      className={cn(
                        'p-2 rounded-lg',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <CardTitle className="text-base mt-2">{presetOption.displayName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-xs line-clamp-3">
                    {presetOption.description}
                  </CardDescription>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {presetOption.enabledFeatures.length} features
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Section 3: Branding */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{t('whiteLabelWizard.setup.brandingTitle')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('whiteLabelWizard.setup.brandingDescription')}
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-6">
            {/* Brand Name */}
            <div className="space-y-2">
              <Label htmlFor="brand-name">{t('whiteLabelWizard.setup.brandName')}</Label>
              <Input
                id="brand-name"
                value={theme.brandName}
                onChange={e => onThemeChange({ ...theme, brandName: e.target.value })}
                placeholder={t('whiteLabelWizard.setup.brandNamePlaceholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('whiteLabelWizard.setup.brandNameHelp')}
              </p>
            </div>

            {/* Primary Color */}
            <div className="space-y-2">
              <Label htmlFor="primary-color">{t('whiteLabelWizard.setup.primaryColor')}</Label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="w-12 h-12 rounded-lg border-2 border-border shadow-sm cursor-pointer transition-transform hover:scale-105"
                  style={{ backgroundColor: theme.primaryColor }}
                  onClick={() => setShowColorPicker(!showColorPicker)}
                />
                <Input
                  id="primary-color"
                  value={theme.primaryColor}
                  onChange={e => {
                    // Validate hex color
                    const color = e.target.value
                    if (/^#[0-9A-Fa-f]{6}$/.test(color) || /^#[0-9A-Fa-f]{3}$/.test(color)) {
                      onThemeChange({ ...theme, primaryColor: color })
                    } else if (/^#[0-9A-Fa-f]{0,6}$/.test(color)) {
                      // Allow partial input
                      onThemeChange({ ...theme, primaryColor: color })
                    }
                  }}
                  placeholder="#000000"
                  className="w-32 font-mono"
                />
                <Palette className="w-5 h-5 text-muted-foreground" />
              </div>

              {/* Quick Colors */}
              <div className="flex flex-wrap gap-2 mt-2">
                {['#FF6B00', '#C9A962', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#000000'].map(
                  color => (
                    <button
                      key={color}
                      type="button"
                      className={cn(
                        'w-8 h-8 rounded-md border-2 transition-transform hover:scale-110',
                        theme.primaryColor === color
                          ? 'border-primary ring-2 ring-primary/30'
                          : 'border-border'
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => onThemeChange({ ...theme, primaryColor: color })}
                      title={color}
                    />
                  )
                )}
              </div>
            </div>

            {/* Logo Upload (placeholder for now) */}
            <div className="space-y-2">
              <Label>{t('whiteLabelWizard.setup.logo')}</Label>
              <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {t('whiteLabelWizard.setup.logoUploadHint')}
                </p>
                <Button variant="outline" size="sm" className="mt-3" disabled>
                  {t('whiteLabelWizard.setup.uploadLogo')}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  {t('whiteLabelWizard.setup.logoComingSoon')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Preview */}
      {preset && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{t('whiteLabelWizard.setup.quickPreview')}</h2>
          </div>

          <Card className="overflow-hidden">
            <div
              className="h-16 flex items-center px-6 gap-3"
              style={{ backgroundColor: theme.primaryColor }}
            >
              {theme.logo ? (
                <img src={theme.logo} alt="Logo" className="h-8" />
              ) : (
                <div className="w-8 h-8 rounded bg-primary-foreground/20" />
              )}
              <span className="font-bold text-primary-foreground text-lg">{theme.brandName || 'Dashboard'}</span>
            </div>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                {t('whiteLabelWizard.setup.previewHint')}
              </p>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  )
}
