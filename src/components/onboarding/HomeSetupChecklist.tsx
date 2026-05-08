import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Check, Compass } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useOnboardingKey } from '@/hooks/useOnboardingState'
import { usePlatformWelcomeTour } from '@/hooks/usePlatformWelcomeTour'
import {
  requestAtomicTour,
  setAtomicTourReturnPath,
  type AtomicTourName,
} from '@/hooks/useAtomicTourListener'
import { cn } from '@/lib/utils'

type StepId = 'catalog' | 'inventory' | 'team' | 'tpv' | 'reservations'

interface StepState {
  done: boolean
  doneAt?: string
  /** El usuario ya clickeó "Empezar" pero el tour aún no se completa. */
  inProgress?: boolean
  /** Último step de driver.js donde el user quedó. Permite reanudar el
   *  tour cross-device / cross-tab. Lo escribe `useTourProgressSync` con
   *  debounce a partir de los `onHighlightStarted` de cada tour. */
  lastStepIndex?: number
}

interface ChecklistState {
  dismissed: boolean
  steps: Partial<Record<StepId, StepState>>
}

const STORAGE_KEY = 'home-checklist'

const DEFAULT_STATE: ChecklistState = {
  dismissed: false,
  steps: {},
}

interface StepConfig {
  id: StepId
  titleKey: string
  descriptionKey: string
  /** Path appended to fullBasePath when user clicks "Empezar" */
  path: string
  /** Optional atomic tour to auto-start on the destination page */
  atomicTour?: AtomicTourName
  /** Allow user to skip this step manually */
  canSkip?: boolean
}

const STEPS: StepConfig[] = [
  {
    id: 'catalog',
    titleKey: 'newHome.setup.steps.catalog.title',
    descriptionKey: 'newHome.setup.steps.catalog.description',
    path: 'menumaker/products',
    atomicTour: 'product',
  },
  {
    id: 'inventory',
    titleKey: 'newHome.setup.steps.inventory.title',
    descriptionKey: 'newHome.setup.steps.inventory.description',
    // Navega a /ingredients (RawMaterials) — ahí está montado el listener
    // de useAtomicTourListener('ingredient'). Si apuntáramos solo a
    // /inventory caería en stock-overview que NO tiene el listener y el
    // tour nunca se accionaría.
    path: 'inventory/ingredients',
    atomicTour: 'ingredient',
    canSkip: true,
  },
  {
    id: 'team',
    titleKey: 'newHome.setup.steps.team.title',
    descriptionKey: 'newHome.setup.steps.team.description',
    path: 'team',
    atomicTour: 'team-invitation',
    canSkip: true,
  },
  {
    id: 'tpv',
    titleKey: 'newHome.setup.steps.tpv.title',
    descriptionKey: 'newHome.setup.steps.tpv.description',
    path: 'tpv',
    atomicTour: 'tpv-onboarding',
    canSkip: true,
  },
  {
    id: 'reservations',
    titleKey: 'newHome.setup.steps.reservations.title',
    descriptionKey: 'newHome.setup.steps.reservations.description',
    path: 'reservations',
    atomicTour: 'reservations-onboarding',
    canSkip: true,
  },
]

function normalize(raw: unknown): ChecklistState {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_STATE }
  const r = raw as Partial<ChecklistState>
  return {
    dismissed: !!r.dismissed,
    steps: r.steps ?? {},
  }
}

