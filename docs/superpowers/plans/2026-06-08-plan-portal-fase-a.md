# Plan Portal — Fase A (Frontend-only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe `/settings/billing` from an à-la-carte feature catalog into a plan-first portal (Free/Pro/Premium/Enterprise) like Square/Linear, plus a reusable `<FeatureGate>` paywall-teaser — **without any backend change**.

**Architecture:** A frontend `plan-catalog.ts` is the single source of truth for the 4 tiers (name, icon, price, feature list, the tier→capability map for display). A `<PlanPicker>` renders the 4 cards + monthly/annual toggle. A `<FeatureGate>` blurs gated content and shows an upgrade card that names the correct tier (read from the catalog). The existing à-la-carte grid in `Subscriptions.tsx` is removed; the superadmin grant/activate controls are preserved but moved into a collapsible panel. Upgrade CTAs open an assisted-activation dialog (frontend-only); self-serve checkout + real tier gating land in Fase B.

**Tech Stack:** React 18 + TS + Vite, Tailwind v4 (semantic tokens), Radix UI, TanStack Query, react-i18next, lucide-react. Tests: Vitest 4 + @testing-library/react + jsdom (`npm test`). Reference test pattern: `src/pages/Organization/__tests__/OrgStaffAccessStep.test.tsx`.

**Spec:** `docs/superpowers/specs/2026-06-08-planes-y-facturacion-redesign-design.md`
**Mockup:** `docs/superpowers/specs/mockups/2026-06-08-plan-portal-mockup.html`

**Conventions (from `.claude/rules/`):**
- All user-facing text via `t()` with **es + en** (superadmin panel is exempt → hardcoded Spanish).
- No hardcoded colors — semantic tokens. No `bg-gradient-*` (superadmin amber-pink gradient is the only allowed exception).
- Card borders use `border-input` (not `border-border`).
- Unimplemented controls get a `Muy pronto` badge + disabled (Premium checkout until Fase B).
- Memoize arrays passed to lists. White-label nav via `fullBasePath`.

---

## File Structure

**Create:**
- `src/config/plan-catalog.ts` — tier definitions + `getTierForFeature()` (the display-side tier→capability map).
- `src/config/__tests__/plan-catalog.test.ts`
- `src/components/billing/PlanPicker.tsx` — 4 cards + Mensual/Anual toggle.
- `src/components/billing/__tests__/PlanPicker.test.tsx`
- `src/components/billing/FeatureGate.tsx` — paywall-teaser wrapper.
- `src/components/billing/__tests__/FeatureGate.test.tsx`
- `src/components/billing/PlanUpgradeDialog.tsx` — assisted-activation dialog (Fase A interim).
- `src/pages/Settings/Billing/components/SuperadminFeatureControl.tsx` — extracted collapsible superadmin panel.

**Modify:**
- `src/locales/es/billing.json` + `src/locales/en/billing.json` — add `tabs.plan`, change `pageTitle`, add `plan.*`, `featureGate.*`.
- `src/pages/Settings/Billing/BillingLayout.tsx` — relabel first tab to `Plan`, change page title.
- `src/pages/Settings/Billing/Subscriptions.tsx` — replace à-la-carte grid with `<PlanPicker>` + `<CurrentPlanCard>`; move superadmin block into `<SuperadminFeatureControl>`.

---

## Task 1: Plan catalog (source of truth)

**Files:**
- Create: `src/config/plan-catalog.ts`
- Test: `src/config/__tests__/plan-catalog.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/config/__tests__/plan-catalog.test.ts
import { describe, it, expect } from 'vitest'
import { PLAN_TIERS, getTierForFeature, TIER_ORDER } from '../plan-catalog'

describe('plan-catalog', () => {
  it('defines exactly the four tiers in ascending order', () => {
    expect(PLAN_TIERS.map(t => t.id)).toEqual(['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE'])
    expect(TIER_ORDER).toEqual(['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE'])
  })

  it('maps a feature to the lowest tier that includes it', () => {
    // CFDI is a Premium differentiator
    expect(getTierForFeature('CFDI')).toBe('PREMIUM')
    // Reports/AI are Pro
    expect(getTierForFeature('ADVANCED_REPORTS')).toBe('PRO')
    // Chatbot ships in Free (Beta)
    expect(getTierForFeature('CHATBOT')).toBe('FREE')
  })

  it('returns null for an unknown feature code', () => {
    expect(getTierForFeature('NOPE_XYZ')).toBeNull()
  })

  it('marks Premium checkout as not yet self-serve (Fase B)', () => {
    const premium = PLAN_TIERS.find(t => t.id === 'PREMIUM')!
    expect(premium.checkout).toBe('coming_soon')
    expect(premium.priceMonthly).toBe(1699)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/config/__tests__/plan-catalog.test.ts`
Expected: FAIL — cannot find module `../plan-catalog`.

- [ ] **Step 3: Write the catalog**

