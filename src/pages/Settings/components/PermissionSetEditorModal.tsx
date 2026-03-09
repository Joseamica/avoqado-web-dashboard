import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, Settings2, FolderOpen } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/useDebounce'
import { useToast } from '@/hooks/use-toast'

import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PERMISSION_CATEGORIES } from '@/lib/permissions/roleHierarchy'
import { DEFAULT_PERMISSIONS } from '@/lib/permissions/defaultPermissions'
import { DASHBOARD_SUPER_CATEGORIES, TPV_SUPER_CATEGORIES, filterPermissionsBySearch } from '@/lib/permissions/permissionGroups'
import { StaffRole } from '@/types'
import permissionSetService, { type PermissionSet } from '@/services/permissionSet.service'

import PermissionSearch from './PermissionSearch'
import PermissionCategoryNav from './PermissionCategoryNav'
import PermissionDetailPanel from './PermissionDetailPanel'
import PermissionSuperCategory from './PermissionSuperCategory'

type EditorStep = 'preset' | 'customize'

// Permission level presets based on role defaults
const PERMISSION_PRESETS = [
  {
    id: 'standard' as const,
    role: StaffRole.CASHIER,
  },
  {
    id: 'enhanced' as const,
    role: StaffRole.MANAGER,
  },
  {
    id: 'complete' as const,
    role: StaffRole.ADMIN,
  },
]

interface PermissionSetEditorModalProps {
  open: boolean
  onClose: () => void
  permissionSet: PermissionSet | null
  venueId: string
}