export function HomeSetupChecklist() {
  const { t } = useTranslation('home')
  const { fullBasePath } = useCurrentVenue()
  const navigate = useNavigate()
  const { start: startPlatformTour } = usePlatformWelcomeTour()

  const { value: rawState, isLoaded, setValue } = useOnboardingKey<ChecklistState>(STORAGE_KEY, DEFAULT_STATE)
  const state = useMemo(() => normalize(rawState), [rawState])

  // Tour de plataforma — su completion vive en backend bajo otra key, así
  // sobrevive a clear del checklist y se respeta la primera vez del usuario.
  const { value: platformTourCompleted } = useOnboardingKey<boolean>('platform-welcome-completed', false)

  const doneCount = useMemo(() => STEPS.filter(s => state.steps[s.id]?.done).length, [state.steps])
  const allDone = doneCount === STEPS.length

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

  const handleStart = (step: StepConfig) => {
    // Marcamos el step como inProgress para que el badge "En curso"
    // persista cross-navegación. El auto-mark al completar lo limpia.
    if (!state.steps[step.id]?.done) {
      patch({
        steps: {
          ...state.steps,
          [step.id]: {
            ...(state.steps[step.id] ?? { done: false }),
            inProgress: true,
          },
        },
      })
    }
    // Antes de salir de Home, recordamos a dónde regresar cuando el atomic
    // tour complete. El orquestador (montado en dashboard.tsx) consume este
    // valor y navega de vuelta automáticamente.
    if (fullBasePath) setAtomicTourReturnPath(fullBasePath)
    if (step.atomicTour) requestAtomicTour(step.atomicTour)
    if (fullBasePath) navigate(`${fullBasePath}/${step.path}`)
  }

  // El auto-marking de steps al completar un atomic tour ahora vive en
  // dashboard.tsx (`useHomeChecklistAutoMark`) — listener siempre montado
  // cross-page para no perderse el evento mientras el user está fuera de
  // Home recorriendo el tour.

  if (!isLoaded || state.dismissed || allDone) return null

  // Square-style "set up your business" card. The card uses high-contrast
  // tokens that flip per theme:
  //  - Light mode: dark card with white text (Square's signature look)
  //  - Dark mode: themed card surface with subtle border so it doesn't blast
  //    a stark-white panel into the user's eyes.
  return (
    <div
      className={cn(
        'rounded-2xl p-8',
        // Light mode: inverted (dark card / light text)
        'bg-foreground text-background',
        // Dark mode: themed card surface with subtle elevation
        'dark:bg-card dark:text-card-foreground dark:border dark:border-input',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">{t('newHome.setup.title')}</h2>
        <button
          type="button"
          onClick={() => patch({ dismissed: true })}
          className={cn(
            'cursor-pointer text-sm underline-offset-4 hover:underline',
            'text-background/60 hover:text-background',
            'dark:text-muted-foreground dark:hover:text-foreground',
          )}
        >
          {t('newHome.setup.dismiss')}
        </button>
      </div>

      {/* Hero row: platform tour. Visualmente distinto al resto — usa un
          fondo con tinte primary para destacarse y posición prominente. */}
      <button
        type="button"
        onClick={() => startPlatformTour()}
        className={cn(
          'mt-6 flex w-full items-center gap-4 rounded-xl p-4 text-left transition-colors cursor-pointer',
          'bg-background/10 hover:bg-background/15',
          'dark:bg-primary/10 dark:hover:bg-primary/15 dark:border dark:border-primary/20',
        )}
      >
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
            'bg-background/20 text-background',
            'dark:bg-primary/20 dark:text-primary',
          )}
        >
          <Compass className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold">{t('newHome.setup.platformTour.title')}</p>
            {platformTourCompleted && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-medium',
                  'bg-background/15 text-background',
                  'dark:bg-emerald-500/15 dark:text-emerald-400',
                )}
              >
                {t('newHome.setup.platformTour.completedBadge')}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-background/70 dark:text-muted-foreground">
            {t('newHome.setup.platformTour.description')}
          </p>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 opacity-60" />
      </button>

      <div className="mt-6 divide-y divide-background/10 dark:divide-border">
        {STEPS.map(step => {
          const done = !!state.steps[step.id]?.done
          // "En curso" persiste en el backend a partir del primer click en
          // "Empezar" — cualquier step pendiente con inProgress muestra el
          // badge, aunque el user salga del tour. Al re-clickear, el tour
          // reanuda desde el step donde quedó (también en backend, via
          // `lastStepIndex` + `useTourProgressSync`).
          const isActive = !done && !!state.steps[step.id]?.inProgress

          // Filas siempre clickeables — incluso completadas, para que el
          // usuario pueda repetir el tour cuando quiera. El estado done se
          // comunica con el check + tachado del título; la descripción y el
          // CTA siguen presentes para reabrir el flujo.
          return (
            <div
              key={step.id}
              role="button"
              tabIndex={0}
              onClick={() => handleStart(step)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  handleStart(step)
                }
              }}
              className="group/row flex items-start gap-4 py-5 first:pt-0 last:pb-0 cursor-pointer"
            >
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'text-base font-semibold transition-colors group-hover/row:underline group-hover/row:underline-offset-4',
                    done && 'line-through text-background/40 dark:text-muted-foreground',
                  )}
                >
                  {t(step.titleKey)}
                </p>
                <p
                  className={cn(
                    'mt-1 text-sm',
                    done
                      ? 'text-background/40 dark:text-muted-foreground/70'
                      : 'text-background/70 dark:text-muted-foreground',
                  )}
                >
                  {t(step.descriptionKey)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                {done && (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-background/15 text-background dark:bg-muted dark:text-foreground">
                    <Check className="h-4 w-4" />
                  </span>
                )}
                {!done && isActive && (
                  <span className="rounded-full bg-blue-500/15 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-300">
                    {t('newHome.setup.inProgress')}
                  </span>
                )}
                {!done && step.canSkip && (
                  <button
                    type="button"
                    onClick={event => {
                      // Detén la propagación: el click en "Omitir" no
                      // debe disparar el tour del row que lo contiene.
                      event.stopPropagation()
                      markDone(step.id)
                    }}
                    className={cn(
                      'cursor-pointer text-sm underline underline-offset-4',
                      'text-background/70 hover:text-background',
                      'dark:text-muted-foreground dark:hover:text-foreground',
                    )}
                  >
                    {t('newHome.setup.skip')}
                  </button>
                )}
                <Button
                  type="button"
                  onClick={event => {
                    event.stopPropagation()
                    handleStart(step)
                  }}
                  className={cn(
                    'h-9 cursor-pointer rounded-full px-5 text-sm font-semibold',
                    done
                      ? 'bg-background/15 text-background hover:bg-background/25 dark:bg-muted dark:text-foreground dark:hover:bg-muted/80'
                      : 'bg-background text-foreground hover:bg-background/90 dark:bg-foreground dark:text-background dark:hover:bg-foreground/90',
                  )}
                >
                  {done ? t('newHome.setup.repeat') : t('newHome.setup.start')}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