```ts
// src/config/plan-catalog.ts
import type { LucideIcon } from 'lucide-react'
import { Sparkles, Star, Crown, Building2 } from 'lucide-react'

export type TierId = 'FREE' | 'PRO' | 'PREMIUM' | 'ENTERPRISE'
export const TIER_ORDER: TierId[] = ['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE']

/** How the upgrade CTA behaves in Fase A. Fase B flips PREMIUM → 'self_serve'. */
export type CheckoutMode = 'current' | 'self_serve' | 'coming_soon' | 'contact'

export interface PlanTierDef {
  id: TierId
  /** i18n key suffix under billing `plan.tiers.<key>` (name, pitch). */
  key: string
  icon: LucideIcon
  /** CSS var name for the accent color (defined in component). */
  accent: 'free' | 'pro' | 'premium' | 'enterprise'
  popular?: boolean
  priceMonthly: number | null // MXN, ex-IVA. null = "a la medida"
  priceAnnual: number | null // MXN/yr, ex-IVA
  checkout: CheckoutMode
  /** i18n key suffixes under billing `plan.features.<code>` shown as the card's checklist. */
  featureKeys: string[]
  /** Feature CODES this tier unlocks (display-side tier→capability map; Fase B makes it authoritative). */
  includes: string[]
}

/**
 * Display-side tier → capability map. Mirrors the spec's section 5.
 * Source of truth for BOTH the plan cards and `getTierForFeature()` (FeatureGate CTA).
 * NOTE: backend access is still authoritative; this only drives presentation in Fase A.
 */
export const PLAN_TIERS: PlanTierDef[] = [
  {
    id: 'FREE',
    key: 'free',
    icon: Sparkles,
    accent: 'free',
    priceMonthly: 0,
    priceAnnual: 0,
    checkout: 'current',
    featureKeys: ['pos', 'menuOrders', 'inventoryBasic', 'dailyReports', 'chatbotBeta', 'seats2'],
    includes: ['AVAILABLE_BALANCE', 'CHATBOT'],
  },
  {
    id: 'PRO',
    key: 'pro',
    icon: Star,
    accent: 'pro',
    popular: true,
    priceMonthly: 999,
    priceAnnual: 9990,
    checkout: 'self_serve',
    featureKeys: ['allFree', 'reportsHistory', 'aiMcp', 'loyaltyReferrals', 'reservationsOrdering', 'seatsUnlimited'],
    includes: ['ADVANCED_REPORTS', 'AI_ASSISTANT_BUBBLE', 'LOYALTY_PROGRAM', 'RESERVATIONS', 'ONLINE_ORDERING'],
  },
  {
    id: 'PREMIUM',
    key: 'premium',
    icon: Crown,
    accent: 'premium',
    priceMonthly: 1699,
    priceAnnual: 16990,
    checkout: 'coming_soon', // Fase B → 'self_serve'
    featureKeys: ['allPro', 'cfdi', 'inventoryFifo', 'predictiveAnalytics', 'multiVenue', 'prioritySupport'],
    includes: ['CFDI', 'INVENTORY_TRACKING', 'ADVANCED_ANALYTICS', 'COMMISSIONS', 'ATTENDANCE_TRACKING', 'SERIALIZED_INVENTORY'],
  },
  {
    id: 'ENTERPRISE',
    key: 'enterprise',
    icon: Building2,
    accent: 'enterprise',
    priceMonthly: null,
    priceAnnual: null,
    checkout: 'contact',
    featureKeys: ['allPremium', 'whiteLabel', 'apiIntegrations', 'slaSupport'],
    includes: ['WHITE_LABEL_DASHBOARD'],
  },
]

const tierRank = (id: TierId) => TIER_ORDER.indexOf(id)

/** Lowest tier whose `includes` contains the feature code, or null. */
export function getTierForFeature(code: string): TierId | null {
  const owners = PLAN_TIERS.filter(t => t.includes.includes(code))
  if (owners.length === 0) return null
  return owners.sort((a, b) => tierRank(a.id) - tierRank(b.id))[0].id
}

export const getTierDef = (id: TierId) => PLAN_TIERS.find(t => t.id === id)!
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/config/__tests__/plan-catalog.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/config/plan-catalog.ts src/config/__tests__/plan-catalog.test.ts
git commit -m "feat(billing): add plan-catalog as source of truth for 4 tiers"
```

---

## Task 2: i18n keys (es + en)

**Files:**
- Modify: `src/locales/es/billing.json`
- Modify: `src/locales/en/billing.json`

- [ ] **Step 1: Add the keys to `src/locales/es/billing.json`**

Change `pageTitle` and add a `plan` + `featureGate` block. Merge into the existing top-level object (keep all current keys; add/replace these):

