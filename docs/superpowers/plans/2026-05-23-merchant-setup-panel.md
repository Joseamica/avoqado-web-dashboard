# Merchant Setup Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the linear AngelPay wizard with an object-centric panel (MerchantSetupPanel) that shows all merchant configuration as a grid of cards, supports both setup (atomic create with localStorage draft) and edit (per-card save), with zero impact on Blumon flows.

**Architecture:** A new `MerchantSetupPanel.tsx` component (FullScreenModal) wraps a useReducer-driven state grid. Each piece of merchant config (venue, login, merchant, slot, cost, pricing, settlement, revenue-share, terminals) lives in its own card with focused modal. In setup mode, all changes are mirrored to localStorage (debounce 500ms) and atomically committed via the existing `full-setup-angelpay` endpoint on Activar. In edit mode, each card hits its own CRUD endpoint via TanStack Query mutations. The existing `AngelPayWizard.tsx` is deleted at the end of the plan after the panel passes validation in staging.

**Tech Stack:** React 18 + TypeScript + TanStack Query + Tailwind + Radix UI (Sheet, AlertDialog, Dialog) + Vitest + Playwright + (zero backend changes).

**Spec:** `docs/superpowers/specs/2026-05-23-merchant-setup-panel-design.md`

---

## Phase 0 · Setup the worktree

### Task 0.1: Create isolated worktree off develop

**Files:**
- N/A (git operation only)

- [ ] **Step 1: Confirm starting branch**

Run from project root `/Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard`:
```bash
git branch --show-current
git status --short | head -5
```
Expected: `develop`, working tree may have uncommitted changes from prior work (that's fine, they'll stay on develop).

- [ ] **Step 2: Create the worktree**

```bash
cd /Users/amieva/Documents/Programming/Avoqado
git -C avoqado-web-dashboard worktree add -b feat/merchant-setup-panel \
  avoqado-web-dashboard-merchant-setup-panel develop
```

Expected: `Preparing worktree (new branch 'feat/merchant-setup-panel')` + `HEAD is now at <sha>`.

From now on, all commands run inside `avoqado-web-dashboard-merchant-setup-panel/` unless stated otherwise.

- [ ] **Step 3: Install dependencies in the new worktree**

```bash
cd avoqado-web-dashboard-merchant-setup-panel
npm install
```

Expected: completes without errors. (Worktrees share node_modules through symlinks if your setup uses pnpm; with npm it usually re-installs. Either is fine.)

---

## Phase 1 · Foundation utilities and types

### Task 1.1: Rescue fee conversion helpers into `utils/fees.ts`

**Files:**
- Create: `src/utils/fees.ts`
- Create: `src/utils/__tests__/fees.test.ts`
- Reference (do not delete yet): `src/pages/Superadmin/components/merchant-accounts/angelpay-wizard/feeTemplate.ts`

The current wizard's `feeTemplate.ts` exposes `decimalToPercent` and `percentToDecimal` used elsewhere (RevenueShareEditDialog, AngelPayWizard). We move them to a stable location before deleting the wizard at the end.

- [ ] **Step 1: Write the failing test**

Create `src/utils/__tests__/fees.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { decimalToPercent, percentToDecimal } from '../fees'

describe('fees', () => {
  it('decimalToPercent / percentToDecimal round-trip sin drift de punto flotante', () => {
    expect(decimalToPercent(0.015)).toBe(1.5)
    expect(decimalToPercent(0.0285)).toBe(2.85)
    expect(decimalToPercent(0.0115)).toBe(1.15)
    expect(percentToDecimal(1.5)).toBe(0.015)
    expect(percentToDecimal(2.85)).toBe(0.0285)
    expect(percentToDecimal(1.15)).toBe(0.0115)
    for (const d of [0.015, 0.018, 0.025, 0.028, 0.0042]) {
      expect(percentToDecimal(decimalToPercent(d))).toBe(d)
    }
  })

  it('decimalToPercent handles 0, null-ish and very small values', () => {
    expect(decimalToPercent(0)).toBe(0)
    expect(decimalToPercent(0.00001)).toBe(0.001)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/utils/__tests__/fees.test.ts
```
Expected: FAIL with "Cannot find module '../fees'".

- [ ] **Step 3: Create `src/utils/fees.ts`**

```ts
/**
 * Conversion helpers between decimal-stored rates (DB convention, e.g. 0.015)
 * and percent-displayed rates (UI convention, e.g. 1.5).
 *
 * The `.toFixed(6)` round-trip prevents JS float drift like 0.035 * 100 =
 * 3.5000000000000004 from leaking into the UI.
 */

export const decimalToPercent = (d: number): number => parseFloat((d * 100).toFixed(6))

export const percentToDecimal = (p: number): number => parseFloat((p / 100).toFixed(6))
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/utils/__tests__/fees.test.ts
```
Expected: 2 tests pass.

- [ ] **Step 5: Find every import of the old `feeTemplate` and re-point to `utils/fees`**

```bash
grep -rn "from.*feeTemplate" src/ --include="*.ts" --include="*.tsx" | grep -v "/__tests__/"
```
Expected output (these are what to update):
- `src/pages/Superadmin/components/RevenueShareEditDialog.tsx` (if it imports `feeTemplate` — check)
- `src/pages/Superadmin/components/merchant-accounts/angelpay-wizard/AngelPayWizard.tsx`

For each file in the output, replace:
```ts
import { decimalToPercent, percentToDecimal } from './feeTemplate'
// or relative path equivalent
```
with:
```ts
import { decimalToPercent, percentToDecimal } from '@/utils/fees'
```

- [ ] **Step 6: TypeScript check + lint**

```bash
npx tsc --noEmit
npm run lint -- src/utils src/pages/Superadmin/components 2>&1 | tail -3
```
Expected: zero TS errors.

- [ ] **Step 7: Commit**

```bash
git add src/utils/fees.ts src/utils/__tests__/fees.test.ts \
        $(grep -rl "from.*feeTemplate" src/ --include="*.ts" --include="*.tsx" 2>/dev/null)
git commit -m "refactor(fees): extract decimal/percent helpers to utils/fees"
```

---

### Task 1.2: Define `types.ts` for the panel state

**Files:**
- Create: `src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/types.ts`

- [ ] **Step 1: Create the types file**

```ts
/**
 * Shared types for the MerchantSetupPanel. All cards read/write a slice of
 * `SetupState`. Treat this file as the single source of truth for state shape.
 *
 * Spec: docs/superpowers/specs/2026-05-23-merchant-setup-panel-design.md
 */

export type CardType = 'DEBIT' | 'CREDIT' | 'AMEX' | 'INTERNATIONAL'

export type AccountSlot = 'PRIMARY' | 'SECONDARY' | 'TERTIARY'

/** Schema version for localStorage draft. Bump when SetupState shape changes
 *  incompatibly; older drafts are silently discarded on load. */
export const DRAFT_SCHEMA_VERSION = 1

// ─── Per-card slices ────────────────────────────────────────────

export interface VenueSlice {
  id: string | null
  name: string | null
  slug: string | null
}

export type LoginSlice =
  | { mode: 'existing'; angelpayUserAccountId: string }
  | { mode: 'new'; email: string; pin: string; environment: 'QA' | 'PROD' }
  | { mode: 'empty' } // sentinel, no choice yet

export interface MerchantSlice {
  mode: 'create' | 'existing' | 'empty'
  // create-mode fields
  externalMerchantId: string
  name: string
  affiliation: string
  displayName: string
  idConfirmed: boolean
  // existing-mode fields
  existingMerchantId?: string
  existingMerchantLabel?: string
}

export interface SlotSlice {
  accountType: AccountSlot
  mode: 'fill' | 'replace' | 'empty'
  replacedAccountId?: string
  fromSlot?: AccountSlot
  moveStrategy?: 'swap' | 'vacate'
}

export interface CostSlice {
  skipped: boolean
  aggregatorId?: string
  debitRate?: number      // decimals (0.015 = 1.5%)
  creditRate?: number
  amexRate?: number
  internationalRate?: number
  fixedCostPerTransaction?: number
  monthlyFee?: number
  includesTax: boolean
  taxRate: number
  effectiveFrom: string   // YYYY-MM-DD (or '' for today)
}

export interface PricingSlice {
  skipped: boolean
  debitRate?: number
  creditRate?: number
  amexRate?: number
  internationalRate?: number
  fixedFeePerTransaction?: number
  monthlyServiceFee?: number
  includesTax: boolean
  taxRate: number
  effectiveFrom: string
}

export interface SettlementSlice {
  skipped: boolean
  daysDebit?: number          // default 1 once user opens the card
  daysCredit?: number
  daysAmex?: number           // default 3 (typically slower)
  daysInternational?: number  // default 3
  dayType: 'BUSINESS_DAYS' | 'CALENDAR_DAYS'
  cutoffTime: string          // 'HH:mm' or ''
  cutoffTimezone: string      // IANA tz or ''
  effectiveFrom: string
}

export interface RevenueShareSlice {
  skipped: boolean
  useAggregator: boolean
  aggregatorDebitRate?: number
  aggregatorCreditRate?: number
  aggregatorAmexRate?: number
  aggregatorInternationalRate?: number
  aggregatorPriceIncludesTax: boolean
  avoqadoShareOfProviderMargin: number   // 0..1, default 0.5
  avoqadoShareOfAggregatorMargin?: number
  taxRate: number
}

export interface TerminalsSlice {
  skipped: boolean
  terminalIds: string[]
}

// ─── Aggregate panel state ───────────────────────────────────────

export interface SetupState {
  schemaVersion: number
  idempotencyKey: string
  venue: VenueSlice
  login: LoginSlice
  merchant: MerchantSlice
  slot: SlotSlice
  cost: CostSlice
  pricing: PricingSlice
  settlement: SettlementSlice
  revenueShare: RevenueShareSlice
  terminals: TerminalsSlice
}

/** Identifies which cards are required for "Activar merchant" to be enabled.
 *  Optional cards still appear in the panel but never block activation. */
export const REQUIRED_CARDS = [
  'venue',
  'login',
  'merchant',
  'slot',
  'cost',
  'pricing',
  'settlement',
] as const

export type RequiredCardKey = (typeof REQUIRED_CARDS)[number]
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/types.ts
git commit -m "feat(setup-panel): add shared state types"
```

