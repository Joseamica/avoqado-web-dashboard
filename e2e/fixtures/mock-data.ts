/**
 * Mock data factories for Playwright E2E tests.
 *
 * Shapes match the backend auth status response and
 * the AuthContext types consumed by the dashboard.
 */

// ─── Enums (mirror src/types.ts) ────────────────────────────────

export enum StaffRole {
  SUPERADMIN = 'SUPERADMIN',
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  WAITER = 'WAITER',
  CASHIER = 'CASHIER',
  KITCHEN = 'KITCHEN',
  HOST = 'HOST',
  VIEWER = 'VIEWER',
}

// ─── Types (lightweight copies) ─────────────────────────────────

export interface MockSessionVenue {
  id: string
  name: string
  slug: string
  logo: string | null
  type: string
  address: string
  city: string
  timezone: string
  currency: string
  role: StaffRole
  status: string
  permissions: string[]
  kycStatus: string
  organizationId: string
  organization: { id: string; name: string }
  features: Array<{ feature: { id: string; code: string; name: string }; active: boolean }>
  modules: Array<{ module: { id: string; code: string; name: string }; enabled: boolean }>
}

export interface MockUser {
  id: string
  firstName: string
  lastName: string
  email: string
  emailVerified: boolean
  photoUrl: string | null
  phone: string | null
  organizationId: string
  venues: MockSessionVenue[]
  role: StaffRole
  createdAt: string
  lastLogin: string | null
}

export interface MockAuthStatusResponse {
  authenticated: boolean
  user: MockUser
  allVenues: MockSessionVenue[]
}

// ─── Default Organization ───────────────────────────────────────

const DEFAULT_ORG = {
  id: 'org-test-001',
  name: 'Test Organization',
}

// ─── Factory: Venue ─────────────────────────────────────────────

let venueCounter = 0

export function createMockVenue(overrides: Partial<MockSessionVenue> = {}): MockSessionVenue {
  venueCounter++
  const id = overrides.id ?? `venue-${venueCounter.toString().padStart(3, '0')}`
  const name = overrides.name ?? `Venue ${venueCounter}`
  const slug = overrides.slug ?? `venue-${String.fromCharCode(96 + venueCounter)}` // venue-a, venue-b, …

  return {
    id,
    name,
    slug,
    logo: null,
    type: 'RESTAURANT',
    address: '123 Test St',
    city: 'Mexico City',
    timezone: 'America/Mexico_City',
    currency: 'MXN',
    role: StaffRole.OWNER,
    status: 'ACTIVE',
    permissions: [
      'menu:read', 'menu:create', 'menu:update', 'menu:delete',
      'teams:read', 'teams:invite', 'teams:update', 'teams:delete',
      'tpv:read', 'tpv:create', 'tpv:update', 'tpv:delete',
      'orders:read', 'orders:update',
      'payments:read',
      'reports:read',
      'settings:read', 'settings:update',
    ],
    kycStatus: 'VERIFIED',
    organizationId: DEFAULT_ORG.id,
    organization: DEFAULT_ORG,
    features: [],
    modules: [
      { module: { id: 'mod-team', code: 'TEAM', name: 'Team Management' }, enabled: true },
    ],
    ...overrides,
  }
}

// ─── Factory: User ──────────────────────────────────────────────

export function createMockUser(
  role: StaffRole,
  venues: MockSessionVenue[],
  overrides: Partial<MockUser> = {},
): MockUser {
  // Set the user's role on each venue to the given role (unless already overridden)
  const venuesWithRole = venues.map((v) => ({
    ...v,
    role: v.role === StaffRole.OWNER ? role : v.role, // only re-assign if still default
  }))

  return {
    id: 'user-test-001',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@avoqado.io',
    emailVerified: true,
    photoUrl: null,
    phone: null,
    organizationId: DEFAULT_ORG.id,
    venues: venuesWithRole,
    role, // highest role across all assignments
    createdAt: '2024-01-01T00:00:00.000Z',
    lastLogin: '2026-02-16T12:00:00.000Z',
    ...overrides,
  }
}

// ─── Factory: Auth Status Response ──────────────────────────────

export function createAuthStatusResponse(user: MockUser): MockAuthStatusResponse {
  return {
    authenticated: true,
    user,
    allVenues: user.venues,
  }
}

// ─── Pre-built Fixtures ─────────────────────────────────────────

// Reset counter for deterministic slugs
venueCounter = 0

export const VENUE_ALPHA = createMockVenue({
  id: 'venue-alpha',
  name: 'Restaurante Alpha',
  slug: 'venue-alpha',
})

