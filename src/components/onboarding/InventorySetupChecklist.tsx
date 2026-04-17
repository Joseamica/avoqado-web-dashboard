import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Rocket, X } from 'lucide-react'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Button } from '@/components/ui/button'
import { useOnboardingKey } from '@/hooks/useOnboardingState'
import { cn } from '@/lib/utils'

/**
 * Shopify-style setup checklist for first-time inventory admins.
 *
 * State is persisted via `StaffOnboardingState` on the backend under the key
 * `inventory-checklist`, scoped per staff + venue. Progress syncs across
 * devices and is available for analytics.
 *
 * Each step can be:
 *  - "Hacerlo" → navigates to the target page (admin completes the flow there).
 *  - "Ya lo hice" → marks as done manually.
 *
 * The widget auto-hides once all required (non-optional) steps are done.
 * User can also dismiss forever with the X button.
 */

type StepId = 'category' | 'ingredient' | 'product' | 'purchaseOrder' | 'adjustStock'

interface StepState {
  done: boolean
  doneAt?: string
}

interface ChecklistState {
  dismissed: boolean
  collapsed: boolean
  steps: Partial<Record<StepId, StepState>>
}

const DEFAULT_STATE: ChecklistState = {
  dismissed: false,
  collapsed: false,
  steps: {},
}

const STORAGE_KEY = 'inventory-checklist'

interface StepConfig {
  id: StepId
  titleKey: string
  titleFallback: string
  descriptionKey: string
  descriptionFallback: string
  /** Relative path (appended to fullBasePath) */
  path: string
  /** Optional — step is not required to complete the checklist */
  optional?: boolean
}

const STEPS: StepConfig[] = [
  {
    id: 'category',
    titleKey: 'checklist.steps.category.title',
    titleFallback: 'Crea tu primera categoría',
    descriptionKey: 'checklist.steps.category.description',
    descriptionFallback: 'Las categorías agrupan productos en el menú. Sin categoría no puedes crear productos.',
    path: 'menumaker/categories',
  },
  {
    id: 'ingredient',
    titleKey: 'checklist.steps.ingredient.title',
    titleFallback: 'Crea tu primer ingrediente',
    descriptionKey: 'checklist.steps.ingredient.description',
    descriptionFallback: 'Solo si vas a usar productos con receta (shakes, bebidas). Puedes saltarte este paso si todo es por unidad.',
    path: 'inventory/ingredients',
    optional: true,
  },
  {
    id: 'product',
    titleKey: 'checklist.steps.product.title',
    titleFallback: 'Crea tu primer producto',
    descriptionKey: 'checklist.steps.product.description',
    descriptionFallback: 'Elige entre por unidad (hoodies) o por receta (shakes). Necesita una categoría ya creada.',
    path: 'menumaker/products',
  },
  {
    id: 'purchaseOrder',
    titleKey: 'checklist.steps.purchaseOrder.title',
    titleFallback: 'Haz tu primera orden de compra',
    descriptionKey: 'checklist.steps.purchaseOrder.description',
    descriptionFallback: 'Le pides mercancía al proveedor. Al recibirla se crean los lotes con costo — esto permite calcular márgenes.',
    path: 'inventory/purchase-orders',
  },
  {
    id: 'adjustStock',
    titleKey: 'checklist.steps.adjustStock.title',
    titleFallback: 'Haz tu primer ajuste de stock',
    descriptionKey: 'checklist.steps.adjustStock.description',
    descriptionFallback: 'Aprende la operación más común del día: ajustar existencias por merma, daño o conteo.',
    path: 'inventory/stock-overview',
  },
]

function normalize(raw: unknown): ChecklistState {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_STATE }
  const r = raw as Partial<ChecklistState>
  return {
    dismissed: !!r.dismissed,
    collapsed: !!r.collapsed,
    steps: r.steps ?? {},
  }
}