---

### Task 1.3: Implement `useSetupReducer.ts` (TDD)

**Files:**
- Create: `src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/useSetupReducer.ts`
- Create: `src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/__tests__/useSetupReducer.test.ts`

- [ ] **Step 1: Write failing tests for `initialState`**

```ts
// src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/__tests__/useSetupReducer.test.ts
import { describe, it, expect } from 'vitest'
import { initialState, setupReducer, isCardValid, isRequiredComplete } from '../useSetupReducer'
import { DRAFT_SCHEMA_VERSION } from '../types'

describe('initialState', () => {
  it('returns empty state with current schema version + unique idempotencyKey', () => {
    const a = initialState()
    const b = initialState()
    expect(a.schemaVersion).toBe(DRAFT_SCHEMA_VERSION)
    expect(a.venue.id).toBeNull()
    expect(a.login).toEqual({ mode: 'empty' })
    expect(a.merchant.mode).toBe('empty')
    expect(a.slot.mode).toBe('empty')
    expect(a.idempotencyKey).not.toBe(b.idempotencyKey)
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npx vitest run src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/__tests__/useSetupReducer.test.ts
```
Expected: FAIL — Cannot find module.

- [ ] **Step 3: Create `useSetupReducer.ts` with `initialState` only**

```ts
// src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/useSetupReducer.ts
import type {
  SetupState,
  VenueSlice,
  LoginSlice,
  MerchantSlice,
  SlotSlice,
  CostSlice,
  PricingSlice,
  SettlementSlice,
  RevenueShareSlice,
  TerminalsSlice,
  RequiredCardKey,
} from './types'
import { DRAFT_SCHEMA_VERSION, REQUIRED_CARDS } from './types'

const freshVenue = (): VenueSlice => ({ id: null, name: null, slug: null })
const freshLogin = (): LoginSlice => ({ mode: 'empty' })
const freshMerchant = (): MerchantSlice => ({
  mode: 'empty',
  externalMerchantId: '',
  name: '',
  affiliation: '',
  displayName: '',
  idConfirmed: false,
})
const freshSlot = (): SlotSlice => ({ accountType: 'PRIMARY', mode: 'empty' })
const freshCost = (): CostSlice => ({
  skipped: false,
  includesTax: true,
  taxRate: 0.16,
  effectiveFrom: '',
})
const freshPricing = (): PricingSlice => ({
  skipped: false,
  includesTax: true,
  taxRate: 0.16,
  effectiveFrom: '',
})
const freshSettlement = (): SettlementSlice => ({
  skipped: false,
  daysDebit: 1,
  daysCredit: 1,
  daysAmex: 3,
  daysInternational: 3,
  dayType: 'BUSINESS_DAYS',
  cutoffTime: '23:00',
  cutoffTimezone: 'America/Mexico_City',
  effectiveFrom: '',
})
const freshRevenueShare = (): RevenueShareSlice => ({
  skipped: true,
  useAggregator: false,
  aggregatorPriceIncludesTax: true,
  avoqadoShareOfProviderMargin: 0.5,
  taxRate: 0.16,
})
const freshTerminals = (): TerminalsSlice => ({ skipped: false, terminalIds: [] })

export function initialState(): SetupState {
  return {
    schemaVersion: DRAFT_SCHEMA_VERSION,
    idempotencyKey: crypto.randomUUID(),
    venue: freshVenue(),
    login: freshLogin(),
    merchant: freshMerchant(),
    slot: freshSlot(),
    cost: freshCost(),
    pricing: freshPricing(),
    settlement: freshSettlement(),
    revenueShare: freshRevenueShare(),
    terminals: freshTerminals(),
  }
}

// Stubs to satisfy the test file imports; real implementations follow in next steps.
export function setupReducer(state: SetupState, _action: SetupAction): SetupState {
  return state
}
export function isCardValid(_state: SetupState, _card: RequiredCardKey): boolean {
  return false
}
export function isRequiredComplete(state: SetupState): boolean {
  return REQUIRED_CARDS.every(k => isCardValid(state, k))
}

export type SetupAction = { type: 'NOOP' }
```

- [ ] **Step 4: Run, expect PASS**

```bash
npx vitest run src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/__tests__/useSetupReducer.test.ts -t initialState
```
Expected: 1 test passes.

- [ ] **Step 5: Add tests for actions**

Append to the test file:
```ts
describe('setupReducer · SET_VENUE', () => {
  it('writes venue + resets downstream when venue changes', () => {
    let s = initialState()
    s = setupReducer(s, { type: 'SET_MERCHANT', merchant: { ...s.merchant, mode: 'create', externalMerchantId: '999', idConfirmed: true } })
    expect(s.merchant.externalMerchantId).toBe('999')
    s = setupReducer(s, { type: 'SET_VENUE', venue: { id: 'v1', name: 'V1', slug: 'v1' } })
    expect(s.venue.id).toBe('v1')
    expect(s.merchant.mode).toBe('empty')        // downstream reset
    expect(s.merchant.externalMerchantId).toBe('')
  })

  it('does NOT reset downstream when same venue is reselected', () => {
    let s = initialState()
    s = setupReducer(s, { type: 'SET_VENUE', venue: { id: 'v1', name: 'V1', slug: 'v1' } })
    s = setupReducer(s, { type: 'SET_MERCHANT', merchant: { ...s.merchant, mode: 'create', externalMerchantId: '999', idConfirmed: true } })
    s = setupReducer(s, { type: 'SET_VENUE', venue: { id: 'v1', name: 'V1 renamed', slug: 'v1' } })
    expect(s.merchant.externalMerchantId).toBe('999')
  })
})

describe('setupReducer · SET_LOGIN', () => {
  it('changing login resets the merchant choice (a merchant belongs to a login)', () => {
    let s = initialState()
    s = setupReducer(s, { type: 'SET_LOGIN', login: { mode: 'existing', angelpayUserAccountId: 'u1' } })
    s = setupReducer(s, { type: 'SET_MERCHANT', merchant: { ...s.merchant, mode: 'existing', existingMerchantId: 'm1' } })
    s = setupReducer(s, { type: 'SET_LOGIN', login: { mode: 'existing', angelpayUserAccountId: 'u2' } })
    expect(s.merchant.mode).toBe('empty')
  })
})

describe('setupReducer · SET_SLOT', () => {
  it('when slot moves to replace mode, pricing is forced un-skipped', () => {
    let s = initialState()
    s = setupReducer(s, { type: 'SET_PRICING', pricing: { ...s.pricing, skipped: true } })
    s = setupReducer(s, { type: 'SET_SLOT', slot: { accountType: 'PRIMARY', mode: 'replace', replacedAccountId: 'acc1' } })
    expect(s.pricing.skipped).toBe(false)
  })
})

describe('isCardValid', () => {
  it('venue card requires venue.id', () => {
    let s = initialState()
    expect(isCardValid(s, 'venue')).toBe(false)
    s = setupReducer(s, { type: 'SET_VENUE', venue: { id: 'v1', name: 'V1', slug: 'v1' } })
    expect(isCardValid(s, 'venue')).toBe(true)
  })

  it('login card requires email+pin in "new" mode', () => {
    let s = initialState()
    s = setupReducer(s, { type: 'SET_LOGIN', login: { mode: 'new', email: '', pin: '', environment: 'QA' } })
    expect(isCardValid(s, 'login')).toBe(false)
    s = setupReducer(s, { type: 'SET_LOGIN', login: { mode: 'new', email: 'a@b.com', pin: '123456', environment: 'QA' } })
    expect(isCardValid(s, 'login')).toBe(true)
  })

  it('slot card invalid when fill+mode picks a slot with an occupant (caller provides occupants)', () => {
    // The reducer is pure — the occupant table is passed in via SET_SLOT action only,
    // so this test asserts the SHAPE of validity. SlotCard owns the conflict check
    // outside the reducer (see Task 3.5). isCardValid here checks the reducer-level
    // contract: mode must not be 'empty', and replace mode must have replacedAccountId.
    let s = initialState()
    expect(isCardValid(s, 'slot')).toBe(false)                            // empty
    s = setupReducer(s, { type: 'SET_SLOT', slot: { accountType: 'PRIMARY', mode: 'fill' } })
    expect(isCardValid(s, 'slot')).toBe(true)                             // fill OK at reducer level
    s = setupReducer(s, { type: 'SET_SLOT', slot: { accountType: 'PRIMARY', mode: 'replace' } })
    expect(isCardValid(s, 'slot')).toBe(false)                            // replace without replacedAccountId
  })
})

describe('isRequiredComplete', () => {
  it('false until all 7 required cards are valid', () => {
    const s = initialState()
    expect(isRequiredComplete(s)).toBe(false)
  })
})

describe('LOAD_DRAFT', () => {
  it('replaces state if draft schemaVersion matches', () => {
    let s = initialState()
    const draft: SetupState = {
      ...initialState(),
      venue: { id: 'v1', name: 'V1', slug: 'v1' },
    }
    s = setupReducer(s, { type: 'LOAD_DRAFT', state: draft })
    expect(s.venue.id).toBe('v1')
  })
})

describe('RESET', () => {
  it('returns a fresh state preserving NOTHING from before', () => {
    let s = initialState()
    s = setupReducer(s, { type: 'SET_VENUE', venue: { id: 'v1', name: 'V1', slug: 'v1' } })
    s = setupReducer(s, { type: 'RESET' })
    expect(s.venue.id).toBeNull()
  })
})
```