export const VENUE_BETA = createMockVenue({
  id: 'venue-beta',
  name: 'Restaurante Beta',
  slug: 'venue-beta',
})

/** OWNER user with 2 venues */
export const OWNER_USER = createMockUser(StaffRole.OWNER, [VENUE_ALPHA, VENUE_BETA])

/** ADMIN user with 2 venues */
export const ADMIN_USER = createMockUser(StaffRole.ADMIN, [VENUE_ALPHA, VENUE_BETA])

/** MANAGER user with 2 venues */
export const MANAGER_USER = createMockUser(StaffRole.MANAGER, [VENUE_ALPHA, VENUE_BETA])

/** OWNER user with only 1 venue (checkbox should NOT show) */
export const SINGLE_VENUE_OWNER = createMockUser(StaffRole.OWNER, [VENUE_ALPHA])

// ─── PlayTelecom / Inventory Fixtures ────────────────────────────

/** Venue with SERIALIZED_INVENTORY module enabled + inventory permissions */
export function createPlayTelecomVenue(overrides: Partial<MockSessionVenue> = {}): MockSessionVenue {
  return createMockVenue({
    permissions: [
      'menu:read', 'menu:create', 'menu:update', 'menu:delete',
      'teams:read', 'teams:invite', 'teams:update', 'teams:delete',
      'tpv:read', 'tpv:create', 'tpv:update', 'tpv:delete',
      'orders:read', 'orders:update',
      'payments:read',
      'reports:read',
      'settings:read', 'settings:update',
      'inventory:read', 'inventory:create', 'inventory:update', 'inventory:delete',
      'inventory:org-manage',
      'serialized-inventory:create',
    ],
    modules: [
      { module: { id: 'mod-team', code: 'TEAM', name: 'Team Management' }, enabled: true },
      { module: { id: 'mod-inv', code: 'SERIALIZED_INVENTORY', name: 'Serialized Inventory' }, enabled: true },
    ],
    ...overrides,
  })
}

export const PLAYTELECOM_VENUE_ALPHA = createPlayTelecomVenue({
  id: 'venue-alpha',
  name: 'Tienda Alpha',
  slug: 'venue-alpha',
})

export const PLAYTELECOM_VENUE_BETA = createPlayTelecomVenue({
  id: 'venue-beta',
  name: 'Tienda Beta',
  slug: 'venue-beta',
})

// ─── Mock Item Categories ────────────────────────────────────────

export interface MockItemCategory {
  id: string
  name: string
  description: string | null
  color: string | null
  sortOrder: number
  requiresPreRegistration: boolean
  suggestedPrice: number | null
  barcodePattern: string | null
  active: boolean
  source?: 'venue' | 'organization'
  totalItems?: number
  availableItems?: number
  soldItems?: number
}

export const MOCK_ORG_CATEGORIES: MockItemCategory[] = [
  {
    id: 'cat-org-001',
    name: 'SIM Prepago',
    description: 'SIM cards prepago de la organización',
    color: '#2563eb',
    sortOrder: 0,
    requiresPreRegistration: true,
    suggestedPrice: 50,
    barcodePattern: '^89521[0-9]{14}$',
    active: true,
    source: 'organization',
    totalItems: 100,
    availableItems: 80,
    soldItems: 20,
  },
  {
    id: 'cat-org-002',
    name: 'Chip Negro',
    description: 'Chip plan negro',
    color: '#1a1a1a',
    sortOrder: 1,
    requiresPreRegistration: true,
    suggestedPrice: 150,
    barcodePattern: null,
    active: true,
    source: 'organization',
    totalItems: 50,
    availableItems: 45,
    soldItems: 5,
  },
]

export const MOCK_VENUE_CATEGORIES: MockItemCategory[] = [
  {
    id: 'cat-venue-001',
    name: 'Recarga Express',
    description: 'Recargas de la tienda',
    color: '#16a34a',
    sortOrder: 0,
    requiresPreRegistration: false,
    suggestedPrice: 30,
    barcodePattern: null,
    active: true,
    source: 'venue',
    totalItems: 25,
    availableItems: 20,
    soldItems: 5,
  },
]

export const ALL_MOCK_CATEGORIES: MockItemCategory[] = [
  ...MOCK_ORG_CATEGORIES,
  ...MOCK_VENUE_CATEGORIES,
]

// ─── Role Config Default Response ───────────────────────────────

export const DEFAULT_ROLE_CONFIGS = {
  configs: Object.values(StaffRole).map((role, idx) => ({
    id: `rc-${idx}`,
    venueId: 'venue-alpha',
    role,
    displayName: role.charAt(0) + role.slice(1).toLowerCase(),
    color: null,
    isActive: true,
    sortOrder: idx,
  })),
}