```json
{
  "pageTitle": "Plan y Facturación",
  "pageSubtitle": "Tu plan, tus facturas y tus métodos de pago — todo en un lugar.",
  "tabs": {
    "plan": "Plan",
    "subscriptions": "Plan",
    "history": "Facturas",
    "paymentMethods": "Métodos de pago",
    "tokens": "Tokens IA"
  },
  "plan": {
    "currentBadge": "Tu plan actual",
    "billing": { "monthly": "Mensual", "annual": "Anual", "save": "2 meses gratis al año" },
    "perMonth": "/mes",
    "perYear": "/año",
    "plusIva": "+ IVA",
    "forever": "Para siempre",
    "billedMonthly": "Se cobra mensual",
    "annualEquiv": "{{price}}/año · 2 meses gratis",
    "comingSoon": "Muy pronto",
    "popular": "Más popular",
    "compareCta": "Compara todos los planes",
    "cta": {
      "current": "Tu plan actual",
      "upgrade": "Mejorar a {{tier}}",
      "contact": "Contactar ventas"
    },
    "tiers": {
      "free": { "name": "Free", "pitch": "Todo para operar tu negocio, gratis." },
      "pro": { "name": "Pro", "pitch": "Crece y entiende tu negocio: histórico, IA y más ventas." },
      "premium": { "name": "Premium", "pitch": "Profesionaliza: facturación, inventario serio y multisucursal." },
      "enterprise": { "name": "Enterprise", "pitch": "Para cadenas: marca propia, integraciones y precio por volumen." }
    },
    "features": {
      "pos": "Cobra con tarjeta (TPV)",
      "menuOrders": "Menú, órdenes y mesas",
      "inventoryBasic": "Inventario básico",
      "dailyReports": "Reportes del día",
      "chatbotBeta": "Chatbot",
      "seats2": "Hasta 2 usuarios",
      "allFree": "Todo lo de Free",
      "reportsHistory": "Reportes e histórico completo",
      "aiMcp": "Asistente IA + MCP",
      "loyaltyReferrals": "Lealtad y referidos",
      "reservationsOrdering": "Reservas · Pedidos en línea",
      "seatsUnlimited": "Usuarios ilimitados",
      "allPro": "Todo lo de Pro",
      "cfdi": "Facturación CFDI",
      "inventoryFifo": "Inventario FIFO + recetas + costeo",
      "predictiveAnalytics": "Analítica predictiva",
      "multiVenue": "Multisucursal consolidada",
      "prioritySupport": "Soporte prioritario",
      "allPremium": "Todo lo de Premium",
      "whiteLabel": "Marca propia (white-label)",
      "apiIntegrations": "API e integraciones",
      "slaSupport": "SLA y soporte dedicado"
    }
  },
  "featureGate": {
    "tierTag": "Incluido en {{tier}}",
    "body": "Esta función es parte del plan {{tier}}. Mejora para empezar a usarla en tu local.",
    "upgrade": "Mejora a {{tier}}",
    "seeAll": "Ver todos los planes"
  }
}
```

- [ ] **Step 2: Add the same keys (English) to `src/locales/en/billing.json`**

```json
{
  "pageTitle": "Plan & Billing",
  "pageSubtitle": "Your plan, invoices, and payment methods — all in one place.",
  "tabs": { "plan": "Plan", "subscriptions": "Plan", "history": "Invoices", "paymentMethods": "Payment methods", "tokens": "AI Tokens" },
  "plan": {
    "currentBadge": "Your current plan",
    "billing": { "monthly": "Monthly", "annual": "Yearly", "save": "2 months free yearly" },
    "perMonth": "/mo", "perYear": "/yr", "plusIva": "+ VAT", "forever": "Forever",
    "billedMonthly": "Billed monthly", "annualEquiv": "{{price}}/yr · 2 months free",
    "comingSoon": "Coming soon", "popular": "Most popular", "compareCta": "Compare all plans",
    "cta": { "current": "Your current plan", "upgrade": "Upgrade to {{tier}}", "contact": "Contact sales" },
    "tiers": {
      "free": { "name": "Free", "pitch": "Everything to run your business, free." },
      "pro": { "name": "Pro", "pitch": "Grow and understand your business: history, AI, more sales." },
      "premium": { "name": "Premium", "pitch": "Go pro: invoicing, serious inventory, multi-location." },
      "enterprise": { "name": "Enterprise", "pitch": "For chains: own brand, integrations, volume pricing." }
    },
    "features": {
      "pos": "Card payments (POS)", "menuOrders": "Menu, orders & tables", "inventoryBasic": "Basic inventory",
      "dailyReports": "Today's reports", "chatbotBeta": "Chatbot", "seats2": "Up to 2 users",
      "allFree": "Everything in Free", "reportsHistory": "Full reports & history", "aiMcp": "AI Assistant + MCP",
      "loyaltyReferrals": "Loyalty & referrals", "reservationsOrdering": "Reservations · Online ordering", "seatsUnlimited": "Unlimited users",
      "allPro": "Everything in Pro", "cfdi": "CFDI invoicing", "inventoryFifo": "FIFO inventory + recipes + costing",
      "predictiveAnalytics": "Predictive analytics", "multiVenue": "Consolidated multi-location", "prioritySupport": "Priority support",
      "allPremium": "Everything in Premium", "whiteLabel": "White-label", "apiIntegrations": "API & integrations", "slaSupport": "SLA & dedicated support"
    }
  },
  "featureGate": { "tierTag": "Included in {{tier}}", "body": "This feature is part of the {{tier}} plan. Upgrade to start using it.", "upgrade": "Upgrade to {{tier}}", "seeAll": "See all plans" }
}
```