- [ ] **Step 6: Run, expect failures**

```bash
npx vitest run src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/__tests__/useSetupReducer.test.ts
```
Expected: many tests fail (reducer stub returns state unchanged).

- [ ] **Step 7: Implement the full reducer**

Replace the stubs in `useSetupReducer.ts` with the full implementation:
```ts
// Update the SetupAction type (replace the NOOP stub at the bottom of the file)
export type SetupAction =
  | { type: 'SET_VENUE'; venue: VenueSlice }
  | { type: 'SET_LOGIN'; login: LoginSlice }
  | { type: 'SET_MERCHANT'; merchant: MerchantSlice }
  | { type: 'SET_SLOT'; slot: SlotSlice }
  | { type: 'SET_COST'; cost: CostSlice }
  | { type: 'SET_PRICING'; pricing: PricingSlice }
  | { type: 'SET_SETTLEMENT'; settlement: SettlementSlice }
  | { type: 'SET_REVENUE_SHARE'; revenueShare: RevenueShareSlice }
  | { type: 'SET_TERMINALS'; terminals: TerminalsSlice }
  | { type: 'LOAD_DRAFT'; state: SetupState }
  | { type: 'RESET' }

export function setupReducer(state: SetupState, action: SetupAction): SetupState {
  switch (action.type) {
    case 'SET_VENUE': {
      // Same venue re-selected: keep downstream.
      if (state.venue.id === action.venue.id) {
        return { ...state, venue: action.venue }
      }
      // Different venue: wipe everything downstream.
      return {
        ...state,
        venue: action.venue,
        login: freshLogin(),
        merchant: freshMerchant(),
        slot: freshSlot(),
        cost: freshCost(),
        pricing: freshPricing(),
        settlement: freshSettlement(),
        revenueShare: freshRevenueShare(),
        terminals: freshTerminals(),
      }
    }
    case 'SET_LOGIN':
      // Login is upstream of merchant — change wipes merchant selection.
      return { ...state, login: action.login, merchant: freshMerchant() }
    case 'SET_MERCHANT':
      return { ...state, merchant: action.merchant }
    case 'SET_SLOT': {
      // Replace mode forces pricing required (non-skippable).
      const pricing = action.slot.mode === 'replace' ? { ...state.pricing, skipped: false } : state.pricing
      return { ...state, slot: action.slot, pricing }
    }
    case 'SET_COST':
      return { ...state, cost: action.cost }
    case 'SET_PRICING':
      return { ...state, pricing: action.pricing }
    case 'SET_SETTLEMENT':
      return { ...state, settlement: action.settlement }
    case 'SET_REVENUE_SHARE':
      return { ...state, revenueShare: action.revenueShare }
    case 'SET_TERMINALS':
      return { ...state, terminals: action.terminals }
    case 'LOAD_DRAFT':
      return action.state
    case 'RESET':
      return initialState()
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PIN_RE = /^\d{6}$/
const MERCHANT_ID_RE = /^\d+$/

export function isCardValid(s: SetupState, card: RequiredCardKey): boolean {
  switch (card) {
    case 'venue':
      return !!s.venue.id
    case 'login':
      if (s.login.mode === 'empty') return false
      if (s.login.mode === 'existing') return !!s.login.angelpayUserAccountId
      return EMAIL_RE.test(s.login.email) && PIN_RE.test(s.login.pin)
    case 'merchant':
      if (s.merchant.mode === 'empty') return false
      if (s.merchant.mode === 'existing') return !!s.merchant.existingMerchantId
      return (
        MERCHANT_ID_RE.test(s.merchant.externalMerchantId) &&
        !!s.merchant.name.trim() &&
        !!s.merchant.affiliation.trim() &&
        !!s.merchant.displayName.trim() &&
        s.merchant.idConfirmed
      )
    case 'slot':
      if (s.slot.mode === 'empty') return false
      if (s.slot.mode === 'replace') return !!s.slot.replacedAccountId
      return true
    case 'cost':
      if (s.cost.skipped) return false  // cost is required, not skippable in panel
      return (
        s.cost.debitRate !== undefined &&
        s.cost.creditRate !== undefined &&
        s.cost.amexRate !== undefined &&
        s.cost.internationalRate !== undefined
      )
    case 'pricing':
      if (s.pricing.skipped) return false
      return (
        s.pricing.debitRate !== undefined &&
        s.pricing.creditRate !== undefined &&
        s.pricing.amexRate !== undefined &&
        s.pricing.internationalRate !== undefined
      )
    case 'settlement':
      if (s.settlement.skipped) return false
      return (
        s.settlement.daysDebit !== undefined &&
        s.settlement.daysCredit !== undefined &&
        s.settlement.daysAmex !== undefined &&
        s.settlement.daysInternational !== undefined
      )
  }
}

export function isRequiredComplete(state: SetupState): boolean {
  return REQUIRED_CARDS.every(k => isCardValid(state, k))
}
```

Note: `isCardValid('cost')` returns `false` if `skipped === true`. Per the spec, cost/pricing/settlement are required — the operator never gets a skip option. (The `skipped` flag exists in the state shape for symmetry with optional cards but the cost card UI will not show a skip checkbox. Defaulting `skipped: false` and never offering a UI to toggle keeps the contract enforced.)

- [ ] **Step 8: Run, expect PASS**

```bash
npx vitest run src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/__tests__/useSetupReducer.test.ts
```
Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/useSetupReducer.ts \
        src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/__tests__/useSetupReducer.test.ts
git commit -m "feat(setup-panel): reducer + validity selectors with TDD"
```

---

### Task 1.4: Implement `useDraftStorage.ts` (TDD)

**Files:**
- Create: `src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/useDraftStorage.ts`
- Create: `src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/__tests__/useDraftStorage.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// useDraftStorage.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveDraft, loadDraft, clearDraft, draftKey } from '../useDraftStorage'
import { initialState } from '../useSetupReducer'
import { DRAFT_SCHEMA_VERSION } from '../types'

describe('useDraftStorage · key', () => {
  it('builds a deterministic key from venueId + userAccountId', () => {
    expect(draftKey('v1', 'u1')).toBe('merchant-setup-draft:v1:u1')
    expect(draftKey('v1', null)).toBe('merchant-setup-draft:v1:new-login')
    expect(draftKey(null, null)).toBe('merchant-setup-draft:no-venue:new-login')
  })
})

