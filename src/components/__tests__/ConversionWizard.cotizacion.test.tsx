// src/components/__tests__/ConversionWizard.cotizacion.test.tsx
// Planes editables (B2, Task 12, b2-r1 #9): la conversión de una demo enseña y firma los precios de la versión del editor
// (`GET /plan` → `cotizacion`), apaga un plan fuera de venta y nunca convierte a Gratis lo que no se pudo pedir. Sin cotización,
// el asistente de hoy, literal.
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from '@/api'
import { createPlanCheckoutSession, getVenuePlan } from '@/services/features.service'
import { ConversionWizard } from '../ConversionWizard'

vi.mock('react-i18next', async () => {
  const [{ default: common }, { default: onboarding }, { default: billing }] = await Promise.all([
    import('@/locales/es/common.json'),
    import('@/locales/es/onboarding.json'),
    import('@/locales/es/billing.json'),
  ])
  const porEspacio: Record<string, unknown> = { common, onboarding, billing }
  const traductor = (ns?: string) => {
    const raiz = porEspacio[ns ?? 'common']
    return (key: string, params: Record<string, unknown> = {}) => {
      const plural = params.count != null ? `${key}_${params.count === 1 ? 'one' : 'other'}` : null
      const buscar = (llave: string) => llave.split('.').reduce((node: any, part) => node?.[part], raiz)
      const valor = (plural && buscar(plural)) ?? buscar(key) ?? params.defaultValue ?? key
      return String(valor).replace(/\{\{(\w+)\}\}/g, (_, name) => String(params[name]))
    }
  }
  return { useTranslation: (ns?: string) => ({ t: traductor(ns), i18n: { language: 'es' } }) }
})
const { toastSpy } = vi.hoisted(() => ({ toastSpy: vi.fn() }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastSpy }) }))
vi.mock('@/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('@/firebase', () => ({ storage: {} }))
vi.mock('firebase/storage', () => ({ ref: vi.fn(), uploadBytesResumable: vi.fn(), getDownloadURL: vi.fn() }))
vi.mock('@/services/features.service', () => ({ getVenuePlan: vi.fn(), createPlanCheckoutSession: vi.fn() }))

const opcion = (precioCents: number, netCents: number) => ({
  quoteToken: `tok_${precioCents}`,
  precioCents,
  netCents,
  firstChargeCents: precioCents,
  trialEndsAt: null,
})
const V2 = {
  versionNumber: 2,
  planes: {
    PRO: { displayName: 'Pro', vendible: true, monthly: opcion(92684, 79900), annual: opcion(926840, 799000) },
    PREMIUM: { displayName: 'Premium', vendible: true, monthly: opcion(197084, 169900), annual: opcion(1970840, 1699000) },
  },
}
const PRO_FUERA = { ...V2, planes: { ...V2.planes, PRO: { displayName: 'Pro', vendible: false, monthly: null, annual: null } } }
const planDeLaDemo = (cotizacion?: object) => ({
  hasPlan: false,
  state: 'none',
  planTier: null,
  grandfathered: false,
  ...(cotizacion ? { cotizacion } : {}),
})
const NEGOCIO = {
  id: 'venue',
  entityType: 'PERSONA_FISICA',
  idDocumentUrl: 'https://docs.example.com/ine.pdf',
  rfcDocumentUrl: 'https://docs.example.com/csf.pdf',
  comprobanteDomicilioUrl: 'https://docs.example.com/domicilio.pdf',
  caratulaBancariaUrl: 'https://docs.example.com/caratula.pdf',
}
const assign = vi.fn()
const reload = vi.fn()

let cliente: QueryClient
const abrir = () => {
  cliente = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={cliente}>
      <ConversionWizard open onOpenChange={vi.fn()} venueId="venue" venueSlug="demo" venueName="Demo" />
    </QueryClientProvider>,
  )
}
const siguiente = () => document.querySelector('[data-tour="conversion-next-btn"]') as HTMLButtonElement
const confirmar = () => document.querySelector('[data-tour="conversion-submit-btn"]') as HTMLButtonElement
const tarjeta = (tier: 'free' | 'pro' | 'premium') => document.querySelector(`[data-tour="plan-card-${tier}"]`) as HTMLElement
/** Del paso de documentos al de planes (la demo ya trae sus documentos). */
const alPasoDePlanes = async () => {
  await waitFor(() => expect(screen.getByText(/Paso 2/)).toBeInTheDocument())
  await userEvent.click(siguiente())
  await userEvent.click(siguiente())
  await waitFor(() => expect(tarjeta('pro')).not.toBeNull())
}
const convertir = () => vi.mocked(api.post).mock.calls.filter(([url]) => String(url).endsWith('/convert-from-demo'))