- [ ] **Step 3: Verify JSON parses and lint passes**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. (The ESLint `no-missing-translation-keys` rule must be green.)

- [ ] **Step 4: Commit**

```bash
git add src/locales/es/billing.json src/locales/en/billing.json
git commit -m "i18n(billing): plan-first portal copy (es+en)"
```

---

## Task 3: `<PlanPicker>` component

**Files:**
- Create: `src/components/billing/PlanPicker.tsx`
- Test: `src/components/billing/__tests__/PlanPicker.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/billing/__tests__/PlanPicker.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlanPicker } from '../PlanPicker'

// i18n returns the key (or interpolated) so assertions are deterministic
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: any) => (o?.tier ? `${k}:${o.tier}` : o?.price ? `${k}:${o.price}` : k) }),
}))

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
    expect(onSelect).toHaveBeenCalledWith('PRO')
  })

  it('shows a "coming soon" badge on Premium and disables its CTA', () => {
    const onSelect = vi.fn()
    render(<PlanPicker currentTier="FREE" onSelectTier={onSelect} />)
    expect(screen.getByText('plan.comingSoon')).toBeInTheDocument()
  })

  it('toggles monthly/annual pricing', () => {
    render(<PlanPicker currentTier="FREE" onSelectTier={() => {}} />)
    fireEvent.click(screen.getByText('plan.billing.annual'))
    // Pro annual equiv ($9,990) should appear
    expect(screen.getByText(/9,990/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/billing/__tests__/PlanPicker.test.tsx`
Expected: FAIL — cannot find module `../PlanPicker`.

- [ ] **Step 3: Implement `PlanPicker.tsx`**

```tsx
// src/components/billing/PlanPicker.tsx
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PLAN_TIERS, type TierId, type PlanTierDef } from '@/config/plan-catalog'

const ACCENT: Record<PlanTierDef['accent'], string> = {
  free: 'text-muted-foreground',
  pro: 'text-emerald-400',
  premium: 'text-amber-400',
  enterprise: 'text-slate-300',
}
const ACCENT_BG: Record<PlanTierDef['accent'], string> = {
  free: 'bg-muted',
  pro: 'bg-emerald-400/15',
  premium: 'bg-amber-400/15',
  enterprise: 'bg-slate-300/10',
}

const fmt = (n: number) => `$${n.toLocaleString('es-MX')}`

interface PlanPickerProps {
  currentTier: TierId
  onSelectTier: (tier: TierId) => void
}

export function PlanPicker({ currentTier, onSelectTier }: PlanPickerProps) {
  const { t } = useTranslation('billing')
  const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly')

  const tiers = useMemo(() => PLAN_TIERS, [])

  return (
    <div className="flex flex-col gap-6">
      {/* Billing toggle */}
      <div className="flex items-center gap-3">
        <div className="inline-flex rounded-full border border-input bg-muted/60 p-1">
          {(['monthly', 'annual'] as const).map(i => (
            <button
              key={i}
              type="button"
              onClick={() => setInterval(i)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-semibold transition cursor-pointer',
                interval === i ? 'bg-foreground text-background' : 'text-muted-foreground',
              )}
            >
              {t(`plan.billing.${i}`)}
            </button>
          ))}
        </div>
        <span className="rounded-full bg-emerald-400/12 px-2.5 py-1 text-xs font-semibold text-emerald-400">
          {t('plan.billing.save')}
        </span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiers.map(tier => (
          <PlanCard
            key={tier.id}
            tier={tier}
            interval={interval}
            isCurrent={tier.id === currentTier}
            onSelect={() => onSelectTier(tier.id)}
          />
        ))}
      </div>
    </div>
  )
}

function PlanCard({
  tier,
  interval,
  isCurrent,
  onSelect,
}: {
  tier: PlanTierDef
  interval: 'monthly' | 'annual'
  isCurrent: boolean
  onSelect: () => void
}) {
  const { t } = useTranslation('billing')
  const Icon = tier.icon
  const tierName = t(`plan.tiers.${tier.key}.name`)
  const price = interval === 'monthly' ? tier.priceMonthly : tier.priceAnnual

  return (
    <div
      data-tour={`plan-card-${tier.id.toLowerCase()}`}
      className={cn(
        'relative flex flex-col gap-4 rounded-2xl border border-input bg-card p-5 transition hover:-translate-y-0.5',
        tier.popular && 'border-emerald-400/55 ring-1 ring-emerald-400/25',
      )}
    >
      {tier.popular && (
        <span className="absolute -top-3 left-5 rounded-full bg-emerald-400 px-2.5 py-1 text-[11px] font-bold text-emerald-950">
          {t('plan.popular')}
        </span>
      )}
      <div className={cn('grid h-10 w-10 place-items-center rounded-xl', ACCENT_BG[tier.accent], ACCENT[tier.accent])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-lg font-bold">{tierName}</div>
      <p className="min-h-[34px] text-sm text-muted-foreground">{t(`plan.tiers.${tier.key}.pitch`)}</p>

      <div className="flex items-baseline gap-1.5">
        {price === null ? (
          <span className="text-xl font-extrabold">{t('plan.cta.contact')}</span>
        ) : (
          <>
            <span className="text-3xl font-extrabold tracking-tight">{fmt(price)}</span>
            <span className="text-xs text-muted-foreground">{interval === 'monthly' ? t('plan.perMonth') : t('plan.perYear')}</span>
            {price > 0 && <span className="text-[11px] text-muted-foreground">{t('plan.plusIva')}</span>}
          </>
        )}
      </div>
      <div className="min-h-[16px] text-xs text-muted-foreground">
        {tier.id === 'FREE'
          ? t('plan.forever')
          : tier.priceMonthly === null
            ? ''
            : interval === 'annual' && tier.priceAnnual
              ? t('plan.annualEquiv', { price: fmt(tier.priceAnnual) })
              : t('plan.billedMonthly')}
      </div>

      <ul className="mt-1 flex flex-col gap-2.5">
        {tier.featureKeys.map(fk => (
          <li key={fk} className="flex items-start gap-2 text-sm">
            <Check className={cn('mt-0.5 h-4 w-4 shrink-0', ACCENT[tier.accent])} />
            <span>
              {t(`plan.features.${fk}`)}
              {fk === 'chatbotBeta' && (
                <Badge variant="outline" className="ml-1.5 h-4 px-1 text-[9px]">
                  Beta
                </Badge>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-2">
        {isCurrent ? (
          <Button disabled variant="ghost" className="w-full cursor-default text-muted-foreground">
            {t('plan.cta.current')}
          </Button>
        ) : tier.checkout === 'coming_soon' ? (
          <Button disabled variant="outline" className="w-full gap-2">
            <Badge variant="outline" className="h-4 px-1 text-[10px]">
              {t('plan.comingSoon')}
            </Badge>
          </Button>
        ) : tier.checkout === 'contact' ? (
          <Button variant="outline" className="w-full cursor-pointer" onClick={onSelect}>
            {t('plan.cta.contact')}
          </Button>
        ) : (
          <Button
            className="w-full cursor-pointer"
            variant={tier.popular ? 'default' : 'outline'}
            onClick={onSelect}
          >
            {t('plan.cta.upgrade', { tier: tierName })}
          </Button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/billing/__tests__/PlanPicker.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/billing/PlanPicker.tsx src/components/billing/__tests__/PlanPicker.test.tsx
git commit -m "feat(billing): PlanPicker — 4-tier cards + monthly/annual toggle"
```