describe('useDraftStorage · save/load round-trip', () => {
  beforeEach(() => localStorage.clear())

  it('saves and loads identical state', () => {
    const s = initialState()
    s.venue = { id: 'v1', name: 'V1', slug: 'v1' }
    saveDraft('v1', null, s)
    const loaded = loadDraft('v1', null)
    expect(loaded?.venue.id).toBe('v1')
  })

  it('returns null when no draft exists', () => {
    expect(loadDraft('v1', null)).toBeNull()
  })

  it('discards drafts with a different schemaVersion', () => {
    const s = { ...initialState(), schemaVersion: DRAFT_SCHEMA_VERSION + 99, venue: { id: 'v1', name: 'V1', slug: 'v1' } }
    localStorage.setItem(draftKey('v1', null), JSON.stringify(s))
    const loaded = loadDraft('v1', null)
    expect(loaded).toBeNull()
  })

  it('returns null on corrupt JSON without throwing', () => {
    localStorage.setItem(draftKey('v1', null), '{ not valid json')
    expect(() => loadDraft('v1', null)).not.toThrow()
    expect(loadDraft('v1', null)).toBeNull()
  })
})

describe('useDraftStorage · clear', () => {
  beforeEach(() => localStorage.clear())

  it('removes the entry', () => {
    saveDraft('v1', null, initialState())
    expect(loadDraft('v1', null)).not.toBeNull()
    clearDraft('v1', null)
    expect(loadDraft('v1', null)).toBeNull()
  })
})

