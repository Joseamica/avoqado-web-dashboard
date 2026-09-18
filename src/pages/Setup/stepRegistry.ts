/**
 * stepRegistry — el mapa FIJO entre una pantalla del asistente y el paso que el servidor espera.
 *
 * 🔴 Reemplaza al cálculo posicional `currentStep + 2` de `SetupWizard`. Ese cálculo suponía que
 * las pantallas y los pasos del backend iban en la misma fila, y dejaba de ser cierto en cuanto
 * un interruptor apagaba un paso intermedio: con proveedores y terminal apagados el PLAN se
 * guardaba en `step9`, que el servidor lee como compra de terminal; en el asistente corto caería
 * en `step5`, que el servidor rechaza por exigir `legalFirstName`. El asistente se tragaba el
 * error y la finalización moría con «Falta elegir tu plan».
 *
 * Los dos asistentes —largo y corto— leen de aquí. Spec: §4.1 de
 * `docs/superpowers/specs/2026-09-17-lanzamiento-campanas-ligeras-y-onboarding-corto-design.md`.
 */

export const BACKEND_STEP_BY_ID = {
  businessInfo: 2,
  businessBasics: 2,
  businessType: 3,
  entityType: 4,
  identity: 5,
  terms: 6,
  consent: 6,
  bankAccount: 7,
  paymentProviders: 8,
  buyTpv: 9,
  plan: 10,
  offer: 10,
} as const

export type SetupStepId = keyof typeof BACKEND_STEP_BY_ID

export function backendStepFor(id: SetupStepId): number {
  return BACKEND_STEP_BY_ID[id]
}

/** Pantallas del asistente corto, en orden. `done` no guarda nada: cierra el alta. */
export const SHORT_SETUP_STEP_IDS = ['consent', 'businessBasics', 'businessType', 'offer', 'done'] as const
export type ShortSetupStepId = (typeof SHORT_SETUP_STEP_IDS)[number]

export interface LongSetupFlags {
  paymentProviders: boolean
  buyTpv: boolean
  plan: boolean
}

/**
 * Pasos del asistente LARGO, según los interruptores de build. El plan va siempre al final:
 * `handleNext` sobre el último paso dispara la finalización, y el plan es la puerta de activación.
 */
export function buildLongSetupStepIds(flags: LongSetupFlags): SetupStepId[] {
  const ids: SetupStepId[] = ['businessInfo', 'businessType', 'entityType', 'identity', 'terms', 'bankAccount']
  if (flags.paymentProviders) ids.push('paymentProviders')
  if (flags.buyTpv) ids.push('buyTpv')
  if (flags.plan) ids.push('plan')
  return ids
}

/**
 * En qué pantalla reanuda el asistente LARGO. Cuenta los pasos cuyo paso de backend es MENOR que
 * el `currentStep` del progreso, con tope en la última pantalla. No usa aritmética de posiciones.
 */
export function resumeIndexFromCurrentStep(ids: readonly SetupStepId[], currentStep: number | null | undefined): number {
  if (ids.length === 0) return 0
  const target = typeof currentStep === 'number' && Number.isFinite(currentStep) ? currentStep : 0
  const alcanzados = ids.filter(id => BACKEND_STEP_BY_ID[id] < target).length
  return Math.max(0, Math.min(alcanzados, ids.length - 1))
}

/** La forma mínima del progreso que necesita la reanudación corta. */
export type EstadoDeActivacion = 'NONE' | 'IN_PROGRESS' | 'ACTIVE' | 'DECLINED'

export interface ShortResumeProgress {
  legal?: { consentRequired?: boolean } | null
  v2SetupData?: Record<string, unknown> | null
  /**
   * ⚠️ El contrato congelado nombra este dato de DOS formas: §4.1 lo usa como
   * `progress.planActivationStatus` y §4.5 lo publica como `progress.planActivation.status`. Se
   * leen las dos: si el servidor emite una y aquí se esperara la otra, la reanudación mandaría a
   * la pantalla de pago a alguien que YA pagó — y la oferta se le ofrecería otra vez.
   */
  planActivationStatus?: EstadoDeActivacion | null
  planActivation?: { status?: EstadoDeActivacion | null } | null
}

function estadoDeActivacion(progress: ShortResumeProgress | null | undefined): EstadoDeActivacion | null {
  return progress?.planActivationStatus ?? progress?.planActivation?.status ?? null
}

function leerPlanGuardado(v2SetupData: Record<string, unknown> | null | undefined): { tier?: string } | null {
  if (!v2SetupData || typeof v2SetupData !== 'object') return null
  // `activate-plan` y el paso 10 escriben `plan` en la RAÍZ; el asistente largo lo dejaba dentro
  // del cubo del paso. Se buscan los dos, como hace `parseV2Plan` en el servidor.
  const raiz = (v2SetupData as { plan?: { tier?: string } }).plan
  if (raiz && typeof raiz === 'object') return raiz
  for (const valor of Object.values(v2SetupData)) {
    if (valor && typeof valor === 'object' && 'plan' in (valor as Record<string, unknown>)) {
      const anidado = (valor as { plan?: { tier?: string } }).plan
      if (anidado && typeof anidado === 'object') return anidado
    }
  }
  return null
}

/**
 * En qué pantalla reanuda el asistente CORTO. No usa `currentStep`: `acceptV2Terms` lo fija en 7 y
 * `saveV2StepData` en `stepNumber + 1`, así que ese número no describe el alta corta. Se decide con
 * predicados sobre los datos.
 *
 * ⚠️ `'FREE'` es el nombre del tier gratuito EN EL DASHBOARD. El enum de Prisma no lo tiene
 * (`GRATIS | PRO | PREMIUM | ENTERPRISE`); la traducción vive en `setup.service.ts` y no se repite.
 */
export function resolveShortResumeStep(progress: ShortResumeProgress | null | undefined): ShortSetupStepId {
  if (progress?.legal?.consentRequired) return 'consent'

  const v2 = progress?.v2SetupData ?? null
  const step2 = (v2 as { step2?: { businessName?: string } } | null)?.step2
  if (!step2?.businessName) return 'businessBasics'

  const step3 = (v2 as { step3?: { businessType?: string } } | null)?.step3
  if (!step3?.businessType) return 'businessType'

  if (estadoDeActivacion(progress) === 'ACTIVE') return 'done'
  if (leerPlanGuardado(v2)?.tier === 'FREE') return 'done'

  return 'offer'
}