beforeEach(() => {
  toastSpy.mockReset()
  assign.mockReset()
  reload.mockReset()
  vi.stubGlobal('location', { ...window.location, href: 'https://dashboard.example.com/venues/demo/home', assign, reload })
  vi.mocked(api.get).mockReset()
  vi.mocked(api.get).mockResolvedValue({ data: { data: NEGOCIO } } as never)
  vi.mocked(api.post).mockReset()
  vi.mocked(api.post).mockResolvedValue({
    data: { success: true, data: { id: 'venue', planAcceptance: { id: 'cacc1', expiresAt: '2026-11-26T05:00:00.000Z' } } },
  } as never)
  vi.mocked(createPlanCheckoutSession).mockReset()
  vi.mocked(createPlanCheckoutSession).mockResolvedValue('https://checkout.stripe.example/c/1')
  vi.mocked(getVenuePlan).mockReset()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ConversionWizard con la cotización de la versión', () => {
  it('🔴 b2-r1 #9: con la v2 (Pro mensual 79900), la tarjeta de Pro y el resumen dicen $799.00 + IVA, no el $999 del catálogo, y el POST lleva plan con el quoteToken de esa opción', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(planDeLaDemo(V2) as never)
    abrir()
    await alPasoDePlanes()
    await waitFor(() => expect(within(tarjeta('pro')).getByText('$799')).toBeInTheDocument())
    expect(within(tarjeta('pro')).queryByText('$999')).toBeNull()
    await userEvent.click(tarjeta('pro'))
    await userEvent.click(siguiente())
    expect(await screen.findByText('Plan mensual · $799.00 MXN/mes + IVA')).toBeInTheDocument()
    expect(screen.queryByText(/\$999/)).toBeNull()
    await userEvent.click(confirmar())
    await waitFor(() => expect(createPlanCheckoutSession).toHaveBeenCalled())
    expect(convertir()).toHaveLength(1)
    expect(convertir()[0][1]).toMatchObject({ plan: { tier: 'PRO', interval: 'monthly', quoteToken: 'tok_92684' } })
    // El checkout es el de la aceptación que la conversión guardó.
    expect(createPlanCheckoutSession).toHaveBeenCalledWith('venue', 'PRO', 'monthly', { acceptanceId: 'cacc1' })
    expect(window.location.href).toBe('https://checkout.stripe.example/c/1')
  })

  it('🔴 b2-r1 #9: con Pro fuera de venta, su tarjeta está apagada; si el plan elegido deja de venir en la cotización, confirmar NO llama a convert-from-demo ni convierte a Gratis', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(planDeLaDemo(PRO_FUERA) as never)
    const vista = abrir()
    await alPasoDePlanes()
    await waitFor(() => expect(within(tarjeta('pro')).getByText('No disponible por ahora')).toBeInTheDocument())
    expect(tarjeta('pro')).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(tarjeta('pro'))
    expect(tarjeta('pro')).toHaveAttribute('aria-checked', 'false')
    expect(tarjeta('free')).toHaveAttribute('aria-checked', 'true')
    vista.unmount()

    // Pro estaba a la venta al elegirlo; al confirmar, la cotización ya no lo trae.
    vi.mocked(getVenuePlan).mockResolvedValue(planDeLaDemo(V2) as never)
    abrir()
    await alPasoDePlanes()
    await waitFor(() => expect(within(tarjeta('pro')).getByText('$799')).toBeInTheDocument())
    await userEvent.click(tarjeta('pro'))
    await userEvent.click(siguiente())
    await screen.findByText('Plan mensual · $799.00 MXN/mes + IVA')
    cliente.setQueryData(['venuePlan', 'venue'], planDeLaDemo(PRO_FUERA))
    await userEvent.click(confirmar())
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })))
    expect(convertir()).toHaveLength(0)
    expect(api.post).not.toHaveBeenCalled()
    expect(createPlanCheckoutSession).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('Gratis con cotización manda plan { tier: "FREE" }; sin cotización, el POST de hoy sin plan', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(planDeLaDemo(V2) as never)
    const vista = abrir()
    await alPasoDePlanes()
    await waitFor(() => expect(within(tarjeta('pro')).getByText('$799')).toBeInTheDocument())
    await userEvent.click(siguiente())
    await userEvent.click(confirmar())
    await waitFor(() => expect(convertir()).toHaveLength(1))
    expect(convertir()[0][1]).toMatchObject({ plan: { tier: 'FREE' } })
    expect(createPlanCheckoutSession).not.toHaveBeenCalled()
    vista.unmount()

    vi.mocked(api.post).mockClear()
    vi.mocked(getVenuePlan).mockResolvedValue(planDeLaDemo() as never)
    abrir()
    await alPasoDePlanes()
    await waitFor(() => expect(getVenuePlan).toHaveBeenCalled())
    await userEvent.click(siguiente())
    await userEvent.click(confirmar())
    await waitFor(() => expect(convertir()).toHaveLength(1))
    expect(convertir()[0][1]).toEqual({
      entityType: 'PERSONA_FISICA',
      idDocumentUrl: NEGOCIO.idDocumentUrl,
      rfcDocumentUrl: NEGOCIO.rfcDocumentUrl,
      comprobanteDomicilioUrl: NEGOCIO.comprobanteDomicilioUrl,
      caratulaBancariaUrl: NEGOCIO.caratulaBancariaUrl,
    })
  })

  it('REGRESIÓN: sin cotización, Pro dice el precio del catálogo y el checkout es la llamada de hoy', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(planDeLaDemo() as never)
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: { id: 'venue' } } } as never)
    abrir()
    await alPasoDePlanes()
    await waitFor(() => expect(getVenuePlan).toHaveBeenCalled())
    expect(within(tarjeta('pro')).getByText('$999')).toBeInTheDocument()
    await userEvent.click(tarjeta('pro'))
    await userEvent.click(siguiente())
    expect(await screen.findByText('Plan mensual · $999 MXN/mes + IVA')).toBeInTheDocument()
    await userEvent.click(confirmar())
    await waitFor(() => expect(createPlanCheckoutSession).toHaveBeenCalled())
    expect(createPlanCheckoutSession).toHaveBeenCalledWith('venue', 'PRO', 'monthly')
    expect(convertir()[0][1]).not.toHaveProperty('plan')
  })

  it('409 OFFER_CHANGED al convertir: el mensaje del SERVIDOR, se vuelve a leer el plan y no se abre el checkout', async () => {
    const mensaje = 'La oferta cambió. Revisa el precio antes de pagar. No se te cobró nada.'
    vi.mocked(getVenuePlan).mockResolvedValue(planDeLaDemo(V2) as never)
    vi.mocked(api.post).mockRejectedValue({ response: { status: 409, data: { code: 'OFFER_CHANGED', message: mensaje } } })
    abrir()
    await alPasoDePlanes()
    await waitFor(() => expect(within(tarjeta('pro')).getByText('$799')).toBeInTheDocument())
    await userEvent.click(tarjeta('pro'))
    await userEvent.click(siguiente())
    const lecturas = vi.mocked(getVenuePlan).mock.calls.length
    await userEvent.click(confirmar())
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ description: mensaje })))
    await waitFor(() => expect(vi.mocked(getVenuePlan).mock.calls.length).toBeGreaterThan(lecturas))
    expect(createPlanCheckoutSession).not.toHaveBeenCalled()
  })
})