---

## Task 4: `<FeatureGate>` paywall-teaser

**Files:**
- Create: `src/components/billing/FeatureGate.tsx`
- Test: `src/components/billing/__tests__/FeatureGate.test.tsx`

**Access source:** `useAccess()` (`src/hooks/use-access.ts`) exposes `canFeature(code) => boolean`. The gate renders children when `canFeature(feature)` is true; otherwise blurs them and shows the upgrade card. The advertised tier comes from `requiredTier` prop, else `getTierForFeature(feature)`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/billing/__tests__/FeatureGate.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeatureGate } from '../FeatureGate'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: any) => (o?.tier ? `${k}:${o.tier}` : k) }),
}))

const mockCanFeature = vi.fn()
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ canFeature: mockCanFeature, role: 'OWNER' }) }))

describe('FeatureGate', () => {
  it('renders children when the venue has access', () => {
    mockCanFeature.mockReturnValue(true)
    render(<FeatureGate feature="CFDI"><div>secret content</div></FeatureGate>)
    expect(screen.getByText('secret content')).toBeInTheDocument()
    expect(screen.queryByText('featureGate.upgrade:Premium')).not.toBeInTheDocument()
  })

  it('shows the paywall naming the correct tier when access is missing', () => {
    mockCanFeature.mockReturnValue(false)
    render(<FeatureGate feature="CFDI"><div>secret content</div></FeatureGate>)
    // CFDI → Premium (from catalog)
    expect(screen.getByText('featureGate.upgrade:Premium')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/billing/__tests__/FeatureGate.test.tsx`
Expected: FAIL — cannot find module `../FeatureGate`.

- [ ] **Step 3: Implement `FeatureGate.tsx`**

```tsx
// src/components/billing/FeatureGate.tsx
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Button } from '@/components/ui/button'
import { getTierForFeature, getTierDef, type TierId } from '@/config/plan-catalog'
import { cn } from '@/lib/utils'

interface FeatureGateProps {
  /** Feature code that gates this content (e.g. 'CFDI'). */
  feature: string
  /** Override the advertised tier; defaults to getTierForFeature(feature). */
  requiredTier?: TierId
  children: React.ReactNode
}

export function FeatureGate({ feature, requiredTier, children }: FeatureGateProps) {
  const { t } = useTranslation('billing')
  const { canFeature } = useAccess()
  const { fullBasePath } = useCurrentVenue()
  const navigate = useNavigate()

  const hasAccess = canFeature(feature)
  const tierId = useMemo(() => requiredTier ?? getTierForFeature(feature) ?? 'PRO', [requiredTier, feature])

  if (hasAccess) return <>{children}</>

  const def = getTierDef(tierId)
  const Icon = def.icon
  const tierName = t(`plan.tiers.${def.key}.name`)
  const ACCENT: Record<string, string> = { free: 'text-muted-foreground', pro: 'text-emerald-400', premium: 'text-amber-400', enterprise: 'text-slate-300' }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-input">
      {/* blurred teaser */}
      <div aria-hidden className="pointer-events-none select-none opacity-50 blur-[5px]">
        {children}
      </div>
      {/* paywall card */}
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-input bg-popover p-7 text-center shadow-2xl">
          <div className={cn('mx-auto mb-4 grid h-13 w-13 place-items-center rounded-full bg-amber-400/15', ACCENT[def.accent])}>
            <Icon className="h-6 w-6" />
          </div>
          <p className={cn('text-[11px] font-bold uppercase tracking-wide', ACCENT[def.accent])}>
            {t('featureGate.tierTag', { tier: tierName })}
          </p>
          <p className="mx-auto mb-5 mt-3 max-w-[30ch] text-sm text-muted-foreground">
            {t('featureGate.body', { tier: tierName })}
          </p>
          <Button className="cursor-pointer gap-2" onClick={() => navigate(`${fullBasePath}/settings/billing/subscriptions`)}>
            <Icon className="h-4 w-4" />
            {t('featureGate.upgrade', { tier: tierName })}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/billing/__tests__/FeatureGate.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/billing/FeatureGate.tsx src/components/billing/__tests__/FeatureGate.test.tsx
git commit -m "feat(billing): FeatureGate paywall-teaser (blur + tier-aware CTA)"
```

---

## Task 5: Extract `<SuperadminFeatureControl>` into a collapsible panel

**Files:**
- Create: `src/pages/Settings/Billing/components/SuperadminFeatureControl.tsx`
- Modify: `src/pages/Settings/Billing/Subscriptions.tsx` (remove the inline superadmin block in Task 6)

**Goal:** Move the existing superadmin "Control de Funciones Superadmin" panel (currently `Subscriptions.tsx` lines ~430–575: Otorgar Prueba / Activar Función / active-features toggles) into its own component, wrapped in `Collapsible` (`@/components/ui/collapsible`) so it is hidden by default. This panel is superadmin-only → **exempt from i18n** (hardcoded Spanish, per `critical-warnings.md`). Keep the amber-pink superadmin gradient (the allowed exception).

- [ ] **Step 1: Create the component shell with props for the data + mutations it needs**

The component receives everything it needs as props so it owns no data fetching:

```tsx
// src/pages/Settings/Billing/components/SuperadminFeatureControl.tsx
import { useState } from 'react'
import { ChevronDown, Shield } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface SuperadminFeatureControlProps {
  /** Render the existing grant-trial / enable / active-feature controls. */
  children: React.ReactNode
}

/**
 * Superadmin-only control plane for venue features (grant trial / enable without payment / disable).
 * Collapsed by default so it never clutters the customer-facing plan view.
 * Hardcoded Spanish (superadmin screens are i18n-exempt).
 */
export function SuperadminFeatureControl({ children }: SuperadminFeatureControlProps) {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-8">
      <Card className="overflow-hidden border-input bg-gradient-to-r from-amber-400/10 to-pink-500/10">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-4 cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-r from-amber-400 to-pink-500 text-white">
              <Shield className="h-4.5 w-4.5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold">Control de Funciones · Superadmin</p>
              <p className="text-xs text-muted-foreground">Otorgar prueba, activar sin pago, o desactivar funciones de este venue.</p>
            </div>
          </div>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition', open && 'rotate-180')} />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-4">{children}</CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors for this file (it has no external deps beyond UI primitives).

- [ ] **Step 3: Commit**

```bash
git add src/pages/Settings/Billing/components/SuperadminFeatureControl.tsx
git commit -m "feat(billing): collapsible SuperadminFeatureControl shell"
```

---

## Task 6: Rebuild the Plan tab (`Subscriptions.tsx`)

**Files:**
- Modify: `src/pages/Settings/Billing/Subscriptions.tsx`

**Goal:** Replace the à-la-carte feature grid (the customer-facing cards with "Iniciar Prueba Gratuita de 2 días") with `<CurrentPlanCard>` + `<PlanPicker>`. Keep the existing superadmin data hooks (`allPlatformFeatures`, mutations, dialogs) but render those controls **inside** `<SuperadminFeatureControl>`. Remove the `alaCarteActiveFeatures` rendering. Map the current plan tier from `getVenuePlan()` (already loaded by `CurrentPlanCard`) — for `PlanPicker.currentTier`, fetch the plan state.

- [ ] **Step 1: Add imports at the top of `Subscriptions.tsx`**

After the existing imports (around line 37), add:

```tsx
import { PlanPicker } from '@/components/billing/PlanPicker'
import { PlanUpgradeDialog } from '@/components/billing/PlanUpgradeDialog'
import { SuperadminFeatureControl } from './components/SuperadminFeatureControl'
import { getVenuePlan } from '@/services/features.service'
import type { TierId } from '@/config/plan-catalog'
```

- [ ] **Step 2: Add plan-state query + upgrade-dialog state inside the component**

After the existing `featuresStatus` query (around line 74), add:

```tsx
// Current plan tier for the picker (PLAN_PRO base subscription state).
const { data: planState } = useQuery({
  queryKey: ['venuePlan', venueId],
  queryFn: () => getVenuePlan(venueId),
  enabled: !!venueId && canViewBilling,
})
const currentTier: TierId = (planState?.planTier as TierId) ?? 'FREE'

const [upgradeTier, setUpgradeTier] = useState<TierId | null>(null)
```

- [ ] **Step 3: Replace the à-la-carte render block with the plan-first layout**

Find the JSX region that renders the available/active à-la-carte feature grid (the cards with subscribe/trial buttons — uses `alaCarteActiveFeatures` and `featuresStatus.availableFeatures`). Replace that entire region with:

```tsx
<div className="mx-auto w-full max-w-6xl px-6 py-6">
  {/* Current plan + manage (cancel / reactivate / billing portal) */}
  <CurrentPlanCard />

  {/* Plan-first picker */}
  <div className="mt-8">
    <PlanPicker currentTier={currentTier} onSelectTier={tier => setUpgradeTier(tier)} />
  </div>

  {/* Superadmin control plane (collapsed by default) */}
  {isSuperadmin && (
    <SuperadminFeatureControl>
      {/* MOVE the existing superadmin JSX here verbatim:
          - "Otorgar Prueba" / "Activar Función" actions
          - active-features toggles + disable
          - the grant/enable dialogs can stay below or here */}
    </SuperadminFeatureControl>
  )}
</div>

<PlanUpgradeDialog tier={upgradeTier} onClose={() => setUpgradeTier(null)} />
```

Move the existing superadmin block (the amber-pink "Control de Funciones Superadmin" card + its action buttons + active-feature toggle list) into the `<SuperadminFeatureControl>` children. Delete the old à-la-carte cards entirely. Keep all superadmin mutations/dialogs (`superadminGrantTrialMutation`, `superadminEnableMutation`, `superadminDisableMutation`, and their dialogs) — they are still triggered from inside the panel.

- [ ] **Step 4: Remove now-dead code**

Delete `alaCarteActiveFeatures` (and `PLAN_TIER_CODES` if unused elsewhere) and any `availableFeatures` rendering, subscribe-dialog state (`subscribingFeatureCode`, `pendingSubscriptionFeatureCode`) that only served the à-la-carte grid. Keep `featuresStatus` only if the superadmin panel still uses it (it does — for active-feature toggles).

- [ ] **Step 5: Verify build + lint + existing tests**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: no type errors, lint clean, tests pass. Manually confirm no unused-import warnings.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Settings/Billing/Subscriptions.tsx
git commit -m "feat(billing): plan-first Plan tab — PlanPicker replaces à-la-carte grid"
```

---

## Task 7: `<PlanUpgradeDialog>` (assisted activation — Fase A interim)

**Files:**
- Create: `src/components/billing/PlanUpgradeDialog.tsx`

**Goal:** Frontend-only upgrade intent. Fase A does NOT wire self-serve Stripe checkout (that is Fase B `POST /plan/change`). The dialog shows the chosen plan summary + an assisted-activation CTA (WhatsApp/contact). This keeps the deliverable honest for a base with 0 self-serve plan changes today.

- [ ] **Step 1: Implement the dialog**

```tsx
// src/components/billing/PlanUpgradeDialog.tsx
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getTierDef, type TierId } from '@/config/plan-catalog'

const SALES_WHATSAPP = 'https://wa.me/5215555555555' // TODO(ops): real sales number

export function PlanUpgradeDialog({ tier, onClose }: { tier: TierId | null; onClose: () => void }) {
  const { t } = useTranslation('billing')
  if (!tier) return null
  const def = getTierDef(tier)
  const tierName = t(`plan.tiers.${def.key}.name`)
  const Icon = def.icon

  return (
    <Dialog open={!!tier} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" /> {t('plan.cta.upgrade', { tier: tierName })}
          </DialogTitle>
          <DialogDescription>{t(`plan.tiers.${def.key}.pitch`)}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t('plan.assistedBody', {
            defaultValue: 'Activamos tu plan contigo para asegurarnos de que todo quede perfecto. Escríbenos y lo dejamos listo hoy.',
          })}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel', { defaultValue: 'Cancelar' })}
          </Button>
          <Button asChild className="cursor-pointer">
            <a href={`${SALES_WHATSAPP}?text=${encodeURIComponent(`Quiero activar el plan ${tierName}`)}`} target="_blank" rel="noreferrer">
              {t('plan.assistedCta', { defaultValue: 'Hablar con un asesor' })}
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Add the two `defaultValue` keys to both locale files**

In `src/locales/es/billing.json` `plan` block add `"assistedBody"` / `"assistedCta"`; mirror in `en`. (The component already provides `defaultValue` fallbacks, so the build is green either way — add real keys to satisfy the no-missing-key lint rule.)

es: `"assistedBody": "Activamos tu plan contigo para que todo quede perfecto. Escríbenos y lo dejamos listo hoy.", "assistedCta": "Hablar con un asesor"`
en: `"assistedBody": "We activate your plan with you so everything is perfect. Message us and we'll set it up today.", "assistedCta": "Talk to an advisor"`

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/billing/PlanUpgradeDialog.tsx src/locales/es/billing.json src/locales/en/billing.json
git commit -m "feat(billing): assisted-activation upgrade dialog (Fase A interim)"
```

---

## Task 8: Relabel layout (`BillingLayout.tsx`)

**Files:**
- Modify: `src/pages/Settings/Billing/BillingLayout.tsx:29`

- [ ] **Step 1: Change the first tab label to "Plan"**

Replace line 29:

```tsx
{ to: `${basePath}/subscriptions`, label: t('tabs.plan') },
```

(Route path stays `/subscriptions` to avoid breaking links; only the label and page title change. `pageTitle` now reads "Plan y Facturación" from Task 2.)

- [ ] **Step 2: Verify the portal renders end-to-end**

Run: `npm run dev`, navigate to `…/settings/billing/subscriptions`. Confirm:
- Header reads "Plan y Facturación", first tab reads "Plan".
- 4 plan cards render with the monthly/annual toggle; Pro shows "Más popular"; Premium shows "Muy pronto".
- No à-la-carte "Prueba Gratuita de 2 días" cards remain.
- As superadmin: the collapsible "Control de Funciones · Superadmin" appears, collapsed, and still grants/activates.
- Toggle light/dark mode — borders use `border-input`, no broken colors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Settings/Billing/BillingLayout.tsx
git commit -m "feat(billing): rename section to Plan y Facturación, tab to Plan"
```

---

## Task 9 (optional, DRY): point `/setup` PlanStep at the shared catalog

**Files:**
- Modify: `src/pages/Setup/steps/PlanStep.tsx`

**Goal (low-risk slice):** Replace the hardcoded `PRICES` constant in `PlanStep.tsx:27-30` with values read from `getTierDef('PRO')` in `plan-catalog.ts`, so onboarding and the portal share one price source. Do NOT touch the Stripe SetupIntent flow. (Full `<PlanPicker>` reuse in onboarding is deferred — onboarding currently forces Pro, which is fine.)

- [ ] **Step 1: Replace the local `PRICES` with catalog-derived values**

```tsx
import { getTierDef } from '@/config/plan-catalog'
const PRO = getTierDef('PRO')
const PRICES = {
  monthly: { full: `$${PRO.priceMonthly!.toLocaleString('es-MX')}`, promo: '$599', label: 'mes' },
  annual: { full: `$${PRO.priceAnnual!.toLocaleString('es-MX')}`, promo: `$${PRO.priceAnnual!.toLocaleString('es-MX')}`, label: 'año' },
}
```

- [ ] **Step 2: Verify onboarding still renders + Stripe step unaffected**

Run: `npx tsc --noEmit && npm run lint && npx vitest run src/test/payment-onboarding.test.ts`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Setup/steps/PlanStep.tsx
git commit -m "refactor(setup): source Pro pricing from shared plan-catalog (DRY)"
```

---

## Task 10: Final verification

- [ ] **Step 1: Full gate**

Run: `npm run build && npm run lint && npx vitest run`
Expected: build succeeds, lint clean, all unit tests pass.

- [ ] **Step 2: Manual QA matrix**

- Roles: OWNER (sees plan, no superadmin panel), SUPERADMIN (sees collapsed panel + can grant/activate), VIEWER/WAITER (no billing access → existing guard).
- Light + dark mode.
- White-label mode (`/wl/venues/:slug/...`) — tabs + FeatureGate CTA navigate via `fullBasePath`.
- Wrap one real gated page (e.g. CFDI/Facturas) in `<FeatureGate feature="CFDI">` and confirm a Free venue sees the Premium paywall; a venue with access sees content. (Pick one page; full rollout of FeatureGate across pages is a follow-up.)

- [ ] **Step 3: Update the spec checklist**

Mark Fase A items done in `docs/superpowers/specs/2026-06-08-planes-y-facturacion-redesign-design.md` section 10.

- [ ] **Step 4: Open PR (do NOT merge — Jose reviews)**

```bash
git push -u origin <branch>
gh pr create --title "feat(billing): plan-first portal (Fase A)" --body "..."
```

---

## Self-Review notes (coverage vs spec)

- Spec §6 `<FeatureGate>` → Task 4. §9 portal IA (Plan/Facturas/Pagos/Tokens) → Tasks 6, 8 (Facturas/Pagos/Tokens tabs already exist; only relabeled). §9 superadmin collapse → Task 5–6. §5 tier map + §4 tiers/icons/price → Task 1 + 3. §10 Fase A scope (frontend-only, render N tiers) → all.
- **Out of scope (Fase B, intentionally):** real tier→capability gating in backend, Stripe Premium product, self-serve `POST /plan/change`, the `grandfathered` marker, MCP tools. Task 7 is the honest Fase-A stand-in for upgrades.
- **Carries a known stub:** `SALES_WHATSAPP` number in `PlanUpgradeDialog` — flagged `TODO(ops)`; replace with the real sales contact before shipping.
