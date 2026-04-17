import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Rocket, X } from 'lucide-react'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useOnboardingKey } from '@/hooks/useOnboardingState'
import {
  requestAtomicTour,
  useAtomicTourCompletionListener,
  type AtomicTourName,
} from '@/hooks/useAtomicTourListener'
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
  // Start collapsed so the full 380px card doesn't obstruct page content on
  // first load. User clicks the tiny pill to expand.
  collapsed: true,
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
  /** Atomic tour to auto-start after navigation. */
  atomicTour: AtomicTourName
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
    atomicTour: 'category',
  },
  {
    id: 'ingredient',
    titleKey: 'checklist.steps.ingredient.title',
    titleFallback: 'Crea tu primer ingrediente',
    descriptionKey: 'checklist.steps.ingredient.description',
    descriptionFallback: 'Solo si vas a usar productos con receta (shakes, bebidas). Puedes saltarte este paso si todo es por unidad.',
    path: 'inventory/ingredients',
    atomicTour: 'ingredient',
    optional: true,
  },
  {
    id: 'product',
    titleKey: 'checklist.steps.product.title',
    titleFallback: 'Crea tu primer producto',
    descriptionKey: 'checklist.steps.product.description',
    descriptionFallback: 'Elige entre por unidad (hoodies) o por receta (shakes). Necesita una categoría ya creada.',
    path: 'menumaker/products',
    atomicTour: 'product',
  },
  {
    id: 'purchaseOrder',
    titleKey: 'checklist.steps.purchaseOrder.title',
    titleFallback: 'Haz tu primera orden de compra',
    descriptionKey: 'checklist.steps.purchaseOrder.description',
    descriptionFallback: 'Le pides mercancía al proveedor. Al recibirla se crean los lotes con costo — esto permite calcular márgenes.',
    path: 'inventory/purchase-orders',
    atomicTour: 'purchase-order',
  },
  {
    id: 'adjustStock',
    titleKey: 'checklist.steps.adjustStock.title',
    titleFallback: 'Haz tu primer ajuste de stock',
    descriptionKey: 'checklist.steps.adjustStock.description',
    descriptionFallback: 'Aprende la operación más común del día: ajustar existencias por merma, daño o conteo.',
    path: 'inventory/stock-overview',
    atomicTour: 'stock-adjustment',
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

/**
 * Variants:
 *  - `'floating'` (default): original fixed-position behaviour. Collapsed = small
 *    pill, expanded = 380px card. Only mount this in a single route-scoped
 *    layout (it positions itself).
 *  - `'header'`: renders as a compact icon button (intended to live inside the
 *    global topbar next to NotificationBell / LanguageSwitcher) that opens
 *    the full checklist in a Popover. This variant is route-agnostic so it
 *    can be mounted once in dashboard.tsx and show anywhere in the app.
 */
type ChecklistVariant = 'floating' | 'header'

export function InventorySetupChecklist({ variant = 'floating' }: { variant?: ChecklistVariant } = {}) {
  const { t } = useTranslation('inventory')
  const { fullBasePath, venue, isWhiteLabelMode } = useCurrentVenue()
  // Hide the setup widget if the venue hasn't cleared KYC — 3 of the 5
  // steps navigate to `/inventory/*` which is blocked by `KYCProtectedRoute`,
  // so showing the checklist would just frustrate the admin with dead-end
  // clicks. Once KYC is verified, the widget re-appears with their progress.
  //
  // White-label venues also skip — they have their own branded flow and
  // shouldn't see Avoqado's setup guide.
  const isHidden =
    isWhiteLabelMode ||
    (!!venue && venue.kycStatus !== 'VERIFIED' && venue.role !== 'SUPERADMIN')
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

  const handleGoTo = (step: StepConfig) => {
    // Queue the atomic tour so it fires as soon as the destination mounts.
    // We deliberately do NOT mark the step done here — the step is marked
    // only when the atomic tour reaches its final step (the user actually
    // went through the walkthrough). See `useAtomicTourCompletionListener`
    // below for the sync.
    requestAtomicTour(step.atomicTour)
    if (fullBasePath) {
      navigate(`${fullBasePath}/${step.path}`)
    }
  }

  const toggleDone = (id: StepId) => {
    const current = state.steps[id]?.done
    patch({
      steps: {
        ...state.steps,
        [id]: current
          ? { done: false }
          : { done: true, doneAt: new Date().toISOString() },
      },
    })
  }

  // When any atomic tour reaches its final step, mark the matching checklist
  // step as done. Tours without a matching checklist step (e.g. `history`)
  // are silently ignored.
  useAtomicTourCompletionListener(atomicName => {
    const stepId = STEPS.find(s => s.atomicTour === atomicName)?.id
    if (!stepId) return
    if (state.steps[stepId]?.done) return // already done
    patch({
      steps: {
        ...state.steps,
        [stepId]: { done: true, doneAt: new Date().toISOString() },
      },
    })
  })

  const handleDismiss = () => {
    patch({ dismissed: true })
  }

  const toggleCollapsed = () => {
    patch({ collapsed: !state.collapsed })
  }

  // Don't paint until hydrated OR if dismissed OR if all required steps done.
  if (!isLoaded || state.dismissed || allRequiredDone || isHidden) {
    return null
  }

  // Shared step-list body used by both variants.
  const stepListBody = (
    <>
      <div className="max-h-[60vh] overflow-y-auto">
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
              <button
                type="button"
                onClick={() => toggleDone(step.id)}
                aria-label={
                  done
                    ? t('checklist.revert', { defaultValue: 'Desmarcar como hecho' })
                    : t('checklist.markDone', { defaultValue: 'Marcar como hecho' })
                }
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border cursor-pointer transition-colors',
                  done
                    ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/80'
                    : 'border-muted-foreground/40 text-transparent hover:border-primary hover:bg-primary/10',
                )}
              >
                <Check className="h-3 w-3" />
              </button>
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
                      <Button size="sm" onClick={() => handleGoTo(step)} className="h-7 text-xs">
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
            : t('checklist.footerHint', { defaultValue: 'Puedes hacer los pasos en cualquier orden.' })}
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
  )

  // Header variant: compact icon button that opens the full checklist in a
  // Popover. Designed to sit in the dashboard topbar next to NotificationBell.
  //
  // `defaultOpen` is driven off the persisted `collapsed` state: we leverage
  // the checklist's existing "collapsed" flag as a proxy for "user hasn't
  // opened it yet in the header world". On first load `collapsed: true` →
  // popover shows automatically so the user actually sees the setup hint.
  // Once they close it, `toggleCollapsed()` flips the flag → next visit the
  // popover stays closed until they click the icon.
  if (variant === 'header') {
    return (
      <Popover
        defaultOpen={state.collapsed}
        onOpenChange={open => {
          // When the user closes the popover, persist that they've seen it
          // so we don't auto-open on every navigation.
          if (!open && state.collapsed) {
            patch({ collapsed: false })
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t('checklist.ariaLabel', { defaultValue: 'Configuración de inventario' })}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
          >
            <Rocket className="h-4 w-4 text-primary" />
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {doneCount}/{totalSteps}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[380px] max-w-[calc(100vw-2rem)] p-0 overflow-hidden">
          <div className="flex items-center gap-3 border-b border-input px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Rocket className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {t('checklist.title', { defaultValue: 'Configura tu inventario' })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('checklist.progress', { defaultValue: '{{done}} de {{total}} pasos', done: doneCount, total: totalSteps })}
              </p>
            </div>
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted shrink-0">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(doneCount / totalSteps) * 100}%` }}
              />
            </div>
          </div>
          {stepListBody}
        </PopoverContent>
      </Popover>
    )
  }

  // Collapsed mode: render a tiny 48x48 pill in the bottom-left corner so it
  // doesn't overlap the DataTable pagination (which lives on the right). User
  // can click to expand the full checklist card.
  if (state.collapsed) {
    return (
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={t('checklist.ariaLabel', { defaultValue: 'Configuración de inventario' })}
        className={cn(
          'fixed top-20 right-6 z-40 flex h-12 w-12 items-center justify-center',
          'rounded-full border border-input bg-card shadow-lg',
          'hover:bg-muted/50 transition-colors cursor-pointer',
          'animate-in fade-in duration-300',
        )}
      >
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Rocket className="h-4 w-4" />
          {/* Progress ring — rendered as a small badge pill in the corner */}
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {doneCount}/{totalSteps}
          </span>
        </span>
      </button>
    )
  }

  return (
    <div
      role="complementary"
      aria-label={t('checklist.ariaLabel', { defaultValue: 'Configuración de inventario' })}
      className={cn(
        'fixed top-20 right-6 z-40 w-[380px] max-w-[calc(100vw-3rem)]',
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
        <div className="border-t border-input">
          {stepListBody}
        </div>
      )}
    </div>
  )
}
