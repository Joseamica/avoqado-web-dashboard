// src/components/billing/__tests__/PlanPicker.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { PlanPicker } from '../PlanPicker'
import {
  OFERTA_V2_CON_CENTAVOS,
  OFERTA_V2_PREMIUM_11X,
  OFERTA_CARGANDO,
  OFERTA_SIN_DATO,
  OFERTA_V1,
  OFERTA_V2_PLUS,
  OFERTA_V3_PREMIUM_FUERA,
  ofertaActual,
} from '@/hooks/__tests__/planOfferFixtures'

vi.mock('@/hooks/usePlanOffer', async () => {
  const f = await import('@/hooks/__tests__/planOfferFixtures')
  return f.moduloDelHookConOferta(() => f.ofertaActual.valor)
})

// i18n returns the key (or interpolated) so assertions are deterministic
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: any) => (o?.tier ? `${k}:${o.tier}` : o?.price ? `${k}:${o.price}` : o?.amount ? `${k}:${o.amount}` : k),
  }),
}))

beforeEach(() => {
  ofertaActual.valor = OFERTA_V1
})

describe('PlanPicker', () => {
  it('renders the 4 tier cards and marks the current one', () => {
    render(<PlanPicker currentTier="FREE" onSelectTier={() => {}} />)
    expect(screen.getByText('plan.tiers.free.name')).toBeInTheDocument()
    expect(screen.getByText('plan.tiers.pro.name')).toBeInTheDocument()
    expect(screen.getByText('plan.tiers.premium.name')).toBeInTheDocument()
    expect(screen.getByText('plan.tiers.enterprise.name')).toBeInTheDocument()
    expect(screen.getByText('plan.cta.current')).toBeInTheDocument()
  })

  it('fires onSelectTier when an upgrade CTA is clicked', () => {
    const onSelect = vi.fn()
    render(<PlanPicker currentTier="FREE" onSelectTier={onSelect} />)
    fireEvent.click(screen.getByText('plan.cta.upgrade:plan.tiers.pro.name'))
    expect(onSelect).toHaveBeenCalledWith('PRO', 'monthly')
  })

  it('Premium is purchasable — fires onSelectTier, no coming-soon badge', () => {
    const onSelect = vi.fn()
    render(<PlanPicker currentTier="FREE" onSelectTier={onSelect} />)
    expect(screen.queryByText('plan.comingSoon')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('plan.cta.upgrade:plan.tiers.premium.name'))
    expect(onSelect).toHaveBeenCalledWith('PREMIUM', 'monthly')
  })

  it('toggles monthly/annual pricing', () => {
    render(<PlanPicker currentTier="FREE" onSelectTier={() => {}} />)
    fireEvent.click(screen.getByText('plan.billing.annual'))
    // Pro annual equiv ($9,990) should appear
    expect(screen.getByText(/9,990/)).toBeInTheDocument()
  })

  // Wizard integrations (SetupWizard PlanStep): controlled interval + per-tier promo note
  it('supports controlled interval — notifies parent and respects the prop', () => {
    const onIntervalChange = vi.fn()
    const { rerender } = render(
      <PlanPicker currentTier="FREE" onSelectTier={() => {}} interval="monthly" onIntervalChange={onIntervalChange} />,
    )
    fireEvent.click(screen.getByText('plan.billing.annual'))
    expect(onIntervalChange).toHaveBeenCalledWith('annual')
    // parent controls the value: still monthly until the prop changes
    rerender(<PlanPicker currentTier="FREE" onSelectTier={() => {}} interval="annual" onIntervalChange={onIntervalChange} />)
    expect(screen.getByText(/9,990/)).toBeInTheDocument()
  })

  it('renders a promo note on the matching tier card', () => {
    render(<PlanPicker currentTier="FREE" onSelectTier={() => {}} promoNotes={{ PRO: '3 meses a $599' }} />)
    expect(screen.getByText('3 meses a $599')).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // selectionMode="choice" — wizards (SetupWizard PlanStep, ConversionWizard).
  // `currentTier` there means "the tier the user just PICKED", not "the plan they
  // already own", so the picked card must stay live. Regression: it used to render
  // the owned-plan CTA (disabled "Tu plan actual"), leaving the pre-selected PRO
  // card with a dead button and no way forward.
  // ---------------------------------------------------------------------------
  const card = (tier: string) => document.querySelector(`[data-tour="plan-card-${tier}"]`) as HTMLElement

  it('choice mode: the picked tier is marked on the card, never as the disabled owned-plan CTA', () => {
    render(<PlanPicker currentTier="PRO" onSelectTier={() => {}} selectionMode="choice" />)
    expect(card('pro')).toHaveAttribute('aria-checked', 'true')
    expect(card('free')).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByText('plan.cta.current')).not.toBeInTheDocument()
  })

  it('choice mode: no per-card «Elegir/Seleccionado» buttons (the card is the control) and no upgrade wording', () => {
    render(<PlanPicker currentTier="PRO" onSelectTier={() => {}} selectionMode="choice" />)
    expect(screen.queryByText('plan.cta.selected')).not.toBeInTheDocument()
    expect(screen.queryByText(/plan\.cta\.choose/)).not.toBeInTheDocument()
    expect(screen.queryByText(/plan\.cta\.(upgrade|downgrade)/)).not.toBeInTheDocument()
  })

  it('choice mode: Enterprise keeps its «Contactar ventas» action', () => {
    const onSelect = vi.fn()
    render(<PlanPicker currentTier="PRO" onSelectTier={onSelect} selectionMode="choice" />)
    fireEvent.click(screen.getAllByText('plan.cta.contact').find(el => el.closest('button'))!)
    expect(onSelect).toHaveBeenCalledWith('ENTERPRISE', 'monthly')
  })

  it('owned mode (Billing) keeps its per-card buttons', () => {
    render(<PlanPicker currentTier="FREE" onSelectTier={() => {}} />)
    expect(screen.getByText('plan.cta.current')).toBeInTheDocument()
  })

  it('choice mode: clicking anywhere on a card selects it (no button required)', () => {
    const onSelect = vi.fn()
    render(<PlanPicker currentTier="PRO" onSelectTier={onSelect} selectionMode="choice" />)
    fireEvent.click(card('premium'))
    expect(onSelect).toHaveBeenCalledWith('PREMIUM', 'monthly')
  })

  it('choice mode: the card is keyboard-selectable (radio semantics)', () => {
    const onSelect = vi.fn()
    render(<PlanPicker currentTier="PRO" onSelectTier={onSelect} selectionMode="choice" />)
    const premium = card('premium')
    expect(premium).toHaveAttribute('role', 'radio')
    expect(card('pro')).toHaveAttribute('aria-checked', 'true')
    expect(premium).toHaveAttribute('aria-checked', 'false')
    fireEvent.keyDown(premium, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith('PREMIUM', 'monthly')
  })

  it('owned mode (default): the card body is NOT clickable — only the CTA is', () => {
    const onSelect = vi.fn()
    render(<PlanPicker currentTier="FREE" onSelectTier={onSelect} />)
    fireEvent.click(card('premium'))
    expect(onSelect).not.toHaveBeenCalled()
  })

  // Regla del 5-nov: planes siempre «$ + IVA» (precio sin IVA, «+ IVA» en chico); nunca «IVA incluido» en la tarjeta.
  it('nunca dice «IVA incluido»: todas las tarjetas de pago muestran el monto sin IVA y «+ IVA»', () => {
    render(<PlanPicker currentTier="PRO" onSelectTier={() => {}} />)
    expect(screen.queryByText(/ivaIncluded/)).not.toBeInTheDocument()
    expect(screen.getAllByText('plan.perMonth · plan.plusIva')).toHaveLength(2) // Pro y Premium
  })

  it('leadingCard: va entre Gratis y Pro, la cuadrícula tiene 5 columnas, Pro conserva «Más popular» y leadingSelected apaga su elección', () => {
    render(
      <PlanPicker
        currentTier="PRO"
        onSelectTier={() => {}}
        selectionMode="choice"
        leadingCard={<div data-testid="basico" />}
        leadingSelected
      />,
    )
    const grid = screen.getByRole('radiogroup')
    const orden = Array.from(grid.children).map(
      el => (el as HTMLElement).dataset.tour?.replace('plan-card-', '') ?? (el as HTMLElement).dataset.testid,
    )
    expect(orden).toEqual(['free', 'basico', 'pro', 'premium', 'enterprise'])
    expect(grid.className).toContain('@4xl:grid-cols-5')
    expect(screen.getByText('plan.popular')).toBeInTheDocument()
    expect(card('pro')).toHaveAttribute('aria-checked', 'false')
  })

  it('🔴 con precios sin IVA del servidor la tarjeta pinta ESE neto (no el catálogo), mensual y anual', () => {
    const net = { PRO: { monthlyCents: 0, monthlyNetCents: 123400, annualNetCents: 1200000 } }
    const { rerender } = render(<PlanPicker currentTier="FREE" onSelectTier={() => {}} preciosSinIva={net} />)
    expect(screen.getByText('$1,234')).toBeInTheDocument()
    expect(screen.queryByText('$999')).not.toBeInTheDocument()
    rerender(<PlanPicker currentTier="FREE" onSelectTier={() => {}} preciosSinIva={net} interval="annual" />)
    expect(screen.getByText('$1,000')).toBeInTheDocument() // 12,000 ÷ 12
    expect(screen.getByText('plan.annualEquiv:$12,000')).toBeInTheDocument()
  })

  it('intervalLocked apaga Mensual/Anual', () => {
    render(<PlanPicker currentTier="FREE" onSelectTier={() => {}} intervalLocked />)
    expect(screen.getByText('plan.billing.annual').closest('button')).toBeDisabled()
  })

  it('sin leadingCard la cuadrícula sigue en 4 columnas (regresión)', () => {
    render(<PlanPicker currentTier="PRO" onSelectTier={() => {}} selectionMode="choice" />)
    expect(screen.getByRole('radiogroup').className).toContain('@4xl:grid-cols-4')
  })

  it('sin precios del servidor (Facturación) sigue igual: «$999» y «+ IVA» (regresión)', () => {
    render(<PlanPicker currentTier="FREE" onSelectTier={() => {}} />)
    expect(screen.getByText('$999')).toBeInTheDocument()
    expect(screen.getAllByText('plan.perMonth · plan.plusIva').length).toBeGreaterThan(0)
  })
})

describe('PlanPicker — «Ver todos» de cada plan (founder, 25-sep)', () => {
  const tarjeta = (id: string) => document.querySelector(`[data-tour="plan-card-${id}"]`) as HTMLElement

  it('cada tarjeta enseña sólo los 4 principales y tiene su botón «Ver todos»', () => {
    render(<PlanPicker currentTier="PRO" onSelectTier={() => {}} selectionMode="choice" />)
    for (const id of ['free', 'pro', 'premium', 'enterprise']) {
      expect(tarjeta(id).querySelectorAll('ul > li').length).toBeLessThanOrEqual(4)
      expect(tarjeta(id).querySelector(`[data-tour="plan-see-all-${id}"]`)).not.toBeNull()
    }
    // El 5º beneficio de Pro ya no está en la tarjeta: vive en la ventana.
    expect(screen.queryByText('plan.features.proCashBank')).not.toBeInTheDocument()
  })

  it('🔴 abrir «Ver todos» NO elige el plan, ni al abrir ni al tocar dentro de la ventana', () => {
    const onSelect = vi.fn()
    render(<PlanPicker currentTier="PRO" onSelectTier={onSelect} selectionMode="choice" />)
    fireEvent.click(tarjeta('premium').querySelector('[data-tour="plan-see-all-premium"]')!)
    const ventana = screen.getByTestId('plan-benefits-PREMIUM')
    fireEvent.click(ventana)
    fireEvent.click(screen.getByText('plan.compare.rows.cfdi'))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('la ventana lista TODO lo del plan (lo de abajo incluido) y nada de lo que no incluye', () => {
    render(<PlanPicker currentTier="PRO" onSelectTier={() => {}} selectionMode="choice" />)
    fireEvent.click(tarjeta('pro').querySelector('[data-tour="plan-see-all-pro"]')!)
    const ventana = screen.getByTestId('plan-benefits-PRO')
    expect(ventana.textContent).toMatch(/plan\.compare\.rows\.pos/) // de Free
    expect(ventana.textContent).toMatch(/plan\.compare\.rows\.loyalty/) // de Pro
    expect(ventana.textContent).not.toMatch(/plan\.compare\.rows\.cfdi/) // de Premium
  })

  it('desde la ventana se puede elegir el plan (asistente), una sola vez, y se cierra', () => {
    const onSelect = vi.fn()
    render(<PlanPicker currentTier="PRO" onSelectTier={onSelect} selectionMode="choice" />)
    fireEvent.click(tarjeta('premium').querySelector('[data-tour="plan-see-all-premium"]')!)
    fireEvent.click(screen.getByText('plan.cta.choose:plan.tiers.premium.name'))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('PREMIUM', 'monthly')
    expect(screen.queryByTestId('plan-benefits-PREMIUM')).not.toBeInTheDocument()
  })

  it('en Facturación la ventana sólo informa: no cambia de plan', () => {
    render(<PlanPicker currentTier="FREE" onSelectTier={() => {}} />)
    fireEvent.click(tarjeta('pro').querySelector('[data-tour="plan-see-all-pro"]')!)
    const ventana = screen.getByTestId('plan-benefits-PRO')
    expect(ventana.querySelector('[data-tour="plan-benefits-action-pro"]')).toBeNull()
  })

  it('Enterprise enseña sus extras propios además de todo lo de Premium', () => {
    render(<PlanPicker currentTier="PRO" onSelectTier={() => {}} selectionMode="choice" />)
    fireEvent.click(tarjeta('enterprise').querySelector('[data-tour="plan-see-all-enterprise"]')!)
    const ventana = screen.getByTestId('plan-benefits-ENTERPRISE')
    expect(ventana.textContent).toMatch(/plan\.features\.whiteLabel/)
    expect(ventana.textContent).toMatch(/plan\.compare\.rows\.cfdi/)
    expect(ventana.textContent).not.toMatch(/plan\.features\.allPremium/)
  })

  // B4: nombres, montos y texto del anual salen de la oferta vigente del SERVIDOR.
  it('v2 «Plus» en anual: dice «ahorras $1,262.08 al año, IVA incluido», no «2 meses gratis»', () => {
    ofertaActual.valor = OFERTA_V2_PLUS
    render(<PlanPicker currentTier="FREE" onSelectTier={() => {}} interval="annual" />)
    const pro = within(document.querySelector('[data-tour="plan-card-pro"]') as HTMLElement)
    // El monto es el BRUTO (con IVA): 79,900 × 1.16 × 12 − 850,000 × 1.16 = $1,262.08; con el neto saldría $1,088.00.
    expect(pro.getByText(/plan\.annualSaves:\$1,262\.08/)).toBeInTheDocument()
    expect(screen.getByText('plan.billing.annual').closest('button')).not.toHaveTextContent('plan.billing.save')
    expect(pro.queryByText(/plan\.billing\.save/)).not.toBeInTheDocument()
    expect(screen.getByText('plan.annualEquiv:$8,500')).toBeInTheDocument()
  })

  it('v2 «Plus»: el nombre sale de la oferta y el precio mensual es $799', () => {
    ofertaActual.valor = OFERTA_V2_PLUS
    render(<PlanPicker currentTier="FREE" onSelectTier={() => {}} />)
    expect(screen.getByText('Plus')).toBeInTheDocument()
    expect(screen.getByText('$799')).toBeInTheDocument()
    expect(screen.queryByText('$999')).not.toBeInTheDocument()
  })

  it('con la v1 (10 mensualidades) la píldora del anual sigue diciendo «2 meses gratis»', () => {
    render(<PlanPicker currentTier="FREE" onSelectTier={() => {}} />)
    expect(screen.getByText('plan.billing.save')).toBeInTheDocument()
  })

  it.each([
    ['cargando', OFERTA_CARGANDO],
    ['sinDato', OFERTA_SIN_DATO],
  ])('con %s ningún monto de Pro ni de Premium (ni $999, ni $1,699, ni $0)', (_n, oferta) => {
    ofertaActual.valor = oferta
    render(<PlanPicker currentTier="FREE" onSelectTier={() => {}} />)
    expect(document.body.textContent).not.toMatch(/999|1,699|9,990/)
    expect(screen.queryByText('plan.billing.save')).not.toBeInTheDocument()
    expect(screen.getByText('plan.tiers.pro.name')).toBeInTheDocument()
  })

  it('v3: Premium fuera de venta se pinta «No disponible» y no ofrece contratarlo', () => {
    ofertaActual.valor = OFERTA_V3_PREMIUM_FUERA
    render(<PlanPicker currentTier="FREE" onSelectTier={() => {}} />)
    expect(screen.getAllByText('plan.notOnSale').length).toBeGreaterThan(0)
    expect(screen.queryByText('plan.cta.upgrade:Premium')).not.toBeInTheDocument()
  })

  it('con la cotización del llamador, el nombre y el texto del anual salen de ELLA', () => {
    render(
      <PlanPicker
        currentTier="FREE"
        onSelectTier={() => {}}
        interval="annual"
        preciosSinIva={{ PRO: { monthlyNetCents: 79900, annualNetCents: 850000, displayName: 'Plus' } }}
      />,
    )
    expect(screen.getByText('Plus')).toBeInTheDocument()
    expect(screen.getByText(/plan\.annualSaves/)).toBeInTheDocument()
  })

  it('I1: si un plan de pago no cumple «2 meses gratis», la píldora del toggle no sale y su tarjeta dice cuánto ahorra', () => {
    ofertaActual.valor = OFERTA_V2_PREMIUM_11X
    render(<PlanPicker currentTier="FREE" onSelectTier={() => {}} interval="annual" />)
    expect(screen.getByText('plan.billing.annual').closest('button')).not.toHaveTextContent('plan.billing.save')
    const premium = within(document.querySelector('[data-tour="plan-card-premium"]') as HTMLElement)
    expect(premium.getByText(/plan\.annualSaves:\$1,970\.84/)).toBeInTheDocument()
    const pro = within(document.querySelector('[data-tour="plan-card-pro"]') as HTMLElement)
    expect(pro.getByText(/plan\.billing\.save/)).toBeInTheDocument()
  })

  it('la píldora del toggle sale cuando TODOS los planes a la venta dan «2 meses gratis» (v1)', () => {
    render(<PlanPicker currentTier="FREE" onSelectTier={() => {}} />)
    expect(screen.getByText('plan.billing.annual').closest('button')).toHaveTextContent('plan.billing.save')
  })

  it('D6: el equivalente mensual del anual lleva centavos con la v2 (hook y cotización) y pesos enteros con la v1', () => {
    ofertaActual.valor = OFERTA_V2_PLUS
    const a = render(<PlanPicker currentTier="FREE" onSelectTier={() => {}} interval="annual" />)
    expect(screen.getByText('$708.33')).toBeInTheDocument()
    a.unmount()
    ofertaActual.valor = OFERTA_CARGANDO
    const b = render(
      <PlanPicker
        currentTier="FREE"
        onSelectTier={() => {}}
        interval="annual"
        preciosSinIva={{ PRO: { monthlyNetCents: 79900, annualNetCents: 850000 } }}
      />,
    )
    expect(screen.getByText('$708.33')).toBeInTheDocument()
    b.unmount()
    ofertaActual.valor = OFERTA_V1
    render(<PlanPicker currentTier="FREE" onSelectTier={() => {}} interval="annual" />)
    expect(screen.getByText('$833')).toBeInTheDocument()
  })

  it('D7: «Ver todos» usa el nombre que ya resolvió la tarjeta (la cotización) aunque la oferta siga cargando', () => {
    ofertaActual.valor = OFERTA_CARGANDO
    render(
      <PlanPicker
        currentTier="FREE"
        onSelectTier={() => {}}
        preciosSinIva={{ PRO: { monthlyNetCents: 79900, annualNetCents: 850000, displayName: 'Plus' } }}
      />,
    )
    fireEvent.click(document.querySelector('[data-tour="plan-see-all-pro"]')!)
    expect(within(screen.getByTestId('plan-benefits-PRO')).getByText('plan.benefits.title:Plus')).toBeInTheDocument()
  })

  it('M6: un precio con centavos enseña dos decimales; uno redondo se queda como hoy', () => {
    ofertaActual.valor = OFERTA_V2_CON_CENTAVOS
    const { unmount } = render(<PlanPicker currentTier="FREE" onSelectTier={() => {}} />)
    expect(screen.getByText('$799.50')).toBeInTheDocument()
    unmount()
    ofertaActual.valor = OFERTA_V1
    render(<PlanPicker currentTier="FREE" onSelectTier={() => {}} />)
    expect(screen.getByText('$999')).toBeInTheDocument()
  })
})