describe('useDraftStorage · localStorage unavailable', () => {
  it('save / load / clear silently no-op if localStorage throws', () => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = vi.fn(() => {
      throw new Error('QuotaExceededError')
    })
    try {
      expect(() => saveDraft('v1', null, initialState())).not.toThrow()
      expect(loadDraft('v1', null)).toBeNull()
      expect(() => clearDraft('v1', null)).not.toThrow()
    } finally {
      Storage.prototype.setItem = original
    }
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npx vitest run src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/__tests__/useDraftStorage.test.ts
```
Expected: FAIL — Cannot find module.

- [ ] **Step 3: Implement `useDraftStorage.ts`**

```ts
import { useEffect, useRef } from 'react'
import type { SetupState } from './types'
import { DRAFT_SCHEMA_VERSION } from './types'

/** Storage key shape: `merchant-setup-draft:{venueId}:{userAccountId}`.
 *  Nulls become sentinels so we still have a stable key during create-from-zero.
 */
export function draftKey(venueId: string | null, userAccountId: string | null): string {
  return `merchant-setup-draft:${venueId ?? 'no-venue'}:${userAccountId ?? 'new-login'}`
}

export function saveDraft(venueId: string | null, userAccountId: string | null, state: SetupState): void {
  try {
    localStorage.setItem(draftKey(venueId, userAccountId), JSON.stringify(state))
  } catch {
    /* localStorage unavailable (private mode, quota) — silently no-op */
  }
}

export function loadDraft(venueId: string | null, userAccountId: string | null): SetupState | null {
  try {
    const raw = localStorage.getItem(draftKey(venueId, userAccountId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SetupState>
    if (parsed.schemaVersion !== DRAFT_SCHEMA_VERSION) return null
    return parsed as SetupState
  } catch {
    return null
  }
}

export function clearDraft(venueId: string | null, userAccountId: string | null): void {
  try {
    localStorage.removeItem(draftKey(venueId, userAccountId))
  } catch {
    /* no-op */
  }
}

/** Hook that auto-saves `state` to localStorage with a 500ms debounce.
 *  The caller is responsible for clearing the draft on successful activation. */
export function useDraftAutosave(
  venueId: string | null,
  userAccountId: string | null,
  state: SetupState,
  enabled: boolean,
): void {
  const timeoutRef = useRef<number | null>(null)
  useEffect(() => {
    if (!enabled) return
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => saveDraft(venueId, userAccountId, state), 500)
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    }
  }, [venueId, userAccountId, state, enabled])
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
npx vitest run src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/__tests__/useDraftStorage.test.ts
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/useDraftStorage.ts \
        src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/__tests__/useDraftStorage.test.ts
git commit -m "feat(setup-panel): localStorage draft hook + tests"
```

---

## Phase 2 · Panel shell + integration

### Task 2.1: Create `MerchantSetupPanel.tsx` skeleton

**Files:**
- Create: `src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/MerchantSetupPanel.tsx`

This task creates the FullScreenModal shell with header (title + progress + Activar button) and the empty card grid. Cards are added in Phase 3.

- [ ] **Step 1: Write the file**

```tsx
import { useMemo, useReducer, useState } from 'react'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { initialState, setupReducer, isCardValid, isRequiredComplete } from './useSetupReducer'
import { useDraftAutosave, loadDraft, clearDraft } from './useDraftStorage'
import { REQUIRED_CARDS } from './types'
import type { SetupState } from './types'

interface MerchantSetupPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `create` mode (no merchantId) opens an empty panel + checks draft.
   *  `edit` mode loads everything from DB and saves per card. */
  mode: 'create' | 'edit'
  /** Required when mode='edit'. */
  merchantAccountId?: string
}

/**
 * Object-centric panel for AngelPay merchant configuration. Replaces the
 * linear AngelPayWizard. See spec:
 * docs/superpowers/specs/2026-05-23-merchant-setup-panel-design.md
 *
 * In create mode the reducer holds local state, debounced to localStorage.
 * On "Activar merchant" the state is assembled and POSTed to the existing
 * fullSetupAngelPayMerchant endpoint. In edit mode, each card hits its own
 * CRUD endpoint and the panel acts as a dashboard.
 */
export default function MerchantSetupPanel({
  open,
  onOpenChange,
  mode,
  merchantAccountId,
}: MerchantSetupPanelProps) {
  const { toast } = useToast()
  const [state, dispatch] = useReducer(setupReducer, undefined, initialState)
  const [showDraftBanner, setShowDraftBanner] = useState(false)

  // Resolve the user account id (only known once login card has chosen one)
  const userAccountId = state.login.mode === 'existing' ? state.login.angelpayUserAccountId : null

  // Draft autosave + recovery — only in create mode
  useDraftAutosave(state.venue.id, userAccountId, state, mode === 'create')

  // Progress for the header
  const progress = useMemo(() => {
    const completed = REQUIRED_CARDS.filter(k => isCardValid(state, k)).length
    return { completed, total: REQUIRED_CARDS.length, ready: isRequiredComplete(state) }
  }, [state])

  const handleActivate = async () => {
    // Real implementation in Task 2.3 (assembleAndPost). Stub for now.
    toast({ title: 'TODO: wire up activate', description: 'Phase 2.3' })
  }

  return (
    <FullScreenModal
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'create' ? 'Nuevo merchant AngelPay' : 'Configuración del merchant'}
      contentClassName="bg-muted/30"
      actions={
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {progress.completed} de {progress.total} obligatorios ✓
          </p>
          {mode === 'create' && (
            <Button onClick={handleActivate} disabled={!progress.ready} data-tour="setup-panel-activate">
              Activar merchant
            </Button>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
        {/* Cards rendered in Phase 3. Placeholder so the file compiles. */}
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <p className="text-sm text-muted-foreground">Cards aparecerán aquí (Phase 3).</p>
        </div>
      </div>

      {showDraftBanner && (
        <div className="fixed bottom-6 left-6 right-6 max-w-md mx-auto p-4 rounded-lg border border-input bg-muted/40">
          <p className="text-sm">Tienes un borrador guardado. ¿Continuar o descartar?</p>
        </div>
      )}
    </FullScreenModal>
  )
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/MerchantSetupPanel.tsx
git commit -m "feat(setup-panel): shell with FullScreenModal + progress header"
```

---

### Task 2.2: Wire the new panel into `MerchantAccounts.tsx`

**Files:**
- Modify: `src/pages/Superadmin/MerchantAccounts.tsx`

Replace the `<AngelPayWizard>` instance with `<MerchantSetupPanel mode="create">`. The Blumon buttons are untouched.

- [ ] **Step 1: Update the import**

In `MerchantAccounts.tsx`, find:
```tsx
import AngelPayWizard from './components/merchant-accounts/angelpay-wizard/AngelPayWizard'
```
Replace with:
```tsx
import MerchantSetupPanel from './components/merchant-accounts/merchant-setup-panel/MerchantSetupPanel'
```

- [ ] **Step 2: Rename state**

Find:
```tsx
const [angelPayWizardOpen, setAngelPayWizardOpen] = useState(false)
```
Replace with:
```tsx
const [setupPanelOpen, setSetupPanelOpen] = useState(false)
```

- [ ] **Step 3: Update the button onClick**

Find:
```tsx
onClick={() => setAngelPayWizardOpen(true)}
```
Replace with:
```tsx
onClick={() => setSetupPanelOpen(true)}
```

- [ ] **Step 4: Replace the rendered element**

Find:
```tsx
<AngelPayWizard open={angelPayWizardOpen} onOpenChange={setAngelPayWizardOpen} />
```
Replace with:
```tsx
<MerchantSetupPanel
  open={setupPanelOpen}
  onOpenChange={setSetupPanelOpen}
  mode="create"
/>
```

- [ ] **Step 5: Compile + lint**

```bash
npx tsc --noEmit
npm run lint -- src/pages/Superadmin/MerchantAccounts.tsx 2>&1 | tail -3
```
Expected: zero errors.

- [ ] **Step 6: Smoke-test by running the dev server**

```bash
npm run dev
```
In browser: go to `http://localhost:5173/superadmin/merchant-accounts`, log in, click **+ Agregar AngelPay**. Expect: the FullScreenModal opens with title "Nuevo merchant AngelPay", progress "0 de 7 obligatorios ✓", an Activar button (disabled), and the placeholder card. **Verify the Blumon buttons still exist and are still clickable** (they should open the existing Blumon flow — no functional change there).

Stop the dev server with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Superadmin/MerchantAccounts.tsx
git commit -m "feat(setup-panel): wire panel as replacement for AngelPay wizard"
```

---

### Task 2.3: Implement the `assembleAndPost` mutation

**Files:**
- Modify: `src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/MerchantSetupPanel.tsx`
- Create: `src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/assemblePayload.ts`
- Create: `src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/__tests__/assemblePayload.test.ts`

`assemblePayload` is pure — it maps `SetupState` to the existing `FullSetupAngelPayPayload` shape. Easy to test.

- [ ] **Step 1: Write failing tests**

```ts
// assemblePayload.test.ts
import { describe, it, expect } from 'vitest'
import { assemblePayload } from '../assemblePayload'
import { initialState } from '../useSetupReducer'

describe('assemblePayload', () => {
  it('directo (no aggregator) shape — happy path', () => {
    let s = initialState()
    s.venue = { id: 'v1', name: 'V1', slug: 'v1' }
    s.login = { mode: 'new', email: 'a@b.com', pin: '123456', environment: 'QA' }
    s.merchant = {
      mode: 'create',
      externalMerchantId: '9814275',
      name: 'X',
      affiliation: 'A',
      displayName: 'X',
      idConfirmed: true,
    }
    s.slot = { accountType: 'PRIMARY', mode: 'fill' }
    s.cost = { ...s.cost, debitRate: 0.015, creditRate: 0.02, amexRate: 0.035, internationalRate: 0.038, effectiveFrom: '2026-05-23' }
    s.pricing = { ...s.pricing, debitRate: 0.03, creditRate: 0.04, amexRate: 0.05, internationalRate: 0.06, effectiveFrom: '2026-05-23' }
    const payload = assemblePayload(s)
    expect(payload.venueId).toBe('v1')
    expect(payload.login).toEqual({ mode: 'new', email: 'a@b.com', pin: '123456', environment: 'QA' })
    expect(payload.merchant.mode).toBe('create')
    expect(payload.cost?.debitRate).toBe(0.015)
    expect(payload.settlement?.settlementDaysByCard).toEqual({ DEBIT: 1, CREDIT: 1, AMEX: 3, INTERNATIONAL: 3 })
    expect(payload.idempotencyKey).toBe(s.idempotencyKey)
  })

  it('skipped cards yield undefined in payload', () => {
    let s = initialState()
    s.venue = { id: 'v1', name: 'V1', slug: 'v1' }
    s.terminals.skipped = true
    const payload = assemblePayload(s)
    expect(payload.terminalIds).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npx vitest run src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/__tests__/assemblePayload.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement `assemblePayload.ts`**

```ts
import type { SetupState } from './types'
import type { FullSetupAngelPayPayload } from '@/services/paymentProvider.service'

/**
 * Pure mapper: SetupState → endpoint payload. Skipped/empty cards yield
 * `undefined` in the payload so the backend treats them as omitted. Settlement
 * always populates settlementDaysByCard (the per-card-type field added during
 * the wizard fixes).
 */
export function assemblePayload(s: SetupState): FullSetupAngelPayPayload {
  if (!s.venue.id) throw new Error('assemblePayload: venue.id required')

  const iso = (d: string) => (d ? new Date(`${d}T00:00:00`).toISOString() : new Date().toISOString())

  return {
    idempotencyKey: s.idempotencyKey,
    venueId: s.venue.id,
    aggregatorId: s.cost.skipped ? undefined : s.cost.aggregatorId,
    login:
      s.login.mode === 'existing'
        ? { mode: 'existing', angelpayUserAccountId: s.login.angelpayUserAccountId }
        : s.login.mode === 'new'
          ? { mode: 'new', email: s.login.email, pin: s.login.pin, environment: s.login.environment }
          : (() => {
              throw new Error('assemblePayload: login is empty')
            })(),
    merchant:
      s.merchant.mode === 'existing'
        ? { mode: 'existing', merchantAccountId: s.merchant.existingMerchantId ?? '' }
        : s.merchant.mode === 'create'
          ? {
              mode: 'create',
              externalMerchantId: s.merchant.externalMerchantId,
              name: s.merchant.name,
              affiliation: s.merchant.affiliation,
              displayName: s.merchant.displayName,
            }
          : (() => {
              throw new Error('assemblePayload: merchant is empty')
            })(),
    slot: s.slot,
    terminalIds: s.terminals.skipped || s.terminals.terminalIds.length === 0 ? undefined : s.terminals.terminalIds,
    cost: s.cost.skipped
      ? undefined
      : {
          debitRate: s.cost.debitRate ?? 0,
          creditRate: s.cost.creditRate ?? 0,
          amexRate: s.cost.amexRate ?? 0,
          internationalRate: s.cost.internationalRate ?? 0,
          includesTax: s.cost.includesTax,
          taxRate: s.cost.taxRate,
          fixedCostPerTransaction: s.cost.fixedCostPerTransaction,
          monthlyFee: s.cost.monthlyFee,
          effectiveFrom: iso(s.cost.effectiveFrom),
        },
    pricing: s.pricing.skipped
      ? undefined
      : {
          debitRate: s.pricing.debitRate ?? 0,
          creditRate: s.pricing.creditRate ?? 0,
          amexRate: s.pricing.amexRate ?? 0,
          internationalRate: s.pricing.internationalRate ?? 0,
          includesTax: s.pricing.includesTax,
          taxRate: s.pricing.taxRate,
          fixedFeePerTransaction: s.pricing.fixedFeePerTransaction,
          monthlyServiceFee: s.pricing.monthlyServiceFee,
          effectiveFrom: iso(s.pricing.effectiveFrom),
        },
    settlement: s.settlement.skipped
      ? undefined
      : {
          // Scalar legacy required by backend — use daysDebit as the canonical scalar.
          settlementDays: s.settlement.daysDebit ?? 1,
          settlementDaysByCard: {
            DEBIT: s.settlement.daysDebit,
            CREDIT: s.settlement.daysCredit,
            AMEX: s.settlement.daysAmex,
            INTERNATIONAL: s.settlement.daysInternational,
          },
          settlementDayType: s.settlement.dayType,
          cutoffTime: s.settlement.cutoffTime || '23:00',
          cutoffTimezone: s.settlement.cutoffTimezone || 'America/Mexico_City',
          effectiveFrom: iso(s.settlement.effectiveFrom),
        },
  }
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
npx vitest run src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/__tests__/assemblePayload.test.ts
```
Expected: all tests pass.

- [ ] **Step 5: Wire `handleActivate` in `MerchantSetupPanel.tsx`**

Replace the stub `handleActivate` (added in Task 2.1) with the real mutation:

```tsx
// near other imports at the top
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { paymentProviderAPI } from '@/services/paymentProvider.service'
import { merchantRevenueShareAPI } from '@/services/merchantRevenueShare.service'
import { assemblePayload } from './assemblePayload'

// inside the component (replace the stub):
const queryClient = useQueryClient()

const activateMutation = useMutation({
  mutationFn: () => paymentProviderAPI.fullSetupAngelPayMerchant(assemblePayload(state)),
  onSuccess: async (result) => {
    queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })

    // Follow-up: revenue share (non-atomic, non-blocking)
    if (!state.revenueShare.skipped) {
      try {
        await merchantRevenueShareAPI.create({
          merchantAccountId: result.merchantAccountId,
          aggregatorPrice: state.revenueShare.useAggregator
            ? {
                DEBIT: state.revenueShare.aggregatorDebitRate ?? 0,
                CREDIT: state.revenueShare.aggregatorCreditRate ?? 0,
                AMEX: state.revenueShare.aggregatorAmexRate ?? 0,
                INTERNATIONAL: state.revenueShare.aggregatorInternationalRate ?? 0,
              }
            : null,
          aggregatorPriceIncludesTax: state.revenueShare.aggregatorPriceIncludesTax,
          avoqadoShareOfProviderMargin: state.revenueShare.avoqadoShareOfProviderMargin,
          avoqadoShareOfAggregatorMargin: state.revenueShare.useAggregator
            ? state.revenueShare.avoqadoShareOfAggregatorMargin ?? 0.5
            : null,
          taxRate: state.revenueShare.taxRate,
        })
        toast({ title: 'Éxito', description: 'Merchant activado y reparto guardado' })
      } catch (rsErr: any) {
        toast({
          title: 'Merchant activado · reparto pendiente',
          description: rsErr?.response?.data?.message || 'El reparto no se guardó. Configúralo en /superadmin/aggregators.',
          variant: 'destructive',
        })
      }
    } else {
      toast({ title: 'Éxito', description: 'Merchant activado' })
    }

    // Clear draft + close
    clearDraft(state.venue.id, userAccountId)
    onOpenChange(false)
  },
  onError: (err: any) => {
    toast({
      title: 'No pudimos activar el merchant',
      description: err?.response?.data?.message || 'Error en el servidor. Reintenta.',
      variant: 'destructive',
    })
  },
})

const handleActivate = () => activateMutation.mutate()
```

Also update the Activar button to show a loader during the mutation:

```tsx
<Button onClick={handleActivate} disabled={!progress.ready || activateMutation.isPending} data-tour="setup-panel-activate">
  {activateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
  Activar merchant
</Button>
```

- [ ] **Step 6: Compile check**

```bash
npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/assemblePayload.ts \
        src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/__tests__/assemblePayload.test.ts \
        src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/MerchantSetupPanel.tsx
git commit -m "feat(setup-panel): assemblePayload + activate mutation"
```

---

## Phase 3 · Individual cards

Each card follows the same recipe:

1. Create `cards/XCard.tsx` — a button-like card showing status + opening a dialog/modal.
2. The dialog/modal holds the form for that piece.
3. On save, the modal closes and the reducer is updated via `dispatch`.
4. Test the card's status display and the dialog's form validation.

We do one task per card to keep commits small.

> **Convention:** every card receives `state: SetupState`, `dispatch: (action: SetupAction) => void`, and a `mode: 'create' | 'edit'` prop (some cards render differently in edit mode).

### Task 3.1: VenueCard

**Files:**
- Create: `src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/cards/VenueCard.tsx`

- [ ] **Step 1: Write the card**

```tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, CheckCircle2, Search } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { getAllVenues } from '@/services/superadmin.service'
import { cn, includesNormalized } from '@/lib/utils'
import type { SetupState } from '../types'
import type { SetupAction } from '../useSetupReducer'

interface VenueCardProps {
  state: SetupState
  dispatch: (action: SetupAction) => void
  mode: 'create' | 'edit'
}

export default function VenueCard({ state, dispatch, mode }: VenueCardProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const { data: venues = [], isLoading } = useQuery({
    queryKey: ['venues-for-setup'],
    queryFn: () => getAllVenues(),
    enabled: open && mode === 'create',
  })

  const filtered = venues.filter(v =>
    includesNormalized(v.name ?? '', search) || includesNormalized(v.slug ?? '', search),
  )

  const isValid = !!state.venue.id

  return (
    <>
      <button
        type="button"
        onClick={() => mode === 'create' && setOpen(true)}
        disabled={mode === 'edit'}
        className={cn(
          'text-left rounded-2xl border p-5 transition-colors',
          isValid ? 'border-input bg-card' : 'border-dashed border-input bg-muted/20',
          mode === 'create' && 'hover:bg-muted/30 cursor-pointer',
        )}
        data-tour="setup-panel-card-venue"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Venue</h3>
          </div>
          {isValid ? (
            <Badge variant="default" className="text-[10px] bg-green-600 hover:bg-green-600">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Listo
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">Pendiente</Badge>
          )}
        </div>
        <p className="mt-2 text-sm text-foreground">
          {state.venue.name ?? <span className="text-muted-foreground">Selecciona el venue</span>}
        </p>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Selecciona el venue</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre o slug..."
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="max-h-[400px] overflow-y-auto space-y-1">
              {isLoading ? (
                <p className="text-xs text-muted-foreground p-2">Cargando...</p>
              ) : filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">Sin resultados.</p>
              ) : (
                filtered.map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      dispatch({ type: 'SET_VENUE', venue: { id: v.id, name: v.name, slug: v.slug } })
                      setOpen(false)
                    }}
                    className={cn(
                      'w-full text-left rounded-lg border border-input p-3 hover:bg-muted/30 transition-colors',
                      state.venue.id === v.id && 'border-foreground bg-muted/40',
                    )}
                  >
                    <p className="text-sm font-medium">{v.name}</p>
                    <p className="text-xs text-muted-foreground">{v.slug}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 2: Render the card in `MerchantSetupPanel.tsx`**

Replace the placeholder div inside the grid:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
  <VenueCard state={state} dispatch={dispatch} mode={mode} />
  {/* more cards added in subsequent tasks */}
</div>
```

And add the import:
```tsx
import VenueCard from './cards/VenueCard'
```

- [ ] **Step 3: Compile + smoke**

```bash
npx tsc --noEmit
npm run dev
```

In browser: open the panel → click the Venue card → search dialog opens → click a venue → card flips to "Listo" with venue name, progress shows "1 de 7".

- [ ] **Step 4: Commit**

```bash
git add src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/cards/VenueCard.tsx \
        src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/MerchantSetupPanel.tsx
git commit -m "feat(setup-panel): VenueCard"
```

---

### Task 3.2: AngelPayLoginCard

**Files:**
- Create: `src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/cards/AngelPayLoginCard.tsx`

This card mirrors the existing logic in `AngelPayWizard.tsx` lines ~600-696 for picking an existing AngelPay user account or creating a new one. The reusable bits:
- Query existing accounts for the venue via `listAngelPayUserAccountsForVenue`.
- "Conectar una cuenta nueva" expands inline form (email + 6-digit PIN + environment).
- Show the operational warning banner when creating a new account on a venue that already has accounts (the heads-up about TPV re-login).

- [ ] **Step 1: Create the card**

```tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Info, Wallet } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  listAngelPayUserAccountsForVenue,
  type AngelPayUserAccount,
} from '@/services/superadmin-angelpay-user-account.service'
import { cn } from '@/lib/utils'
import type { SetupState } from '../types'
import type { SetupAction } from '../useSetupReducer'

interface Props {
  state: SetupState
  dispatch: (action: SetupAction) => void
  mode: 'create' | 'edit'
}

export default function AngelPayLoginCard({ state, dispatch, mode }: Props) {
  const [open, setOpen] = useState(false)
  const venueId = state.venue.id

  const { data: existing = [] } = useQuery({
    queryKey: ['angelpay-logins', venueId],
    queryFn: () => listAngelPayUserAccountsForVenue(venueId!),
    enabled: !!venueId && open,
  })

  const activeOnly = existing.filter(a => a.status !== 'DELETED' && a.status !== 'SUSPENDED')

  const isValid =
    state.login.mode === 'existing'
      ? !!state.login.angelpayUserAccountId
      : state.login.mode === 'new'
        ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.login.email) && /^\d{6}$/.test(state.login.pin)
        : false

  const summary =
    state.login.mode === 'empty'
      ? null
      : state.login.mode === 'existing'
        ? activeOnly.find(a => a.id === state.login.angelpayUserAccountId)?.email
        : state.login.email

  return (
    <>
      <button
        type="button"
        onClick={() => mode === 'create' && setOpen(true)}
        disabled={!venueId || mode === 'edit'}
        className={cn(
          'text-left rounded-2xl border p-5 transition-colors',
          isValid ? 'border-input bg-card' : 'border-dashed border-input bg-muted/20',
          mode === 'create' && venueId && 'hover:bg-muted/30 cursor-pointer',
          !venueId && 'opacity-60 cursor-not-allowed',
        )}
        data-tour="setup-panel-card-login"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Cuenta AngelPay</h3>
          </div>
          {isValid ? (
            <Badge className="text-[10px] bg-green-600 hover:bg-green-600">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Listo
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">{venueId ? 'Pendiente' : 'Selecciona venue primero'}</Badge>
          )}
        </div>
        <p className="mt-2 text-sm text-foreground">
          {summary || <span className="text-muted-foreground">Login del adquirente</span>}
        </p>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Cuenta AngelPay</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {activeOnly.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Cuentas existentes en este venue</Label>
                {activeOnly.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      dispatch({ type: 'SET_LOGIN', login: { mode: 'existing', angelpayUserAccountId: a.id } })
                      setOpen(false)
                    }}
                    className={cn(
                      'w-full flex items-center justify-between rounded-lg border border-input px-3 py-2 hover:bg-muted/30 transition-colors text-left',
                      state.login.mode === 'existing' && state.login.angelpayUserAccountId === a.id && 'border-foreground bg-muted/40',
                    )}
                  >
                    <span className="text-sm truncate">{a.email}</span>
                    <Badge variant="outline" className="text-[10px]">{a.environment}</Badge>
                  </button>
                ))}
              </div>
            )}

            <NewLoginInline state={state} dispatch={dispatch} hasExisting={activeOnly.length > 0} onCancel={() => setOpen(false)} onSaved={() => setOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function NewLoginInline({
  state,
  dispatch,
  hasExisting,
  onCancel,
  onSaved,
}: {
  state: SetupState
  dispatch: (action: SetupAction) => void
  hasExisting: boolean
  onCancel: () => void
  onSaved: () => void
}) {
  const newLogin = state.login.mode === 'new' ? state.login : { mode: 'new' as const, email: '', pin: '', environment: 'QA' as const }
  const patch = (p: Partial<typeof newLogin>) =>
    dispatch({ type: 'SET_LOGIN', login: { ...newLogin, ...p, mode: 'new' } })

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newLogin.email) && /^\d{6}$/.test(newLogin.pin)

  return (
    <div className="space-y-3 rounded-lg border border-input p-3">
      <Label className="text-xs">+ Conectar una cuenta nueva</Label>
      {hasExisting && (
        <p className="flex items-start gap-1.5 rounded border border-blue-500/40 bg-blue-500/10 px-2 py-1.5 text-[11px] text-blue-700 dark:text-blue-400">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Este venue ya tiene cuentas AngelPay. Si usas TPV en el siguiente paso, el TPV debe re-loguearse con esta cuenta nueva primero. Recomendable: 1 cuenta a la vez.
          </span>
        </p>
      )}
      <div className="space-y-2">
        <Label className="text-xs">Correo</Label>
        <Input value={newLogin.email} onChange={e => patch({ email: e.target.value })} placeholder="correo@ejemplo.com" className="h-10" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs">PIN (6 dígitos)</Label>
          <Input value={newLogin.pin} onChange={e => patch({ pin: e.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="123456" className="h-10" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Ambiente</Label>
          <Select value={newLogin.environment} onValueChange={v => patch({ environment: v as 'QA' | 'PROD' })}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="QA">QA</SelectItem>
              <SelectItem value="PROD">PROD</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="text-xs text-muted-foreground hover:underline">Cancelar</button>
        <button type="button" onClick={onSaved} disabled={!valid} className="text-xs font-medium bg-foreground text-background rounded-md px-3 py-1 disabled:opacity-50">
          Usar esta cuenta
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Render it in the panel grid + import**

In `MerchantSetupPanel.tsx`, import and render:
```tsx
import AngelPayLoginCard from './cards/AngelPayLoginCard'
// ...
<VenueCard state={state} dispatch={dispatch} mode={mode} />
<AngelPayLoginCard state={state} dispatch={dispatch} mode={mode} />
```

- [ ] **Step 3: Compile + smoke**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/cards/AngelPayLoginCard.tsx \
        src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/MerchantSetupPanel.tsx
git commit -m "feat(setup-panel): AngelPayLoginCard"
```

---

### Task 3.3: MerchantCard

**Files:**
- Create: `src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/cards/MerchantCard.tsx`

Port the merchant-step logic from `AngelPayWizard.tsx` lines ~706-820 — external merchant id, affiliation, name, displayName, idConfirmed checkbox, optional TPV discovery banner.

- [ ] **Step 1: Create the card (full code)**

The structure follows VenueCard: trigger button + Dialog content. Inside the dialog, two modes — pick from discovered list (when existing AngelPay login + NEXGO terminal available) or capture manually. Include the explanatory banner clarifying that this is where the MerchantAccount is created.

For brevity in the plan we summarize: copy the merchant-step JSX from `AngelPayWizard.tsx` (case `'merchant':` block), adapt the `dispatch` call shape from `SET_MERCHANT { merchant: ... }` to use the new `MerchantSlice` shape, and replace any `state.merchant.*` references with the equivalent fields. The auto-discovery via `fetchAngelPayMerchantsFromTpv` is preserved verbatim.

- [ ] **Step 2: Render in the panel**

```tsx
import MerchantCard from './cards/MerchantCard'
// ...
<MerchantCard state={state} dispatch={dispatch} mode={mode} />
```

- [ ] **Step 3: Compile + smoke**

- [ ] **Step 4: Commit**

```bash
git add src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/cards/MerchantCard.tsx \
        src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/MerchantSetupPanel.tsx
git commit -m "feat(setup-panel): MerchantCard"
```

---

### Task 3.4: SlotCard

**Files:**
- Create: `src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/cards/SlotCard.tsx`

Port from `AngelPayWizard.tsx` case `'slot':`. **Includes the same slot-validation fix we shipped earlier** — `mode='fill'` requires the slot to be empty; `mode='replace'` requires `replacedAccountId`. The card reads the venue's current `VenuePaymentConfig` via the existing `getVenuePaymentConfig` service.

- [ ] **Step 1-3**: same recipe (port → render → compile)

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(setup-panel): SlotCard with conflict validation"
```

---

### Task 3.5: CostCard

**Files:**
- Create: `src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/cards/CostCard.tsx`

The card is a thin wrapper around the existing `CostStructureDialog` component (reused unchanged). In `mode='create'` it stores the form result in the reducer; in `mode='edit'` it persists via the existing CRUD endpoint.

The aggregator picker inside this card (dropdown of available aggregators + inline "+ Crear agregador") is identical to the wizard's behavior — port that block over.

- [ ] **Step 1: Create CostCard.tsx**

The card opens a `Dialog` (not the FullScreenModal — we're inside one already) containing the existing CostStructureDialog form. The save handler dispatches `SET_COST` instead of calling the API directly when in create mode.

- [ ] **Step 2-4**: render → compile → commit

```bash
git commit -m "feat(setup-panel): CostCard with aggregator picker"
```

---

### Task 3.6: PricingCard

Same pattern as CostCard but for `VenuePricingStructure`. Wraps the existing `VenuePricingStructureDialog`.

- [ ] Standard 4-step pattern + commit:

```bash
git commit -m "feat(setup-panel): PricingCard"
```

---

### Task 3.7: SettlementCard

The per-card-type settlement input (4 inputs + "Aplicar a todos") that we already built during the wizard fixes. Lift that JSX from `AngelPayWizard.tsx` settlement step into a dedicated card.

Default values when opening the dialog: `daysDebit: 1, daysCredit: 1, daysAmex: 3, daysInternational: 3`, `dayType: 'BUSINESS_DAYS'`, `cutoffTime: '23:00'`, `cutoffTimezone: 'America/Mexico_City'`.

- [ ] Standard 4-step + commit:

```bash
git commit -m "feat(setup-panel): SettlementCard (per-card-type T+N)"
```

---

### Task 3.8: RevenueShareCard

Wrap the existing `RevenueShareEditDialog` we built earlier. In `mode='create'`, the card collects the data into the reducer; on activate the panel POSTs follow-up. In `mode='edit'`, the existing dialog already handles CRUD via the API.

- [ ] Standard 4-step + commit:

```bash
git commit -m "feat(setup-panel): RevenueShareCard"
```

---

### Task 3.9: TerminalsCard

Lets the operator pick zero-or-more existing terminals to associate with this merchant. Use the existing `getAllTerminals` service filtered by venue + `attachedMerchantAccountId === null`. Include a button to launch `AngelPayCreateTerminalDialog` to create a NEXGO terminal inline.

- [ ] Standard 4-step + commit:

```bash
git commit -m "feat(setup-panel): TerminalsCard"
```

---

## Phase 4 · Edit mode hydration

### Task 4.1: Hydrate panel from server in `mode='edit'`

**Files:**
- Modify: `src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/MerchantSetupPanel.tsx`
- Create: `src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/useMerchantBundle.ts`
- Create: `src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/__tests__/useMerchantBundle.test.ts`

`useMerchantBundle` is a hook that dispatches six TanStack queries in parallel (merchant, AngelPay account, cost structures, pricing structures, settlement configurations, revenue share) and returns a single normalized object the panel uses to dispatch `LOAD_DRAFT` on success.

- [ ] **Step 1: Define the hook signature with TDD**

Write the test first (test that given mocked data, the resulting `SetupState` has the right shape). The hook itself is mostly query orchestration — keep the test focused on the mapping pure function (`bundleToSetupState`) that converts the 6 server responses into a `SetupState`.

- [ ] **Step 2: Implement `bundleToSetupState` (pure)**, then `useMerchantBundle` (TanStack queries calling it).

- [ ] **Step 3: In `MerchantSetupPanel`, when `mode === 'edit'`, render skeletons while loading, then dispatch `LOAD_DRAFT` on data arrival**

```tsx
const { data: bundle, isLoading } = useMerchantBundle(merchantAccountId, mode === 'edit')
useEffect(() => {
  if (bundle) dispatch({ type: 'LOAD_DRAFT', state: bundleToSetupState(bundle) })
}, [bundle])
```

Also disable the Activar button in edit mode (only shown in create) and show per-card "Guardar cambios" save spinners as cards mutate.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(setup-panel): edit mode — hydrate from server, per-card saves"
```

---

### Task 4.2: Wire per-card save in edit mode

Each card already has a save handler that in `create` mode dispatches to the reducer. In `edit` mode the handler instead calls the corresponding API endpoint via TanStack mutation and on success invalidates the relevant query.

We modify each card to take an optional `merchantAccountId` and switch its save behavior:

- `CostCard` → in edit, `PUT /provider-cost-structures/:id` via `upsertProviderCostStructure` for each card type, then invalidate.
- `PricingCard` → analogous via `upsertVenuePricingStructure`.
- `SettlementCard` → `PUT /settlement-configurations/:id` for each of the 4 rows.
- `RevenueShareCard` → already uses its own API via the existing dialog — minimal change.
- `SlotCard` → `PUT /venues/:venueId/payment-config` to update slot binding.

- [ ] **Step 1-N**: one task per card, each with its own commit. Keep tasks small.

```bash
git commit -m "feat(setup-panel): edit-mode save for CostCard"
git commit -m "feat(setup-panel): edit-mode save for PricingCard"
git commit -m "feat(setup-panel): edit-mode save for SettlementCard"
git commit -m "feat(setup-panel): edit-mode save for SlotCard"
```

---

### Task 4.3: Wire the merchant-card click in `MerchantAccounts.tsx` to open edit mode

**Files:**
- Modify: `src/pages/Superadmin/MerchantAccounts.tsx`

When a merchant card is clicked in the list view, open the panel in edit mode for that merchant.

- [ ] **Step 1: Add state for selected merchant**

```tsx
const [editingMerchantId, setEditingMerchantId] = useState<string | null>(null)
```

- [ ] **Step 2: Pass an `onClick` handler to `MerchantAccountCard` that sets `editingMerchantId`**

(Verify the existing card supports `onClick` — if not, extend its props with `onCardClick?: () => void`.)

- [ ] **Step 3: Render edit panel as a separate instance**

```tsx
<MerchantSetupPanel
  open={!!editingMerchantId}
  onOpenChange={(o) => !o && setEditingMerchantId(null)}
  mode="edit"
  merchantAccountId={editingMerchantId ?? undefined}
/>
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(setup-panel): wire merchant-card click to open edit panel"
```

---

## Phase 5 · Tests and migration

### Task 5.1: Draft recovery banner integration test

**Files:**
- Create: `src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/__tests__/draftRecovery.test.tsx`

- [ ] **Step 1: Write the test** — mount panel with localStorage pre-populated with a draft → banner appears → click "Continuar" → state hydrated.

- [ ] **Step 2: Run → fail (banner not implemented yet) → implement banner in MerchantSetupPanel → run → pass.**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(setup-panel): draft recovery banner + test"
```

---

### Task 5.2: E2E happy path

**Files:**
- Create: `e2e/tests/superadmin/merchant-setup-panel.spec.ts`

- [ ] **Step 1: Write the E2E**

```ts
import { test, expect } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'

test('happy path: agregar AngelPay completo', async ({ page }) => {
  await setupApiMocks(page, { userRole: 'SUPERADMIN' })
  await page.goto('/superadmin/merchant-accounts')
  await page.getByRole('button', { name: 'Agregar AngelPay' }).click()
  // venue
  await page.locator('[data-tour="setup-panel-card-venue"]').click()
  await page.getByText('Doña Simona').click()
  // login (existing or new)
  await page.locator('[data-tour="setup-panel-card-login"]').click()
  // ... fill rest ...
  // activate
  await page.locator('[data-tour="setup-panel-activate"]').click()
  await expect(page.getByText('Merchant activado')).toBeVisible()
})
```

- [ ] **Step 2: Run, assert pass.**

- [ ] **Step 3: Commit**

```bash
git commit -m "test(e2e): happy path for merchant setup panel"
```

---

### Task 5.3: E2E error recovery

- [ ] **Step 1: Mock 409 on the `full-setup-angelpay` endpoint, verify the toast and the slot card highlight.**

- [ ] **Step 2: Commit**

```bash
git commit -m "test(e2e): 409 conflict recovery"
```

---

### Task 5.4: Blumon regression E2E (BLOCKING gate)

**Files:**
- Create: `e2e/tests/superadmin/blumon-flow-regression.spec.ts`

- [ ] **Step 1: Click "+ Add Account" (Blumon), verify the Blumon dialog opens. Click "Blumon Auto-Fetch", verify the wizard opens. Both flows untouched.**

- [ ] **Step 2: Commit**

```bash
git commit -m "test(e2e): blumon flow regression (must remain green)"
```

---

### Task 5.5: Reports regression curl checks

- [ ] **Step 1: Document expected values from production** (run `SELECT` against prod read-only) for available-balance and sales-summary of Doña Simona, baseline.

- [ ] **Step 2: After implementation, repeat the queries → values must match.**

- [ ] **Step 3: Add note to the plan doc.**

---

### Task 5.6: Delete the old AngelPay wizard

**Files:**
- Delete: `src/pages/Superadmin/components/merchant-accounts/angelpay-wizard/AngelPayWizard.tsx`
- Delete: `src/pages/Superadmin/components/merchant-accounts/angelpay-wizard/wizardReducer.ts`
- Delete: `src/pages/Superadmin/components/merchant-accounts/angelpay-wizard/feeTemplate.ts`
- Move: `src/pages/Superadmin/components/merchant-accounts/angelpay-wizard/AngelPayAccountDetailsDialog.tsx` → `src/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/AngelPayAccountDetailsDialog.tsx`
- Delete: `src/pages/Superadmin/components/merchant-accounts/angelpay-wizard/__tests__/` (the per-wizard tests; reducer + fee tests now live in setup-panel + utils respectively)

- [ ] **Step 1: Confirm zero imports remain from the angelpay-wizard directory**

```bash
grep -rn "angelpay-wizard" src/ --include="*.ts" --include="*.tsx"
```
Expected: zero results (except the files inside that directory itself).

- [ ] **Step 2: Delete the directory**

```bash
rm -rf src/pages/Superadmin/components/merchant-accounts/angelpay-wizard
git add -A
```

- [ ] **Step 3: Compile + lint + full test pass**

```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
```
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor: remove legacy AngelPayWizard (replaced by MerchantSetupPanel)"
```

---

## Phase 6 · Pre-deploy verification + handoff

### Task 6.1: Run the full pre-deploy checklist

- [ ] `npm run build` → exit 0
- [ ] `npm run lint` → 0 errors
- [ ] `npx vitest run` → all green (target: ≥ 30 new tests)
- [ ] `npx playwright test e2e/tests/superadmin/merchant-setup-panel.spec.ts` → green
- [ ] `npx playwright test e2e/tests/superadmin/blumon-flow-regression.spec.ts` → **green (blocking)**
- [ ] Manual smoke: full AngelPay setup with real venue (Avoqado Full) in local
- [ ] Manual smoke: edit an existing merchant from list (rate change), confirm PUT 200
- [ ] Manual smoke: Blumon "+ Add Account" and "Blumon Auto-Fetch" still open their original flows

### Task 6.2: Update the tutorial doc

- [ ] **Step 1: Update `docs/guides/SETUP_MERCHANT_TUTORIAL.md`** — replace wizard screenshots with panel screenshots, adjust step descriptions.

- [ ] **Step 2: Commit**

```bash
git commit -m "docs: update merchant setup tutorial for panel UX"
```

### Task 6.3: Open PR with checklist

- [ ] **Step 1: Push branch + open PR via `gh`**

```bash
git push -u origin feat/merchant-setup-panel
gh pr create --base develop --title "feat: object-centric MerchantSetupPanel replaces AngelPayWizard" \
  --body-file - <<'EOF'
## Summary
- Replaces linear AngelPay wizard with object-centric panel (9 cards on a single screen)
- Atomic create via existing `full-setup-angelpay` endpoint (no backend changes)
- Edit mode: per-card save via existing CRUD endpoints
- localStorage draft so the operator never loses work
- Zero impact on Blumon flow (regression E2E green)

## Test plan
- [ ] vitest suite green
- [ ] Playwright happy path green
- [ ] Playwright Blumon regression green
- [ ] Reports regression (available-balance + sales-summary) — values unchanged
- [ ] Manual smoke on staging: create + edit + Blumon flow

Spec: docs/superpowers/specs/2026-05-23-merchant-setup-panel-design.md
EOF
```

- [ ] **Step 2: Verify CI green on the PR.**

- [ ] **Step 3: Hand off to Jose for staging review.**

---

## Phase 7 · Post-deploy cleanup (1-2 weeks after deploy)

- [ ] Confirm no console errors in betterstack for /merchant-accounts
- [ ] Delete any temp deprecation files left in place during transition
- [ ] Close any follow-up issues opened during staging review

---

## Definition of done

The plan is complete when:

1. All checkboxes above are checked.
2. `feat/merchant-setup-panel` is merged to `main` and deployed to production.
3. Jose has used the panel successfully for at least one real venue setup.
4. The Blumon flow has not regressed in any way (verified by the regression test and by manual smoke).
5. The legacy `angelpay-wizard/` directory is gone from the repo.