describe('ConversionWizard · fix round 1 (revisión #6 y #7)', () => {
  it('fix 4 (revisión #6): si el plan elegido sale de venta, el resumen dice «No disponible por ahora» y ningún precio (ni el del catálogo)', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(planDeLaDemo(V2) as never)
    abrir()
    await alPasoDePlanes()
    await waitFor(() => expect(within(tarjeta('pro')).getByText('$799')).toBeInTheDocument())
    await userEvent.click(tarjeta('pro'))
    await userEvent.click(siguiente())
    await screen.findByText('Plan mensual · $799.00 MXN/mes + IVA')
    act(() => cliente.setQueryData(['venuePlan', 'venue'], planDeLaDemo(PRO_FUERA)))
    expect(await screen.findByText('No disponible por ahora')).toBeInTheDocument()
    expect(screen.queryByText(/MXN\/mes \+ IVA/)).toBeNull()
    expect(screen.queryByText(/\$999/)).toBeNull()
    expect(screen.queryByText(/\$799/)).toBeNull()
  })

  it('REGRESIÓN fix 4: sin cotización, el resumen de un plan de pago sigue con el precio del catálogo', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(planDeLaDemo() as never)
    abrir()
    await alPasoDePlanes()
    await waitFor(() => expect(getVenuePlan).toHaveBeenCalled())
    await userEvent.click(tarjeta('premium'))
    await userEvent.click(siguiente())
    expect(await screen.findByText(/^Plan mensual · \$/)).toBeInTheDocument()
    expect(screen.queryByText('No disponible por ahora')).toBeNull()
  })

  it('fix 5 (revisión #7): 409 VENUE_ALREADY_CONVERTED, 400 PLAN_INVALID y 409 PLAN_NOT_ON_SALE al convertir → el mensaje del SERVIDOR y ningún checkout', async () => {
    const rechazos = [
      {
        status: 409,
        code: 'VENUE_ALREADY_CONVERTED',
        message: 'Este negocio ya se convirtió en otra pestaña. Recarga la página.',
        relee: false,
      },
      { status: 400, code: 'PLAN_INVALID', message: 'El plan elegido no es válido. Recarga la página.', relee: false },
      {
        status: 409,
        code: 'PLAN_NOT_ON_SALE',
        message: 'El plan Pro ya no está a la venta. Elige otro plan. No se te cobró nada.',
        relee: true,
      },
    ]
    for (const { status, code, message, relee } of rechazos) {
      toastSpy.mockReset()
      vi.mocked(getVenuePlan).mockReset()
      vi.mocked(getVenuePlan).mockResolvedValue(planDeLaDemo(V2) as never)
      vi.mocked(api.post).mockReset()
      vi.mocked(api.post).mockRejectedValue({ response: { status, data: { code, message } } })
      const vista = abrir()
      await alPasoDePlanes()
      await waitFor(() => expect(within(tarjeta('pro')).getByText('$799')).toBeInTheDocument())
      await userEvent.click(tarjeta('pro'))
      await userEvent.click(siguiente())
      const lecturas = vi.mocked(getVenuePlan).mock.calls.length
      await userEvent.click(confirmar())
      await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ description: message, variant: 'destructive' })))
      expect(convertir()).toHaveLength(1)
      expect(createPlanCheckoutSession).not.toHaveBeenCalled()
      if (relee) await waitFor(() => expect(vi.mocked(getVenuePlan).mock.calls.length).toBeGreaterThan(lecturas))
      vista.unmount()
    }
  })
})