export function InventorySetupChecklist() {
  const { t } = useTranslation('inventory')
  const { fullBasePath } = useCurrentVenue()
  const navigate = useNavigate()

  const { value: rawState, isLoaded, setValue } = useOnboardingKey<ChecklistState>(
    STORAGE_KEY,
    DEFAULT_STATE,
  )
  const state = useMemo(() => normalize(rawState), [rawState])

  const requiredSteps = useMemo(() => STEPS.filter(s => !s.optional), [])
  const doneCount = useMemo(
    () => STEPS.filter(s => state.steps[s.id]?.done).length,
    [state.steps],
  )
  const requiredDoneCount = useMemo(
    () => requiredSteps.filter(s => state.steps[s.id]?.done).length,
    [requiredSteps, state.steps],
  )
  const allRequiredDone = requiredDoneCount === requiredSteps.length
  const totalSteps = STEPS.length

  const patch = (next: Partial<ChecklistState>) => {
    setValue({ ...state, ...next })
  }

  const markDone = (id: StepId) => {
    patch({
      steps: {
        ...state.steps,
        [id]: { done: true, doneAt: new Date().toISOString() },
      },
    })
  }

  const handleGoTo = (id: StepId, path: string) => {
    // Optimistically mark done — user is heading to the action.
    markDone(id)
    if (fullBasePath) {
      navigate(`${fullBasePath}/${path}`)
    }
  }

  const handleDismiss = () => {
    patch({ dismissed: true })
  }

  const toggleCollapsed = () => {
    patch({ collapsed: !state.collapsed })
  }

  // Don't paint until hydrated OR if dismissed OR if all required steps done.
  if (!isLoaded || state.dismissed || allRequiredDone) {
    return null
  }

  return (
    <div
      role="complementary"
      aria-label={t('checklist.ariaLabel', { defaultValue: 'Configuración de inventario' })}
      className={cn(
        'fixed bottom-6 right-6 z-40 w-[380px] max-w-[calc(100vw-3rem)]',
        'rounded-xl border border-input bg-card shadow-lg',
        'animate-in slide-in-from-bottom-4 fade-in duration-300',
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={toggleCollapsed}
        className="flex w-full items-center gap-3 rounded-t-xl px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Rocket className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-semibold text-foreground">
            {t('checklist.title', { defaultValue: 'Configura tu inventario' })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('checklist.progress', {
              defaultValue: '{{done}} de {{total}} pasos',
              done: doneCount,
              total: totalSteps,
            })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(doneCount / totalSteps) * 100}%` }}
            />
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              state.collapsed ? '-rotate-180' : '',
            )}
          />
        </div>
      </button>

      {!state.collapsed && (
        <>
          <div className="max-h-[60vh] overflow-y-auto border-t border-input">
            {STEPS.map((step, index) => {
              const done = !!state.steps[step.id]?.done
              return (
                <div
                  key={step.id}
                  className={cn(
                    'flex items-start gap-3 px-4 py-3 border-b border-input last:border-b-0',
                    done && 'opacity-60',
                  )}
                >
                  <div
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                      done
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/40 text-transparent',
                    )}
                    aria-hidden="true"
                  >
                    <Check className="h-3 w-3" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          'text-sm font-medium text-foreground',
                          done && 'line-through',
                        )}
                      >
                        {index + 1}. {t(step.titleKey, { defaultValue: step.titleFallback })}
                      </p>
                      {step.optional && !done && (
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {t('checklist.optional', { defaultValue: 'Opcional' })}
                        </span>
                      )}
                    </div>
                    {!done && (
                      <>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {t(step.descriptionKey, { defaultValue: step.descriptionFallback })}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleGoTo(step.id, step.path)}
                            className="h-7 text-xs"
                          >
                            {t('checklist.goAction', { defaultValue: 'Hacerlo' })}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => markDone(step.id)}
                            className="h-7 text-xs text-muted-foreground hover:text-foreground"
                          >
                            {t('checklist.markDone', { defaultValue: 'Ya lo hice' })}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between border-t border-input px-4 py-2">
            <p className="text-xs text-muted-foreground">
              {allRequiredDone
                ? t('checklist.allDone', { defaultValue: '¡Configuración lista!' })
                : t('checklist.footerHint', {
                    defaultValue: 'Puedes hacer los pasos en cualquier orden.',
                  })}
            </p>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('checklist.dismiss', { defaultValue: 'Omitir' })}
              onClick={handleDismiss}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
