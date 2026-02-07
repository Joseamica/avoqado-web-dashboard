/**
 * Step4Preview - Final preview and navigation ordering
 *
 * Fourth step of the white-label wizard where users can:
 * 1. See a visual preview of the dashboard
 * 2. Reorder navigation items via drag and drop
 * 3. Review the final configuration before saving
 */

import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  GripVertical,
  Eye,
  Palette,
  Puzzle,
  Settings,
  LayoutDashboard,
  Check,
  Pencil,
  Save,
  X,
} from 'lucide-react'
import type { NavigationItem } from '@/types/white-label'
import type { WizardState } from '../WhiteLabelWizard'
import { FEATURE_REGISTRY } from '@/config/feature-registry'
import { getIconComponent } from '@/components/WhiteLabel/DynamicFeatureLoader'

// ============================================
// Types
// ============================================

interface Step4PreviewProps {
  state: WizardState
  onNavigationChange: (items: NavigationItem[]) => void
  errors: string[]
}

// ============================================
// Component
// ============================================

export default function Step4Preview({
  state,
  onNavigationChange,
  errors,
}: Step4PreviewProps) {
  const { t } = useTranslation('superadmin')

  // State for editing labels
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = state.navigation.findIndex(item => item.id === active.id)
    const newIndex = state.navigation.findIndex(item => item.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const newItems = arrayMove(state.navigation, oldIndex, newIndex).map((item, i) => ({
      ...item,
      order: i,
    }))
    onNavigationChange(newItems)
  }, [state.navigation, onNavigationChange])

  const activeItem = activeId ? state.navigation.find(item => item.id === activeId) : null

  // Start editing a label
  const startEditingLabel = useCallback((item: NavigationItem) => {
    setEditingItemId(item.id)
    setEditingLabel(item.label || '')
  }, [])

  // Save edited label
  const saveLabel = useCallback(() => {
    if (!editingItemId) return
    const newItems = state.navigation.map(item =>
      item.id === editingItemId
        ? { ...item, label: editingLabel.trim() || item.label }
        : item
    )
    onNavigationChange(newItems)
    setEditingItemId(null)
    setEditingLabel('')
  }, [editingItemId, editingLabel, state.navigation, onNavigationChange])

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setEditingItemId(null)
    setEditingLabel('')
  }, [])

  return (
    <div className="space-y-6">
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

      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">{t('whiteLabelWizard.preview.title')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('whiteLabelWizard.preview.description')}
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Navigation Editor */}
        <div className="col-span-12 lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" />
                {t('whiteLabelWizard.preview.navigation')}
              </CardTitle>
              <CardDescription>
                {t('whiteLabelWizard.preview.navigationHelp')}
              </CardDescription>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-blue-500/50" />
                  <span className="text-[11px] text-muted-foreground">Core</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-violet-500/50" />
                  <span className="text-[11px] text-muted-foreground">Modulo</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={state.navigation.map(item => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {state.navigation.map(item => (
                    <SortableNavItem
                      key={item.id}
                      item={item}
                      isEditing={editingItemId === item.id}
                      editingLabel={editingLabel}
                      onEditingLabelChange={setEditingLabel}
                      onStartEdit={startEditingLabel}
                      onSaveLabel={saveLabel}
                      onCancelEdit={cancelEditing}
                    />
                  ))}
                </SortableContext>

                <DragOverlay>
                  {activeItem && (
                    <NavItemContent
                      item={activeItem}
                      isEditing={false}
                      isDragOverlay
                    />
                  )}
                </DragOverlay>
              </DndContext>

              {state.navigation.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {t('whiteLabelWizard.preview.noNavItems')}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Visual Preview */}
        <div className="col-span-12 lg:col-span-8">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="w-4 h-4" />
                {t('whiteLabelWizard.preview.visualPreview')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Mock Dashboard Preview */}
              <div className="border-t">
                {/* Header */}
                <div
                  className="h-14 flex items-center px-4 gap-3"
                  style={{ backgroundColor: state.theme.primaryColor }}
                >
                  {state.theme.logo ? (
                    <img src={state.theme.logo} alt="Logo" className="h-8" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-primary-foreground/20 flex items-center justify-center">
                      <LayoutDashboard className="w-4 h-4 text-primary-foreground/80" />
                    </div>
                  )}
                  <span className="font-bold text-primary-foreground">
                    {state.theme.brandName || 'Dashboard'}
                  </span>
                </div>

                {/* Content Area */}
                <div className="flex min-h-[300px]">
                  {/* Sidebar */}
                  <div className="w-48 border-r bg-muted/30 p-3 space-y-1">
                    {state.navigation.map((item, index) => {
                      const feature = item.featureCode
                        ? FEATURE_REGISTRY[item.featureCode]
                        : null
                      const IconComponent = item.icon
                        ? getIconComponent(item.icon)
                        : null
                      const isFirst = index === 0

                      return (
                        <div
                          key={item.id}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                            isFirst
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-muted'
                          )}
                        >
                          {IconComponent && <IconComponent className="w-4 h-4" />}
                          <span className="truncate">
                            {item.label || feature?.name}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 p-6">
                    <div className="space-y-4">
                      {/* Breadcrumb */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{state.theme.brandName}</span>
                        <span>/</span>
                        <span className="text-foreground">
                          {state.navigation[0]?.label || 'Home'}
                        </span>
                      </div>

                      {/* Page Title */}
                      <h1 className="text-2xl font-bold">
                        {state.navigation[0]?.label || 'Dashboard'}
                      </h1>

                      {/* Placeholder Content */}
                      <div className="grid grid-cols-3 gap-4">
                        {[1, 2, 3].map(i => (
                          <div
                            key={i}
                            className="h-24 rounded-lg bg-muted/50 border border-dashed flex items-center justify-center"
                          >
                            <span className="text-xs text-muted-foreground">
                              {t('whiteLabelWizard.preview.contentPlaceholder')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Configuration Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Check className="w-4 h-4" />
            {t('whiteLabelWizard.preview.configSummary')}
          </CardTitle>
          <CardDescription>
            {t('whiteLabelWizard.preview.configSummaryDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-3">
            {/* Branding */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Palette className="w-4 h-4 text-muted-foreground" />
                {t('whiteLabelWizard.preview.branding')}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('whiteLabelWizard.preview.brandName')}</span>
                  <span className="font-medium">{state.theme.brandName}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('whiteLabelWizard.preview.primaryColor')}</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded border"
                      style={{ backgroundColor: state.theme.primaryColor }}
                    />
                    <span className="font-mono text-xs">{state.theme.primaryColor}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('whiteLabelWizard.preview.logo')}</span>
                  <span className="font-medium">
                    {state.theme.logo
                      ? t('whiteLabelWizard.preview.logoSet')
                      : t('whiteLabelWizard.preview.noLogo')}
                  </span>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Puzzle className="w-4 h-4 text-muted-foreground" />
                {t('whiteLabelWizard.preview.features')}
              </div>
              <div className="flex flex-wrap gap-2">
                {state.enabledFeatures.map(ef => {
                  const feature = FEATURE_REGISTRY[ef.code]
                  return (
                    <Badge
                      key={ef.code}
                      variant="secondary"
                      className="text-xs"
                    >
                      {feature?.name || ef.code}
                    </Badge>
                  )
                })}
              </div>
              {state.enabledFeatures.length === 0 && (
                <span className="text-sm text-muted-foreground">
                  {t('whiteLabelWizard.preview.noFeatures')}
                </span>
              )}
            </div>

            {/* Configuration */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Settings className="w-4 h-4 text-muted-foreground" />
                {t('whiteLabelWizard.preview.configuration')}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('whiteLabelWizard.preview.totalFeatures')}
                  </span>
                  <Badge variant="outline">{state.enabledFeatures.length}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('whiteLabelWizard.preview.navItems')}
                  </span>
                  <Badge variant="outline">{state.navigation.length}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('whiteLabelWizard.preview.venue')}
                  </span>
                  <span className="font-medium truncate max-w-[120px]">
                    {state.venueName || '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// Sortable Nav Item
// ============================================

interface SortableNavItemProps {
  item: NavigationItem
  isEditing: boolean
  editingLabel: string
  onEditingLabelChange: (value: string) => void
  onStartEdit: (item: NavigationItem) => void
  onSaveLabel: () => void
  onCancelEdit: () => void
}

function SortableNavItem({
  item,
  isEditing,
  editingLabel,
  onEditingLabelChange,
  onStartEdit,
  onSaveLabel,
  onCancelEdit,
}: SortableNavItemProps) {
  const { t } = useTranslation('superadmin')
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const feature = item.featureCode ? FEATURE_REGISTRY[item.featureCode] : null
  const IconComponent = item.icon ? getIconComponent(item.icon) : null
  const isCore = feature?.source === 'avoqado_core'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 p-3 rounded-lg border bg-card transition-colors mb-2',
        isDragging && 'opacity-30',
        isCore ? 'border-l-2 border-l-blue-500/50' : 'border-l-2 border-l-violet-500/50',
      )}
    >
      <button
        className="touch-none cursor-grab active:cursor-grabbing p-0.5 -ml-1 text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {isEditing ? (
        <>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {IconComponent && (
              <IconComponent className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            )}
            <Input
              value={editingLabel}
              onChange={e => onEditingLabelChange(e.target.value)}
              placeholder={feature?.name || item.featureCode || ''}
              className="h-8 text-sm"
              onKeyDown={e => {
                if (e.key === 'Enter') onSaveLabel()
                if (e.key === 'Escape') onCancelEdit()
              }}
              autoFocus
            />
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
              onClick={onSaveLabel}
              title={t('whiteLabelWizard.preview.saveLabel')}
            >
              <Save className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
              onClick={onCancelEdit}
              title={t('common.cancel')}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {IconComponent && (
              <IconComponent className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            )}
            <span className="text-sm font-medium truncate">
              {item.label || feature?.name || item.featureCode}
            </span>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-1.5 py-0 h-4 flex-shrink-0',
                isCore
                  ? 'border-blue-500/30 text-blue-500'
                  : 'border-violet-500/30 text-violet-500',
              )}
            >
              {isCore ? 'Core' : 'Modulo'}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={() => onStartEdit(item)}
            title={t('whiteLabelWizard.preview.editLabel')}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        </>
      )}
    </div>
  )
}

// ============================================
// Nav Item Content (for DragOverlay)
// ============================================

interface NavItemContentProps {
  item: NavigationItem
  isEditing: boolean
  isDragOverlay?: boolean
}

function NavItemContent({ item, isDragOverlay }: NavItemContentProps) {
  const feature = item.featureCode ? FEATURE_REGISTRY[item.featureCode] : null
  const IconComponent = item.icon ? getIconComponent(item.icon) : null
  const isCore = feature?.source === 'avoqado_core'

  return (
    <div
      className={cn(
        'flex items-center gap-2 p-3 rounded-lg border bg-card shadow-lg',
        isDragOverlay && 'ring-2 ring-primary/30',
        isCore ? 'border-l-2 border-l-blue-500/50' : 'border-l-2 border-l-violet-500/50',
      )}
    >
      <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {IconComponent && (
          <IconComponent className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
        <span className="text-sm font-medium truncate">
          {item.label || feature?.name || item.featureCode}
        </span>
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] px-1.5 py-0 h-4 flex-shrink-0',
            isCore
              ? 'border-blue-500/30 text-blue-500'
              : 'border-violet-500/30 text-violet-500',
          )}
        >
          {isCore ? 'Core' : 'Modulo'}
        </Badge>
      </div>
    </div>
  )
}