export default function PermissionSetEditorModal({ open, onClose, permissionSet, venueId }: PermissionSetEditorModalProps) {
  const { t } = useTranslation('settings')
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const isEditing = !!permissionSet

  // Step state
  const [step, setStep] = useState<EditorStep>('preset')
  const [selectedPreset, setSelectedPreset] = useState<string>('standard')

  // Form state
  const [name, setName] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])

  // UI state for customize step
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Load existing data when editing, or reset for creation
  useEffect(() => {
    if (open) {
      if (permissionSet) {
        // Editing: go straight to customize step
        setName(permissionSet.name)
        setSelectedPermissions([...permissionSet.permissions])
        setStep('customize')
      } else {
        // Creating: start at preset step with standard preset loaded
        setName('')
        setSelectedPreset('standard')
        setSelectedPermissions([...(DEFAULT_PERMISSIONS[StaffRole.CASHIER] || [])])
        setStep('preset')
      }
      setSearchTerm('')
      setExpandedCategories(new Set())
      // Auto-select first category for customize step
      const allSuperCats = [...DASHBOARD_SUPER_CATEGORIES, ...TPV_SUPER_CATEGORIES]
      if (allSuperCats.length > 0 && allSuperCats[0].categoryKeys.length > 0) {
        setSelectedCategoryKey(allSuperCats[0].categoryKeys[0])
      } else {
        setSelectedCategoryKey(null)
      }
    }
  }, [open, permissionSet])

  const selectedPermissionsSet = useMemo(() => new Set(selectedPermissions), [selectedPermissions])

  // Filter super categories by search
  const filteredAllCategories = useMemo(
    () => [
      ...filterPermissionsBySearch(DASHBOARD_SUPER_CATEGORIES, debouncedSearchTerm),
      ...filterPermissionsBySearch(TPV_SUPER_CATEGORIES, debouncedSearchTerm),
    ],
    [debouncedSearchTerm],
  )

  const handlePermissionChange = useCallback((permission: string, enabled: boolean) => {
    setSelectedPermissions(prev => (enabled ? [...prev, permission] : prev.filter(p => p !== permission)))
  }, [])

  const getCategoryStatus = useCallback(
    (categoryKey: keyof typeof PERMISSION_CATEGORIES) => {
      const category = PERMISSION_CATEGORIES[categoryKey]
      if (!category) return { enabled: 0, total: 0, status: 'off' as const }

      const enabled = category.permissions.filter(p => selectedPermissionsSet.has(p)).length
      const total = category.permissions.length

      let status: 'active' | 'partial' | 'off'
      if (enabled === total) status = 'active'
      else if (enabled > 0) status = 'partial'
      else status = 'off'

      return { enabled, total, status }
    },
    [selectedPermissionsSet],
  )

  const toggleCategoryExpansion = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }, [])

  // Select a preset and immediately load its permissions
  const handlePresetSelect = useCallback((presetId: string) => {
    setSelectedPreset(presetId)
    const preset = PERMISSION_PRESETS.find(p => p.id === presetId)
    if (preset) {
      setSelectedPermissions([...(DEFAULT_PERMISSIONS[preset.role] || [])])
    }
  }, [])

  // Go to customize step (permissions already loaded from preset)
  const handleCustomize = () => {
    setStep('customize')
  }

  // Mutations
  const createMutation = useMutation({
    mutationFn: (perms: string[]) =>
      permissionSetService.create(venueId, {
        name: name.trim(),
        permissions: perms,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-sets', venueId] })
      toast({ title: t('rolePermissions.permissionSets.createSuccess', 'Permission set created') })
      onClose()
    },
    onError: () => {
      toast({
        title: t('rolePermissions.permissionSets.createError', 'Failed to create permission set'),
        variant: 'destructive',
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      permissionSetService.update(venueId, permissionSet!.id, {
        name: name.trim(),
        permissions: selectedPermissions,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-sets', venueId] })
      toast({ title: t('rolePermissions.permissionSets.updateSuccess', 'Permission set updated') })
      onClose()
    },
    onError: () => {
      toast({
        title: t('rolePermissions.permissionSets.updateError', 'Failed to update permission set'),
        variant: 'destructive',
      })
    },
  })

  const handleSave = () => {
    if (!name.trim()) return
    if (selectedPermissions.length === 0) return

    if (isEditing) {
      updateMutation.mutate()
    } else {
      createMutation.mutate(selectedPermissions)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending
  const canSave = name.trim().length > 0 && selectedPermissions.length > 0

  // Determine title and header actions based on step
  const title =
    step === 'preset'
      ? isEditing
        ? t('rolePermissions.permissionSets.editTitle', 'Edit Permission Set')
        : t('rolePermissions.permissionSets.createTitle', 'Create Permission Set')
      : name.trim() || t('rolePermissions.permissionSets.createTitle', 'Create Permission Set')

  return (
    <FullScreenModal
      open={open}
      onClose={onClose}
      title={title}
      actions={
        <div className="flex items-center gap-2">
          {step === 'preset' && (
            <>
              <Button variant="outline" onClick={handleCustomize} disabled={isSaving} size="sm" className="gap-1.5">
                <Settings2 className="h-4 w-4" />
                {t('rolePermissions.permissionSets.customize', 'Personalizar')}
              </Button>
              <Button onClick={handleSave} disabled={!canSave || isSaving} size="sm" className="gap-1.5">
                <Save className="h-4 w-4" />
                {isSaving
                  ? t('rolePermissions.permissionSets.saving', 'Saving...')
                  : t('rolePermissions.permissionSets.saveBtn', 'Guardar')}
              </Button>
            </>
          )}
          {step === 'customize' && (
            <Button onClick={handleSave} disabled={!canSave || isSaving} size="sm" className="gap-1.5">
              <Save className="h-4 w-4" />
              {isSaving
                ? t('rolePermissions.permissionSets.saving', 'Saving...')
                : t('rolePermissions.permissionSets.saveChanges', 'Guardar Cambios')}
            </Button>
          )}
        </div>
      }
    >
      {/* ========== STEP 1: Preset Selection ========== */}
      {step === 'preset' && (
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
          {/* Name Input */}
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('rolePermissions.permissionSets.namePlaceholder', 'Nombre del conjunto de permisos')}
            className="text-base h-12"
            autoFocus
          />

          {/* Permission Level */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold">{t('rolePermissions.permissionSets.levelTitle', 'Nivel de permiso')}</h3>
            <div className="space-y-3">
              {PERMISSION_PRESETS.map(preset => {
                const presetPerms = DEFAULT_PERMISSIONS[preset.role] || []
                const isSelected = selectedPreset === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetSelect(preset.id)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-border/80 hover:bg-accent/5'
                    }`}
                  >
                    <div className="font-medium">{t(`rolePermissions.permissionSets.presets.${preset.id}.title`, preset.id)}</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t(`rolePermissions.permissionSets.presets.${preset.id}.description`, '')}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2.5 text-xs text-muted-foreground">
                      <FolderOpen className="h-3.5 w-3.5" />
                      {t(`rolePermissions.permissionSets.presets.${preset.id}.examples`, `${presetPerms.length} permisos`)}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            {t(
              'rolePermissions.permissionSets.presetHint',
              'Personaliza el conjunto de permisos de estos niveles en función de las necesidades de tu negocio.',
            )}
          </p>
        </div>
      )}

      {/* ========== STEP 2: Customize (same UI as role editor) ========== */}
      {step === 'customize' && (
        <div className="flex flex-col h-full">
          {/* Name + Search */}
          <div className="px-4 pt-4 pb-2 flex flex-col sm:flex-row gap-2">
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('rolePermissions.permissionSets.namePlaceholder', 'Nombre del conjunto de permisos')}
              className="h-10 sm:w-64"
            />
            <PermissionSearch value={searchTerm} onChange={setSearchTerm} className="flex-1 max-w-lg" />
          </div>

          {/* Two-column layout: Category Nav | Detail Panel */}
          <div className="flex-1 grid gap-5 md:grid-cols-[260px_1fr] px-4 pb-4 min-h-0">
            {/* Left: Category navigation (desktop) */}
            <div className="hidden md:block rounded-xl border border-border overflow-hidden self-start h-[calc(100vh-200px)] sticky top-0">
              <PermissionCategoryNav
                superCategories={filteredAllCategories}
                selectedCategoryKey={selectedCategoryKey}
                onSelectCategory={setSelectedCategoryKey}
                getCategoryStatus={getCategoryStatus}
                className="h-full"
              />
            </div>

            {/* Right: Detail panel */}
            <div className="min-w-0 overflow-y-auto">
              {/* Mobile: collapsible list */}
              <div className="md:hidden space-y-3">
                {filteredAllCategories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">{t('rolePermissions.noResultsFound')}</div>
                ) : (
                  filteredAllCategories.map(superCat => (
                    <PermissionSuperCategory
                      key={superCat.id}
                      superCategory={superCat}
                      selectedPermissions={selectedPermissionsSet}
                      defaultPermissions={[]}
                      onChange={handlePermissionChange}
                      searchTerm={debouncedSearchTerm}
                      isExpanded={expandedCategories.has(superCat.id)}
                      onToggleExpand={() => toggleCategoryExpansion(superCat.id)}
                    />
                  ))
                )}
              </div>

              {/* Desktop: selected category detail */}
              <div className="hidden md:block">
                {selectedCategoryKey ? (
                  <PermissionDetailPanel
                    categoryKey={selectedCategoryKey}
                    selectedPermissions={selectedPermissionsSet}
                    defaultPermissions={[]}
                    onChange={handlePermissionChange}
                    searchTerm={debouncedSearchTerm}
                  />
                ) : (
                  <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                    {t('rolePermissions.permissionSets.selectCategory', 'Selecciona una categoría')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </FullScreenModal>
  )
}
