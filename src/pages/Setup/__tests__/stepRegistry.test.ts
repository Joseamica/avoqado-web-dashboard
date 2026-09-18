/**
 * El mapa fijo de pasos del servidor (§4.1 del spec de campañas ligeras).
 *
 * 🔴 Por qué existe: hoy el asistente calcula el paso del backend con `currentStep + 2`
 * (posición en pantalla + 2). Con proveedores y terminal apagados, el PLAN se guardaba en
 * `step9` —que el servidor lee como compra de terminal— y en el asistente corto caería en
 * `step5`, que el servidor rechaza por exigir `legalFirstName`. El error se tragaba y la
 * finalización moría con «Falta elegir tu plan».
 *
 * La prueba fija lo único que importa: el plan SIEMPRE se guarda en el paso 10, con
 * cualquier combinación de interruptores.
 */
import { describe, expect, it } from 'vitest'

import {
  BACKEND_STEP_BY_ID,
  backendStepFor,
  buildLongSetupStepIds,
  resolveShortResumeStep,
  resumeIndexFromCurrentStep,
  SHORT_SETUP_STEP_IDS,
} from '../stepRegistry'

describe('BACKEND_STEP_BY_ID', () => {
  it('el plan y la oferta guardan en el paso 10, los términos en el 6', () => {
    expect(BACKEND_STEP_BY_ID.plan).toBe(10)
    expect(BACKEND_STEP_BY_ID.offer).toBe(10)
    expect(BACKEND_STEP_BY_ID.terms).toBe(6)
    expect(BACKEND_STEP_BY_ID.consent).toBe(6)
  })

  it('businessBasics comparte el paso 2 con businessInfo (mismo destino en el servidor)', () => {
    expect(BACKEND_STEP_BY_ID.businessBasics).toBe(2)
    expect(BACKEND_STEP_BY_ID.businessInfo).toBe(2)
  })
})

describe('buildLongSetupStepIds + backendStepFor', () => {
  const combinaciones = [
    { paymentProviders: true, buyTpv: true, plan: true },
    { paymentProviders: false, buyTpv: true, plan: true },
    { paymentProviders: true, buyTpv: false, plan: true },
    { paymentProviders: false, buyTpv: false, plan: true },
  ] as const

  it.each(combinaciones)('el plan guarda en el paso 10 con %o', flags => {
    const ids = buildLongSetupStepIds(flags)
    expect(ids).toContain('plan')
    expect(backendStepFor('plan')).toBe(10)
    // Y la trampa que originó el archivo: la POSICIÓN ya no decide el paso del servidor.
    const posicion = ids.indexOf('plan') + 2
    if (!flags.paymentProviders || !flags.buyTpv) {
      expect(posicion).not.toBe(10)
    }
  })

  it('sin el interruptor del plan, el asistente largo no lo incluye', () => {
    expect(buildLongSetupStepIds({ paymentProviders: true, buyTpv: true, plan: false })).not.toContain('plan')
  })

  it('el plan siempre va al final: es la puerta de activación', () => {
    const ids = buildLongSetupStepIds({ paymentProviders: false, buyTpv: false, plan: true })
    expect(ids[ids.length - 1]).toBe('plan')
  })
})

describe('resumeIndexFromCurrentStep', () => {
  const ids = buildLongSetupStepIds({ paymentProviders: true, buyTpv: true, plan: true })

  it('sin progreso (currentStep 1 o ausente) abre en el primer paso', () => {
    expect(resumeIndexFromCurrentStep(ids, 1)).toBe(0)
    expect(resumeIndexFromCurrentStep(ids, undefined)).toBe(0)
    expect(resumeIndexFromCurrentStep(ids, 0)).toBe(0)
  })

  it('cuenta los pasos cuyo paso de backend es MENOR que el actual', () => {
    // currentStep 6 ⇒ ya guardó businessInfo(2), businessType(3), entityType(4), identity(5)
    expect(resumeIndexFromCurrentStep(ids, 6)).toBe(4)
    expect(ids[resumeIndexFromCurrentStep(ids, 6)]).toBe('terms')
  })

  it('un currentStep mayor que todo el mapa se topa en el último paso', () => {
    expect(resumeIndexFromCurrentStep(ids, 99)).toBe(ids.length - 1)
  })

  it('con proveedores y terminal apagados, currentStep 8 no se sale del arreglo', () => {
    const cortos = buildLongSetupStepIds({ paymentProviders: false, buyTpv: false, plan: true })
    const idx = resumeIndexFromCurrentStep(cortos, 8)
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(idx).toBeLessThanOrEqual(cortos.length - 1)
  })
})

describe('resolveShortResumeStep', () => {
  const base = {
    legal: { currentVersion: '2026-09-17', acceptedVersion: '2026-09-17', consentRequired: false },
    v2SetupData: { step2: { businessName: 'Café Testarudo' }, step3: { businessType: 'CAFE' } },
    planActivationStatus: 'NONE' as const,
  }

  it('consentRequired manda por encima de todo', () => {
    expect(resolveShortResumeStep({ ...base, legal: { ...base.legal, consentRequired: true } })).toBe('consent')
  })

  it('sin nombre del negocio, abre en businessBasics', () => {
    expect(resolveShortResumeStep({ ...base, v2SetupData: { step3: { businessType: 'CAFE' } } })).toBe('businessBasics')
  })

  it('sin giro, abre en businessType', () => {
    expect(resolveShortResumeStep({ ...base, v2SetupData: { step2: { businessName: 'X' } } })).toBe('businessType')
  })

  it('con lo básico capturado y sin plan, abre en la oferta', () => {
    expect(resolveShortResumeStep(base)).toBe('offer')
  })

  it('con el plan ya cobrado (ACTIVE) abre en done', () => {
    expect(resolveShortResumeStep({ ...base, planActivationStatus: 'ACTIVE' })).toBe('done')
  })

  it('con el plan GRATIS guardado abre en done — FREE es el nombre del DASHBOARD, no del servidor', () => {
    expect(
      resolveShortResumeStep({
        ...base,
        v2SetupData: { ...base.v2SetupData, plan: { tier: 'FREE' } },
      }),
    ).toBe('done')
  })

  it('⚠️ el contrato nombra el estado de dos formas: también se lee `planActivation.status`', () => {
    expect(resolveShortResumeStep({ ...base, planActivationStatus: undefined, planActivation: { status: 'ACTIVE' } })).toBe('done')
    expect(resolveShortResumeStep({ ...base, planActivationStatus: undefined, planActivation: { status: 'DECLINED' } })).toBe('offer')
  })

  it('IN_PROGRESS no es ACTIVE: se vuelve a la oferta para que el cobro se resuelva ahí', () => {
    expect(resolveShortResumeStep({ ...base, planActivationStatus: 'IN_PROGRESS' })).toBe('offer')
  })

  it('un progreso vacío abre en businessBasics y nunca revienta', () => {
    expect(resolveShortResumeStep(undefined)).toBe('businessBasics')
    expect(resolveShortResumeStep({} as never)).toBe('businessBasics')
  })

  it('el plan del progreso también se lee de la raíz de v2SetupData (donde lo escribe activate-plan)', () => {
    expect(resolveShortResumeStep({ ...base, v2SetupData: { ...base.v2SetupData, step10: { plan: { tier: 'FREE' } } } })).toBe('done')
  })
})

describe('SHORT_SETUP_STEP_IDS', () => {
  it('son las cuatro pantallas del asistente corto, en orden', () => {
    expect(SHORT_SETUP_STEP_IDS).toEqual(['consent', 'businessBasics', 'businessType', 'offer', 'done'])
  })
})
