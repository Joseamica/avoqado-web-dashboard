import { http, HttpResponse } from 'msw'

const BASE_URL = 'http://localhost:3000'

// ============================================================================
// MOCK DATA FACTORIES
// ============================================================================

let merchantAccountIdCounter = 1
let terminalIdCounter = 1
let costStructureIdCounter = 1
let venueConfigIdCounter = 1
let reservationIdCounter = 1
let waitlistIdCounter = 1

// In-memory stores for stateful testing
export const mockStore = {
  merchantAccounts: new Map<string, any>(),
  terminals: new Map<string, any>(),
  costStructures: new Map<string, any>(),
  venueConfigs: new Map<string, any>(),
  providers: new Map<string, any>(),
  suppliers: new Map<string, any>(),
  purchaseOrders: new Map<string, any>(),
  supplierPricing: new Map<string, any>(),
  reservations: new Map<string, any>(),
  waitlistEntries: new Map<string, any>(),
  reservationSettings: new Map<string, any>(),

  // Reset all stores
  reset() {
    this.merchantAccounts.clear()
    this.terminals.clear()
    this.costStructures.clear()
    this.venueConfigs.clear()
    this.suppliers.clear()
    this.purchaseOrders.clear()
    this.supplierPricing.clear()
    this.reservations.clear()
    this.waitlistEntries.clear()
    this.reservationSettings.clear()
    merchantAccountIdCounter = 1
    terminalIdCounter = 1
    costStructureIdCounter = 1
    venueConfigIdCounter = 1
    reservationIdCounter = 1
    waitlistIdCounter = 1

    // Initialize default provider
    this.providers.set('blumon-provider-id', {
      id: 'blumon-provider-id',
      code: 'BLUMON',
      name: 'Blumon PAX Payment Solutions',
      type: 'PAYMENT_PROCESSOR',
      countryCode: ['MX'],
      active: true,
      configSchema: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  },
}

// Initialize with default provider
mockStore.reset()

export function createMockMerchantAccount(overrides: Partial<any> = {}) {
  const id = `merchant-account-${merchantAccountIdCounter++}`
  const account = {
    id,
    providerId: 'blumon-provider-id',
    externalMerchantId: `blumon_${Date.now()}`,
    alias: `test-account-${id}`,
    displayName: `Cuenta Test ${merchantAccountIdCounter - 1}`,
    active: true,
    displayOrder: 1,
    providerConfig: {},
    hasCredentials: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    provider: {
      id: 'blumon-provider-id',
      code: 'BLUMON',
      name: 'Blumon PAX Payment Solutions',
      type: 'PAYMENT_PROCESSOR',
    },
    blumonSerialNumber: null,
    blumonPosId: null,
    blumonEnvironment: 'SANDBOX',
    blumonMerchantId: null,
    clabeNumber: null,
    bankName: null,
    accountHolder: null,
    _count: {
      costStructures: 0,
      venueConfigs: 0,
    },
    ...overrides,
  }
  mockStore.merchantAccounts.set(id, account)
  return account
}

export function createMockTerminal(venueId: string, overrides: Partial<any> = {}) {
  const id = `terminal-${terminalIdCounter++}`
  const terminal = {
    id,
    name: `Terminal ${terminalIdCounter - 1}`,
    serialNumber: `SN${Date.now()}`,
    type: 'PAX',
    brand: 'PAX',
    model: 'A920',
    status: 'ACTIVE',
    lastHeartbeat: new Date().toISOString(),
    venueId,
    assignedMerchantIds: [],
    config: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
  mockStore.terminals.set(id, terminal)
  return terminal
}

export function createMockCostStructure(merchantAccountId: string, overrides: Partial<any> = {}) {
  const id = `cost-structure-${costStructureIdCounter++}`
  const structure = {
    id,
    providerId: 'blumon-provider-id',
    merchantAccountId,
    effectiveFrom: new Date().toISOString(),
    effectiveTo: null,
    debitRate: 1.68,
    creditRate: 2.30,
    amexRate: 3.00,
    internationalRate: 3.30,
    fixedCostPerTransaction: null,
    monthlyFee: null,
    active: true,
    proposalReference: null,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    merchantAccount: mockStore.merchantAccounts.get(merchantAccountId) || null,
    ...overrides,
  }
  mockStore.costStructures.set(id, structure)

  // Update merchant account _count
  const account = mockStore.merchantAccounts.get(merchantAccountId)
  if (account) {
    account._count = account._count || { costStructures: 0, venueConfigs: 0 }
    account._count.costStructures++
  }

  return structure
}

export function createMockVenueConfig(merchantAccountId: string, venueId: string, overrides: Partial<any> = {}) {
  const id = `venue-config-${venueConfigIdCounter++}`
  const config = {
    id,
    merchantAccountId,
    venueId,
    paymentTypes: ['CARD_PRESENT', 'CARD_NOT_PRESENT'],
    defaultForTypes: ['CARD_PRESENT'],
    active: true,
    priority: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    merchantAccount: mockStore.merchantAccounts.get(merchantAccountId) || null,
    ...overrides,
  }
  mockStore.venueConfigs.set(id, config)

  // Update merchant account _count
  const account = mockStore.merchantAccounts.get(merchantAccountId)
  if (account) {
    account._count = account._count || { costStructures: 0, venueConfigs: 0 }
    account._count.venueConfigs++
  }

  return config
}

export function createMockSupplier(overrides: Partial<any> = {}) {
  const id = `sup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const supplier = {
    id,
    venueId: 'test-venue-id',
    name: 'Test Supplier',
    contactName: 'John Doe',
    email: 'john@supplier.com',
    phone: '+1234567890',
    website: null,
    address: null,
    city: null,
    state: null,
    country: null,
    zipCode: null,
    taxId: null,
    leadTimeDays: null,
    minimumOrder: null,
    rating: 4.5,
    reliabilityScore: 0.95,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
  mockStore.suppliers.set(id, supplier)
  return supplier
}

export function createMockPurchaseOrder(overrides: Partial<any> = {}) {
  const id = `po_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const orderNumber = `PO${Date.now()}`
  const po = {
    id,
    venueId: 'test-venue-id',
    supplierId: 'sup_123',
    orderNumber,
    orderDate: new Date().toISOString(),
    expectedDeliveryDate: null,
    status: 'DRAFT',
    subtotal: '100.00',
    taxRate: 0.16,
    taxAmount: '16.00',
    total: '116.00',
    notes: null,
    createdById: 'user_123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    supplier: null,
    items: [],
    ...overrides,
  }
  mockStore.purchaseOrders.set(id, po)
  return po
}

// ============================================================================
// SUPPLIERS HANDLERS
// ============================================================================

export const suppliersHandlers = [
  // GET /suppliers
  http.get(`${BASE_URL}/api/v1/dashboard/venues/:venueId/inventory/suppliers`, ({ params, request }) => {
    const url = new URL(request.url)
    const active = url.searchParams.get('active')
    const search = url.searchParams.get('search')

    let suppliers = Array.from(mockStore.suppliers.values()).filter(
      (s) => s.venueId === params.venueId
    )

    // Apply active filter
    if (active !== null) {
      suppliers = suppliers.filter((s) => s.active === (active === 'true'))
    }

    // Apply search filter (case-insensitive name match)
    if (search) {
      suppliers = suppliers.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase())
      )
    }

    return HttpResponse.json({ success: true, data: suppliers })
  }),

  // GET /suppliers/:id
  http.get(
    `${BASE_URL}/api/v1/dashboard/venues/:venueId/inventory/suppliers/:supplierId`,
    ({ params }) => {
      const supplier = mockStore.suppliers.get(params.supplierId as string)
      if (!supplier) {
        return HttpResponse.json({ success: false, error: 'Supplier not found' }, { status: 404 })
      }
      return HttpResponse.json({ success: true, data: supplier })
    }
  ),

  // POST /suppliers
  http.post(
    `${BASE_URL}/api/v1/dashboard/venues/:venueId/inventory/suppliers`,
    async ({ request, params }) => {
      const body = (await request.json()) as any
      const supplier = createMockSupplier({ ...body, venueId: params.venueId })
      return HttpResponse.json({ success: true, data: supplier }, { status: 201 })
    }
  ),

  // PUT /suppliers/:id
  http.put(
    `${BASE_URL}/api/v1/dashboard/venues/:venueId/inventory/suppliers/:supplierId`,
    async ({ request, params }) => {
      const body = (await request.json()) as any
      const existing = mockStore.suppliers.get(params.supplierId as string)
      if (!existing) {
        return HttpResponse.json({ success: false, error: 'Supplier not found' }, { status: 404 })
      }
      const updated = { ...existing, ...body, updatedAt: new Date().toISOString() }
      mockStore.suppliers.set(params.supplierId as string, updated)
      return HttpResponse.json({ success: true, data: updated })
    }
  ),

  // DELETE /suppliers/:id
  http.delete(
    `${BASE_URL}/api/v1/dashboard/venues/:venueId/inventory/suppliers/:supplierId`,
    ({ params }) => {
      const deleted = mockStore.suppliers.delete(params.supplierId as string)
      if (!deleted) {
        return HttpResponse.json({ success: false, error: 'Supplier not found' }, { status: 404 })
      }
      return HttpResponse.json({ success: true, message: 'Supplier deleted' })
    }
  ),

  // POST /suppliers/:id/pricing
  http.post(
    `${BASE_URL}/api/v1/dashboard/venues/:venueId/inventory/suppliers/:supplierId/pricing`,
    async ({ request, params }) => {
      const body = (await request.json()) as any
      const pricing = {
        id: `pricing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        supplierId: params.supplierId,
        ...body,
      }
      mockStore.supplierPricing.set(pricing.id, pricing)
      return HttpResponse.json({ success: true, data: pricing }, { status: 201 })
    }
  ),

  // GET /raw-materials/:id/supplier-pricing
  http.get(
    `${BASE_URL}/api/v1/dashboard/venues/:venueId/inventory/raw-materials/:rawMaterialId/supplier-pricing`,
    ({ params }) => {
      const pricings = Array.from(mockStore.supplierPricing.values()).filter(
        (p) => p.rawMaterialId === params.rawMaterialId
      )
      return HttpResponse.json({ success: true, data: pricings })
    }
  ),

  // GET /raw-materials/:id/supplier-recommendations
  http.get(
    `${BASE_URL}/api/v1/dashboard/venues/:venueId/inventory/raw-materials/:rawMaterialId/supplier-recommendations`,
    () => {
      return HttpResponse.json({
        success: true,
        data: [
          {
            supplierId: 'sup_rec_1',
            supplierName: 'Recommended Supplier 1',
            unitPrice: 2.5,
            rating: 4.8,
          },
        ],
      })
    }
  ),

  // GET /suppliers/:id/performance
  http.get(
    `${BASE_URL}/api/v1/dashboard/venues/:venueId/inventory/suppliers/:supplierId/performance`,
    () => {
      return HttpResponse.json({
        success: true,
        data: {
          totalOrders: 10,
          completedOrders: 8,
          cancelledOrders: 1,
          totalSpent: 5000.0,
          averageLeadTime: 7,
          onTimeDeliveryRate: 0.9,
          lastOrderDate: new Date().toISOString(),
        },
      })
    }
  ),
]

// ============================================================================
// PURCHASE ORDERS HANDLERS
// ============================================================================

export const purchaseOrdersHandlers = [
  // GET /purchase-orders
  http.get(
    `${BASE_URL}/api/v1/dashboard/venues/:venueId/inventory/purchase-orders`,
    ({ params, request }) => {
      const url = new URL(request.url)
      const supplierId = url.searchParams.get('supplierId')

      let orders = Array.from(mockStore.purchaseOrders.values()).filter(
        (po) => po.venueId === params.venueId
      )

      // Apply status filter (can be array of statuses)
      // Axios sends arrays as status[]=value1&status[]=value2 or status=value1&status=value2
      const statusValues = url.searchParams.getAll('status[]').length > 0
        ? url.searchParams.getAll('status[]')
        : url.searchParams.getAll('status')

      if (statusValues.length > 0) {
        orders = orders.filter((po) => statusValues.includes(po.status))
      }

      // Apply supplier filter
      if (supplierId) {
        orders = orders.filter((po) => po.supplierId === supplierId)
      }

      return HttpResponse.json({ success: true, data: orders })
    }
  ),

  // GET /purchase-orders/stats (MUST come before /:poId to avoid matching "stats" as ID)
  http.get(
    `${BASE_URL}/api/v1/dashboard/venues/:venueId/inventory/purchase-orders/stats`,
    () => {
      return HttpResponse.json({
        success: true,
        data: {
          totalOrders: 25,
          draftOrders: 5,
          pendingOrders: 10,
          completedOrders: 8,
          cancelledOrders: 2,
          totalSpent: 15000.0,
        },
      })
    }
  ),

  // GET /purchase-orders/:id
  http.get(
    `${BASE_URL}/api/v1/dashboard/venues/:venueId/inventory/purchase-orders/:poId`,
    ({ params }) => {
      const order = mockStore.purchaseOrders.get(params.poId as string)
      if (!order) {
        return HttpResponse.json(
          { success: false, error: 'Purchase order not found' },
          { status: 404 }
        )
      }
      return HttpResponse.json({ success: true, data: order })
    }
  ),

  // POST /purchase-orders
  http.post(
    `${BASE_URL}/api/v1/dashboard/venues/:venueId/inventory/purchase-orders`,
    async ({ request, params }) => {
      const body = (await request.json()) as any
      const order = createMockPurchaseOrder({ ...body, venueId: params.venueId })
      return HttpResponse.json({ success: true, data: order }, { status: 201 })
    }
  ),

  // PUT /purchase-orders/:id
  http.put(
    `${BASE_URL}/api/v1/dashboard/venues/:venueId/inventory/purchase-orders/:poId`,
    async ({ request, params }) => {
      const body = (await request.json()) as any
      const existing = mockStore.purchaseOrders.get(params.poId as string)
      if (!existing) {
        return HttpResponse.json(
          { success: false, error: 'Purchase order not found' },
          { status: 404 }
        )
      }
      const updated = { ...existing, ...body, updatedAt: new Date().toISOString() }
      mockStore.purchaseOrders.set(params.poId as string, updated)
      return HttpResponse.json({ success: true, data: updated })
    }
  ),

  // POST /purchase-orders/:id/approve
  http.post(
    `${BASE_URL}/api/v1/dashboard/venues/:venueId/inventory/purchase-orders/:poId/approve`,
    ({ params }) => {
      const order = mockStore.purchaseOrders.get(params.poId as string)
      if (!order) {
        return HttpResponse.json(
          { success: false, error: 'Purchase order not found' },
          { status: 404 }
        )
      }
      order.status = 'APPROVED'
      order.updatedAt = new Date().toISOString()
      return HttpResponse.json({ success: true, data: order })
    }
  ),

  // POST /purchase-orders/:id/receive
  http.post(
    `${BASE_URL}/api/v1/dashboard/venues/:venueId/inventory/purchase-orders/:poId/receive`,
    async ({ request, params }) => {
      const body = (await request.json()) as any
      const order = mockStore.purchaseOrders.get(params.poId as string)
      if (!order) {
        return HttpResponse.json(
          { success: false, error: 'Purchase order not found' },
          { status: 404 }
        )
      }
      order.status = body.partial ? 'PARTIALLY_RECEIVED' : 'RECEIVED'
      order.updatedAt = new Date().toISOString()
      return HttpResponse.json({ success: true, data: order })
    }
  ),

  // POST /purchase-orders/:id/cancel
  http.post(
    `${BASE_URL}/api/v1/dashboard/venues/:venueId/inventory/purchase-orders/:poId/cancel`,
    async ({ request, params }) => {
      const body = (await request.json()) as any
      const order = mockStore.purchaseOrders.get(params.poId as string)
      if (!order) {
        return HttpResponse.json(
          { success: false, error: 'Purchase order not found' },
          { status: 404 }
        )
      }
      order.status = 'CANCELLED'
      order.notes = body.reason
      order.updatedAt = new Date().toISOString()
      return HttpResponse.json({ success: true, data: order })
    }
  ),
]

// ============================================================================
// RESERVATION FACTORIES
// ============================================================================

function generateConfirmationCode(): string {
  return `RES-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
}

export function createMockReservation(venueId: string, overrides: Partial<any> = {}) {
  const id = `reservation-${reservationIdCounter++}`
  const now = new Date()
  const startsAt = overrides.startsAt || new Date(now.getTime() + 3600000).toISOString()
  const endsAt = overrides.endsAt || new Date(new Date(startsAt).getTime() + 3600000).toISOString()
  const reservation = {
    id,
    venueId,
    confirmationCode: generateConfirmationCode(),
    cancelSecret: `cancel-${id}`,
    status: 'PENDING',
    channel: 'DASHBOARD',
    startsAt,
    endsAt,
    duration: 60,
    customerId: null,
    customer: null,
    guestName: 'Test Guest',
    guestPhone: '+5215551234567',
    guestEmail: 'guest@test.com',
    partySize: 2,
    tableId: null,
    table: null,
    productId: null,
    product: null,
    classSessionId: null,
    assignedStaffId: null,
    assignedStaff: null,
    createdById: null,
    createdBy: null,
    depositAmount: null,
    depositStatus: null,
    confirmedAt: null,
    checkedInAt: null,
    completedAt: null,
    cancelledAt: null,
    noShowAt: null,
    cancelledBy: null,
    cancellationReason: null,
    specialRequests: null,
    internalNotes: null,
    tags: [],
    statusLog: [{ status: 'PENDING', at: now.toISOString(), by: null }],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  }
  mockStore.reservations.set(id, reservation)
  return reservation
}

export function createMockWaitlistEntry(venueId: string, overrides: Partial<any> = {}) {
  const id = `waitlist-${waitlistIdCounter++}`
  const now = new Date()
  const entry = {
    id,
    venueId,
    customerId: null,
    customer: null,
    guestName: 'Waitlist Guest',
    guestPhone: '+5215559876543',
    partySize: 2,
    desiredStartAt: new Date(now.getTime() + 3600000).toISOString(),
    desiredEndAt: null,
    status: 'WAITING',
    position: waitlistIdCounter,
    notifiedAt: null,
    responseDeadline: null,
    promotedReservationId: null,
    promotedReservation: null,
    notes: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  }
  mockStore.waitlistEntries.set(id, entry)
  return entry
}

function getDefaultSettings(): any {
  return {
    scheduling: {
      slotIntervalMin: 15,
      defaultDurationMin: 60,
      autoConfirm: false,
      maxAdvanceDays: 30,
      minNoticeMin: 60,
      noShowGraceMin: 15,
      pacingMaxPerSlot: null,
      onlineCapacityPercent: 80,
    },
    deposits: {
      enabled: false,
      mode: 'none',
      percentageOfTotal: null,
      fixedAmount: null,
      requiredForPartySizeGte: null,
      paymentWindowHrs: null,
    },
    cancellation: {
      allowCustomerCancel: true,
      minHoursBeforeStart: 2,
      forfeitDeposit: false,
      noShowFeePercent: null,
    },
    waitlist: {
      enabled: true,
      maxSize: 20,
      priorityMode: 'fifo',
      notifyWindowMin: 15,
    },
    reminders: {
      enabled: true,
      channels: ['email'],
      minutesBefore: [60, 1440],
    },
    publicBooking: {
      enabled: false,
      requirePhone: true,
      requireEmail: false,
    },
  }
}

// ============================================================================
// RESERVATION HANDLERS
// ============================================================================

const reservationBasePath = `${BASE_URL}/api/v1/dashboard/venues/:venueId/reservations`

export const reservationHandlers = [
  // GET /reservations (paginated list)
  http.get(reservationBasePath, ({ params, request }) => {
    const url = new URL(request.url)

    let reservations = Array.from(mockStore.reservations.values()).filter(
      (r) => r.venueId === params.venueId,
    )

    const status = url.searchParams.get('status')
    if (status) {
      const statuses = status.split(',')
      reservations = reservations.filter((r) => statuses.includes(r.status))
    }

    const search = url.searchParams.get('search')
    if (search) {
      const q = search.toLowerCase()
      reservations = reservations.filter(
        (r) =>
          (r.guestName && r.guestName.toLowerCase().includes(q)) ||
          (r.confirmationCode && r.confirmationCode.toLowerCase().includes(q)),
      )
    }

    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')
    if (dateFrom) {
      reservations = reservations.filter((r) => r.startsAt >= dateFrom)
    }
    if (dateTo) {
      reservations = reservations.filter((r) => r.startsAt <= `${dateTo}T23:59:59.999Z`)
    }

    const channel = url.searchParams.get('channel')
    if (channel) {
      const channels = channel.split(',')
      reservations = reservations.filter((r) => channels.includes(r.channel))
    }

    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10)
    const total = reservations.length
    const paginated = reservations.slice((page - 1) * pageSize, page * pageSize)

    return HttpResponse.json({
      data: paginated,
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    })
  }),

  // GET /reservations/stats
  http.get(`${reservationBasePath}/stats`, ({ params, request }) => {
    const url = new URL(request.url)
    let reservations = Array.from(mockStore.reservations.values()).filter(
      (r) => r.venueId === params.venueId,
    )

    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')
    if (dateFrom) reservations = reservations.filter((r) => r.startsAt >= dateFrom)
    if (dateTo) reservations = reservations.filter((r) => r.startsAt <= `${dateTo}T23:59:59.999Z`)

    const byStatus: Record<string, number> = {}
    const byChannel: Record<string, number> = {}
    for (const r of reservations) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1
      byChannel[r.channel] = (byChannel[r.channel] || 0) + 1
    }

    const noShows = byStatus['NO_SHOW'] || 0
    const total = reservations.length

    return HttpResponse.json({
      total,
      byStatus,
      byChannel,
      noShowRate: total > 0 ? noShows / total : 0,
    })
  }),

  // GET /reservations/calendar
  http.get(`${reservationBasePath}/calendar`, ({ params, request }) => {
    const url = new URL(request.url)
    let reservations = Array.from(mockStore.reservations.values()).filter(
      (r) => r.venueId === params.venueId,
    )

    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')
    if (dateFrom) reservations = reservations.filter((r) => r.startsAt >= dateFrom)
    if (dateTo) reservations = reservations.filter((r) => r.startsAt <= `${dateTo}T23:59:59.999Z`)

    return HttpResponse.json({ reservations })
  }),

  // GET /reservations/availability
  http.get(`${reservationBasePath}/availability`, ({ request }) => {
    const url = new URL(request.url)
    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0]

    return HttpResponse.json({
      date,
      slots: [
        {
          startsAt: `${date}T14:00:00.000Z`,
          endsAt: `${date}T15:00:00.000Z`,
          availableTables: [{ id: 'table-1', number: 'T1', capacity: 4 }],
          availableStaff: [{ id: 'staff-1', firstName: 'Ana', lastName: 'García' }],
        },
        {
          startsAt: `${date}T14:15:00.000Z`,
          endsAt: `${date}T15:15:00.000Z`,
          availableTables: [{ id: 'table-2', number: 'T2', capacity: 6 }],
          availableStaff: [],
        },
        {
          startsAt: `${date}T14:30:00.000Z`,
          endsAt: `${date}T15:30:00.000Z`,
          availableTables: [{ id: 'table-1', number: 'T1', capacity: 4 }],
          availableStaff: [],
        },
      ],
    })
  }),

  // GET /reservations/waitlist (MUST come before /:reservationId)
  http.get(`${reservationBasePath}/waitlist`, ({ params, request }) => {
    const url = new URL(request.url)
    let entries = Array.from(mockStore.waitlistEntries.values()).filter(
      (e) => e.venueId === params.venueId,
    )
    const status = url.searchParams.get('status')
    if (status) entries = entries.filter((e) => e.status === status)
    return HttpResponse.json(entries)
  }),

  // POST /reservations/waitlist
  http.post(`${reservationBasePath}/waitlist`, async ({ request, params }) => {
    const body = (await request.json()) as any
    const entry = createMockWaitlistEntry(params.venueId as string, body)
    return HttpResponse.json(entry, { status: 201 })
  }),

  // DELETE /reservations/waitlist/:entryId
  http.delete(`${reservationBasePath}/waitlist/:entryId`, ({ params }) => {
    const deleted = mockStore.waitlistEntries.delete(params.entryId as string)
    if (!deleted) {
      return HttpResponse.json({ error: 'Waitlist entry not found' }, { status: 404 })
    }
    return new HttpResponse(null, { status: 204 })
  }),

  // POST /reservations/waitlist/:entryId/promote
  http.post(`${reservationBasePath}/waitlist/:entryId/promote`, async ({ request, params }) => {
    const existing = mockStore.waitlistEntries.get(params.entryId as string)
    if (!existing) {
      return HttpResponse.json({ error: 'Waitlist entry not found' }, { status: 404 })
    }
    const body = (await request.json()) as any
    existing.status = 'PROMOTED'
    existing.promotedReservationId = body.reservationId
    existing.updatedAt = new Date().toISOString()
    return HttpResponse.json(existing)
  }),

  // GET /reservations/settings
  http.get(`${reservationBasePath}/settings`, ({ params }) => {
    const venueId = params.venueId as string
    const settings = mockStore.reservationSettings.get(venueId) || getDefaultSettings()
    return HttpResponse.json(settings)
  }),

  // PUT /reservations/settings
  http.put(`${reservationBasePath}/settings`, async ({ request, params }) => {
    const venueId = params.venueId as string
    const body = (await request.json()) as any
    const current = mockStore.reservationSettings.get(venueId) || getDefaultSettings()
    const updated = { ...current, ...body }
    mockStore.reservationSettings.set(venueId, updated)
    return HttpResponse.json(updated)
  }),

  // ── Individual reservation handlers (MUST come AFTER /waitlist, /settings) ──

  // GET /reservations/:id
  http.get(`${reservationBasePath}/:reservationId`, ({ params }) => {
    const reservation = mockStore.reservations.get(params.reservationId as string)
    if (!reservation) {
      return HttpResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }
    return HttpResponse.json(reservation)
  }),

  // POST /reservations (create)
  http.post(reservationBasePath, async ({ request, params }) => {
    const body = (await request.json()) as any
    const reservation = createMockReservation(params.venueId as string, body)
    return HttpResponse.json(reservation, { status: 201 })
  }),

  // PUT /reservations/:id (update)
  http.put(`${reservationBasePath}/:reservationId`, async ({ request, params }) => {
    const existing = mockStore.reservations.get(params.reservationId as string)
    if (!existing) {
      return HttpResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }
    const body = (await request.json()) as any
    const updated = { ...existing, ...body, updatedAt: new Date().toISOString() }
    mockStore.reservations.set(params.reservationId as string, updated)
    return HttpResponse.json(updated)
  }),

  // DELETE /reservations/:id (cancel)
  http.delete(`${reservationBasePath}/:reservationId`, async ({ request, params }) => {
    const existing = mockStore.reservations.get(params.reservationId as string)
    if (!existing) {
      return HttpResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }
    let reason: string | undefined
    try {
      const body = (await request.json()) as any
      reason = body?.reason
    } catch { /* no body */ }
    const now = new Date().toISOString()
    existing.status = 'CANCELLED'
    existing.cancelledAt = now
    existing.cancellationReason = reason || null
    existing.updatedAt = now
    existing.statusLog = [...(existing.statusLog || []), { status: 'CANCELLED', at: now, by: null, reason }]
    return HttpResponse.json(existing)
  }),

  // POST /reservations/:id/confirm
  http.post(`${reservationBasePath}/:reservationId/confirm`, ({ params }) => {
    const existing = mockStore.reservations.get(params.reservationId as string)
    if (!existing) {
      return HttpResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }
    const now = new Date().toISOString()
    existing.status = 'CONFIRMED'
    existing.confirmedAt = now
    existing.updatedAt = now
    existing.statusLog = [...(existing.statusLog || []), { status: 'CONFIRMED', at: now, by: null }]
    return HttpResponse.json(existing)
  }),

  // POST /reservations/:id/check-in
  http.post(`${reservationBasePath}/:reservationId/check-in`, ({ params }) => {
    const existing = mockStore.reservations.get(params.reservationId as string)
    if (!existing) {
      return HttpResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }
    const now = new Date().toISOString()
    existing.status = 'CHECKED_IN'
    existing.checkedInAt = now
    existing.updatedAt = now
    existing.statusLog = [...(existing.statusLog || []), { status: 'CHECKED_IN', at: now, by: null }]
    return HttpResponse.json(existing)
  }),

  // POST /reservations/:id/complete
  http.post(`${reservationBasePath}/:reservationId/complete`, ({ params }) => {
    const existing = mockStore.reservations.get(params.reservationId as string)
    if (!existing) {
      return HttpResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }
    const now = new Date().toISOString()
    existing.status = 'COMPLETED'
    existing.completedAt = now
    existing.updatedAt = now
    existing.statusLog = [...(existing.statusLog || []), { status: 'COMPLETED', at: now, by: null }]
    return HttpResponse.json(existing)
  }),

  // POST /reservations/:id/no-show
  http.post(`${reservationBasePath}/:reservationId/no-show`, ({ params }) => {
    const existing = mockStore.reservations.get(params.reservationId as string)
    if (!existing) {
      return HttpResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }
    const now = new Date().toISOString()
    existing.status = 'NO_SHOW'
    existing.noShowAt = now
    existing.updatedAt = now
    existing.statusLog = [...(existing.statusLog || []), { status: 'NO_SHOW', at: now, by: null }]
    return HttpResponse.json(existing)
  }),

  // POST /reservations/:id/reschedule
  http.post(`${reservationBasePath}/:reservationId/reschedule`, async ({ request, params }) => {
    const existing = mockStore.reservations.get(params.reservationId as string)
    if (!existing) {
      return HttpResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }
    const body = (await request.json()) as any
    existing.startsAt = body.startsAt
    existing.endsAt = body.endsAt
    existing.updatedAt = new Date().toISOString()
    return HttpResponse.json(existing)
  }),
]

// ============================================================================
// API HANDLERS
// ============================================================================

export const handlers = [
  // --------------------------------------------------------------------------
  // Suppliers & Purchase Orders
  // --------------------------------------------------------------------------
  ...suppliersHandlers,
  ...purchaseOrdersHandlers,

  // --------------------------------------------------------------------------
  // Reservations
  // --------------------------------------------------------------------------
  ...reservationHandlers,

  // --------------------------------------------------------------------------
  // Payment Providers
  // --------------------------------------------------------------------------
  http.get(`${BASE_URL}/api/v1/dashboard/superadmin/payment-providers`, () => {
    return HttpResponse.json({
      success: true,
      data: Array.from(mockStore.providers.values()),
    })
  }),

  http.get(`${BASE_URL}/api/v1/dashboard/superadmin/payment-providers/:id`, ({ params }) => {
    const provider = mockStore.providers.get(params.id as string)
    if (!provider) {
      return HttpResponse.json({ success: false, error: 'Provider not found' }, { status: 404 })
    }
    return HttpResponse.json({ success: true, data: provider })
  }),

  // --------------------------------------------------------------------------
  // Merchant Accounts
  // --------------------------------------------------------------------------
  http.get(`${BASE_URL}/api/v1/dashboard/superadmin/merchant-accounts`, () => {
    return HttpResponse.json({
      success: true,
      data: Array.from(mockStore.merchantAccounts.values()),
    })
  }),

  http.get(`${BASE_URL}/api/v1/dashboard/superadmin/merchant-accounts/list`, () => {
    const accounts = Array.from(mockStore.merchantAccounts.values()).map(a => ({
      id: a.id,
      externalMerchantId: a.externalMerchantId,
      displayName: a.displayName,
      alias: a.alias,
      providerId: a.providerId,
      providerName: a.provider?.name,
      active: a.active,
      environment: a.blumonEnvironment,
      hasCredentials: a.hasCredentials,
      _count: a._count,
    }))
    return HttpResponse.json({ success: true, data: accounts })
  }),

  http.get(`${BASE_URL}/api/v1/dashboard/superadmin/merchant-accounts/:id`, ({ params }) => {
    const account = mockStore.merchantAccounts.get(params.id as string)
    if (!account) {
      return HttpResponse.json({ success: false, error: 'Merchant account not found' }, { status: 404 })
    }
    return HttpResponse.json({ success: true, data: account })
  }),

  http.post(`${BASE_URL}/api/v1/dashboard/superadmin/merchant-accounts`, async ({ request }) => {
    const body = await request.json() as any
    const account = createMockMerchantAccount(body)
    return HttpResponse.json({ success: true, data: account }, { status: 201 })
  }),

  http.patch(`${BASE_URL}/api/v1/dashboard/superadmin/merchant-accounts/:id`, async ({ params, request }) => {
    const account = mockStore.merchantAccounts.get(params.id as string)
    if (!account) {
      return HttpResponse.json({ success: false, error: 'Merchant account not found' }, { status: 404 })
    }
    const body = await request.json() as any
    Object.assign(account, body, { updatedAt: new Date().toISOString() })
    return HttpResponse.json({ success: true, data: account })
  }),

  http.post(`${BASE_URL}/api/v1/dashboard/superadmin/merchant-accounts/:id/toggle-status`, ({ params }) => {
    const account = mockStore.merchantAccounts.get(params.id as string)
    if (!account) {
      return HttpResponse.json({ success: false, error: 'Merchant account not found' }, { status: 404 })
    }
    account.active = !account.active
    account.updatedAt = new Date().toISOString()
    return HttpResponse.json({ success: true, data: account })
  }),

  http.delete(`${BASE_URL}/api/v1/dashboard/superadmin/merchant-accounts/:id`, ({ params }) => {
    const account = mockStore.merchantAccounts.get(params.id as string)
    if (!account) {
      return HttpResponse.json({ success: false, error: 'Merchant account not found' }, { status: 404 })
    }
    mockStore.merchantAccounts.delete(params.id as string)
    return HttpResponse.json({ success: true, data: { message: 'Merchant account deleted' } })
  }),

  // Blumon Auto-Fetch
  http.post(`${BASE_URL}/api/v1/dashboard/superadmin/merchant-accounts/blumon-autofetch`, async ({ request }) => {
    const body = await request.json() as any
    const account = createMockMerchantAccount({
      blumonSerialNumber: body.serialNumber,
      blumonEnvironment: body.environment || 'SANDBOX',
      displayName: `Blumon ${body.serialNumber}`,
      externalMerchantId: `blumon_${body.serialNumber}`,
      hasCredentials: true,
    })
    return HttpResponse.json({ success: true, data: account }, { status: 201 })
  }),

  // --------------------------------------------------------------------------
  // Terminals
  // --------------------------------------------------------------------------
  http.get(`${BASE_URL}/api/v1/dashboard/superadmin/terminals`, ({ request }) => {
    const url = new URL(request.url)
    const venueId = url.searchParams.get('venueId')

    let terminals = Array.from(mockStore.terminals.values())
    if (venueId) {
      terminals = terminals.filter(t => t.venueId === venueId)
    }
    return HttpResponse.json({ success: true, data: terminals })
  }),

  http.get(`${BASE_URL}/api/v1/dashboard/superadmin/terminals/:id`, ({ params }) => {
    const terminal = mockStore.terminals.get(params.id as string)
    if (!terminal) {
      return HttpResponse.json({ success: false, error: 'Terminal not found' }, { status: 404 })
    }
    return HttpResponse.json({ success: true, data: terminal })
  }),

  http.post(`${BASE_URL}/api/v1/dashboard/superadmin/terminals`, async ({ request }) => {
    const body = await request.json() as any
    const terminal = createMockTerminal(body.venueId, body)
    return HttpResponse.json({ success: true, data: terminal }, { status: 201 })
  }),

  http.patch(`${BASE_URL}/api/v1/dashboard/superadmin/terminals/:id`, async ({ params, request }) => {
    const terminal = mockStore.terminals.get(params.id as string)
    if (!terminal) {
      return HttpResponse.json({ success: false, error: 'Terminal not found' }, { status: 404 })
    }
    const body = await request.json() as any
    Object.assign(terminal, body, { updatedAt: new Date().toISOString() })
    return HttpResponse.json({ success: true, data: terminal })
  }),

  http.delete(`${BASE_URL}/api/v1/dashboard/superadmin/terminals/:id`, ({ params }) => {
    const terminal = mockStore.terminals.get(params.id as string)
    if (!terminal) {
      return HttpResponse.json({ success: false, error: 'Terminal not found' }, { status: 404 })
    }
    mockStore.terminals.delete(params.id as string)
    return HttpResponse.json({ success: true, data: { message: 'Terminal deleted' } })
  }),

  http.post(`${BASE_URL}/api/v1/dashboard/superadmin/terminals/:id/activation-code`, ({ params }) => {
    const terminal = mockStore.terminals.get(params.id as string)
    if (!terminal) {
      return HttpResponse.json({ success: false, error: 'Terminal not found' }, { status: 404 })
    }
    return HttpResponse.json({
      success: true,
      data: {
        activationCode: 'ABC123',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        qrCodeDataUrl: 'data:image/png;base64,mock',
      },
    })
  }),

  // --------------------------------------------------------------------------
  // Provider Cost Structures
  // --------------------------------------------------------------------------
  http.get(`${BASE_URL}/api/v1/dashboard/superadmin/provider-cost-structures`, () => {
    return HttpResponse.json({
      success: true,
      data: Array.from(mockStore.costStructures.values()),
    })
  }),

  http.get(`${BASE_URL}/api/v1/dashboard/superadmin/provider-cost-structures/merchant-account/:merchantAccountId`, ({ params }) => {
    const structures = Array.from(mockStore.costStructures.values())
      .filter(s => s.merchantAccountId === params.merchantAccountId)
    return HttpResponse.json({ success: true, data: structures })
  }),

  http.get(`${BASE_URL}/api/v1/dashboard/superadmin/provider-cost-structures/active/:merchantAccountId`, ({ params }) => {
    const structure = Array.from(mockStore.costStructures.values())
      .find(s => s.merchantAccountId === params.merchantAccountId && s.active && !s.effectiveTo)
    return HttpResponse.json({ success: true, data: structure || null })
  }),

  http.get(`${BASE_URL}/api/v1/dashboard/superadmin/provider-cost-structures/:id`, ({ params }) => {
    const structure = mockStore.costStructures.get(params.id as string)
    if (!structure) {
      return HttpResponse.json({ success: false, error: 'Cost structure not found' }, { status: 404 })
    }
    return HttpResponse.json({ success: true, data: structure })
  }),

  http.post(`${BASE_URL}/api/v1/dashboard/superadmin/provider-cost-structures`, async ({ request }) => {
    const body = await request.json() as any
    const structure = createMockCostStructure(body.merchantAccountId, body)
    return HttpResponse.json({ success: true, data: structure }, { status: 201 })
  }),

  http.patch(`${BASE_URL}/api/v1/dashboard/superadmin/provider-cost-structures/:id`, async ({ params, request }) => {
    const structure = mockStore.costStructures.get(params.id as string)
    if (!structure) {
      return HttpResponse.json({ success: false, error: 'Cost structure not found' }, { status: 404 })
    }
    const body = await request.json() as any
    Object.assign(structure, body, { updatedAt: new Date().toISOString() })
    return HttpResponse.json({ success: true, data: structure })
  }),

  http.delete(`${BASE_URL}/api/v1/dashboard/superadmin/provider-cost-structures/:id`, ({ params }) => {
    const structure = mockStore.costStructures.get(params.id as string)
    if (!structure) {
      return HttpResponse.json({ success: false, error: 'Cost structure not found' }, { status: 404 })
    }

    // Update merchant account _count
    const account = mockStore.merchantAccounts.get(structure.merchantAccountId)
    if (account && account._count) {
      account._count.costStructures = Math.max(0, account._count.costStructures - 1)
    }

    mockStore.costStructures.delete(params.id as string)
    return HttpResponse.json({ success: true, data: { message: 'Cost structure deleted' } })
  }),

  // --------------------------------------------------------------------------
  // Venue Payment Config
  // --------------------------------------------------------------------------
  http.get(`${BASE_URL}/api/v1/dashboard/venues/:venueId/payment-config/readiness`, ({ params }) => {
    const venueId = params.venueId as string
    const terminals = Array.from(mockStore.terminals.values()).filter(t => t.venueId === venueId)
    const configs = Array.from(mockStore.venueConfigs.values()).filter(c => c.venueId === venueId)

    const hasTerminal = terminals.length > 0
    const hasMerchantAccount = configs.length > 0
    const hasAssignedMerchant = terminals.some(t => t.assignedMerchantIds && t.assignedMerchantIds.length > 0)

    return HttpResponse.json({
      success: true,
      data: {
        venueId,
        isReady: hasTerminal && hasMerchantAccount && hasAssignedMerchant,
        checklist: {
          hasTerminal: { status: hasTerminal, count: terminals.length },
          hasMerchantAccount: { status: hasMerchantAccount, count: configs.length },
          hasAssignedMerchant: { status: hasAssignedMerchant },
          hasActiveCredentials: { status: false },
          hasCostStructure: { status: false },
        },
        terminalIds: terminals.map(t => t.id),
        merchantAccountIds: configs.map(c => c.merchantAccountId),
      },
    })
  }),
]
