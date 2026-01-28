---

## 🧪 PHASE 0: Testing & Validation Infrastructure (MANDATORY BEFORE IMPLEMENTATION)

**CRITICAL:** As requested by the user, this phase MUST be completed BEFORE implementing any Purchase Orders/Suppliers features. Testing
infrastructure, ESLint validation, and endpoint contract verification are MANDATORY prerequisites.

> **User's explicit requirement (2025-01-20):** "cada cosa nueva que hagas aunque tardemos mucho, haz scripts de testing y si es necesario
> con jest, para ir viendo que lo que vas creando o modificando esta bien, checa eslints tambien en avoqado-web-dashboard y avoqado-server,
> y verifica los endpoints que crees en front end si correspondan con el backend porque es comun que siempre te equivocas"

### 🎯 Objectives

1. **Testing Infrastructure** - Set up Jest/Vitest tests for ALL new code BEFORE implementation
2. **ESLint Validation** - Fix critical ESLint issues in both repositories (99 files with issues each)
3. **Endpoint Contract Validation** - Create automated script to verify frontend → backend endpoint matching
4. **Continuous Testing Workflow** - Establish "Write code → Write tests → Validate → Commit" workflow

### 📊 Current State Analysis

**Frontend (avoqado-web-dashboard):**

- ✅ Vitest configured and ready (`vitest@^4.0.15`)
- ✅ MSW (Mock Service Worker) v2 installed for API mocking
- ✅ jsdom environment configured for DOM testing
- ✅ Coverage tools available (@vitest/coverage-v8)
- ⚠️ Only 3 test files exist (NotificationContext, payment-onboarding, NotificationBell.urls)
- ❌ 99 files with ESLint issues

**Backend (avoqado-server):**

- ✅ Jest configured with extensive test suite (56+ files)
- ✅ Supertest installed for API testing
- ✅ Test patterns established (unit/, integration/, api-tests/)
- ✅ Inventory tests exist (FIFO, modifiers, etc.)
- ❌ 99 files with ESLint issues

**Backend Endpoints Documented:**

- ✅ All 17 endpoints fully documented (9 Suppliers + 8 Purchase Orders)
- ✅ Request/response shapes known
- ✅ Permissions identified
- ✅ Validation rules documented

### 🛠️ Task 1: Frontend Testing Infrastructure

#### 1.1 Create Service Layer with TypeScript Types

**File:** `src/services/supplier.service.ts` (NEW)

```typescript
import axios from '@/lib/axios'

// Types matching backend EXACTLY
export interface Supplier {
  id: string
  venueId: string
  name: string
  contactName?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  zipCode?: string | null
  taxId?: string | null
  leadTimeDays?: number | null
  minimumOrder?: number | null
  rating: number
  reliabilityScore: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateSupplierDto {
  name: string
  contactName?: string
  email?: string
  phone?: string
  website?: string
  address?: string
  city?: string
  state?: string
  country?: string
  zipCode?: string
  taxId?: string
  leadTimeDays?: number
  minimumOrder?: number
  rating?: number
  reliabilityScore?: number
  active?: boolean
}

export interface UpdateSupplierDto extends Partial<CreateSupplierDto> {}

export interface SupplierPricingDto {
  rawMaterialId: string
  unitPrice: number
  minimumQuantity?: number
  discountRate?: number
  effectiveFrom?: string
  effectiveTo?: string
}

export interface SupplierPerformance {
  totalOrders: number
  completedOrders: number
  cancelledOrders: number
  totalSpent: number
  averageLeadTime: number
  onTimeDeliveryRate: number
  lastOrderDate: string | null
}

// API client
export const supplierService = {
  getSuppliers: async (venueId: string, filters?: { active?: boolean; search?: string }) => {
    const { data } = await axios.get(`/venues/${venueId}/inventory/suppliers`, { params: filters })
    return data
  },

  getSupplier: async (venueId: string, supplierId: string) => {
    const { data } = await axios.get(`/venues/${venueId}/inventory/suppliers/${supplierId}`)
    return data
  },

  createSupplier: async (venueId: string, dto: CreateSupplierDto) => {
    const { data } = await axios.post(`/venues/${venueId}/inventory/suppliers`, dto)
    return data
  },

  updateSupplier: async (venueId: string, supplierId: string, dto: UpdateSupplierDto) => {
    const { data } = await axios.put(`/venues/${venueId}/inventory/suppliers/${supplierId}`, dto)
    return data
  },

  deleteSupplier: async (venueId: string, supplierId: string) => {
    const { data } = await axios.delete(`/venues/${venueId}/inventory/suppliers/${supplierId}`)
    return data
  },

  addPricing: async (venueId: string, supplierId: string, dto: SupplierPricingDto) => {
    const { data } = await axios.post(`/venues/${venueId}/inventory/suppliers/${supplierId}/pricing`, dto)
    return data
  },

  getPerformance: async (venueId: string, supplierId: string) => {
    const { data } = await axios.get(`/venues/${venueId}/inventory/suppliers/${supplierId}/performance`)
    return data
  },
}
```

**File:** `src/services/purchaseOrder.service.ts` (NEW)

```typescript
import axios from '@/lib/axios'

// Enums matching backend
export enum PurchaseOrderStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SENT = 'SENT',
  RECEIVED = 'RECEIVED',
  PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED',
  CANCELLED = 'CANCELLED',
}

export enum Unit {
  KILOGRAM = 'KILOGRAM',
  GRAM = 'GRAM',
  LITER = 'LITER',
  MILLILITER = 'MILLILITER',
  PIECE = 'PIECE',
  // ... add other units from backend enum
}

// Types matching backend EXACTLY
export interface PurchaseOrder {
  id: string
  venueId: string
  supplierId: string
  orderNumber: string
  orderDate: string
  expectedDeliveryDate?: string | null
  status: PurchaseOrderStatus
  subtotal: string // Decimal as string
  taxRate: number
  taxAmount: string // Decimal as string
  total: string // Decimal as string
  notes?: string | null
  createdById: string
  createdAt: string
  updatedAt: string
  supplier: any // Nested supplier object
  items: PurchaseOrderItem[]
}

export interface PurchaseOrderItem {
  id: string
  purchaseOrderId: string
  rawMaterialId: string
  quantityOrdered: number
  quantityReceived: number
  unit: Unit
  unitPrice: string // Decimal as string
  total: string // Decimal as string
  rawMaterial: any // Nested raw material object
}

export interface CreatePurchaseOrderDto {
  supplierId: string
  orderDate: string
  expectedDeliveryDate?: string
  taxRate: number
  notes?: string
  items: Array<{
    rawMaterialId: string
    quantityOrdered: number
    unit: Unit
    unitPrice: number
  }>
}

export interface UpdatePurchaseOrderDto extends Partial<CreatePurchaseOrderDto> {}

export interface ReceivePurchaseOrderDto {
  items: Array<{
    purchaseOrderItemId: string
    quantityReceived: number
    unitCost?: number
    batchNumber?: string
    expirationDate?: string
  }>
  partial: boolean
}

// API client
export const purchaseOrderService = {
  getPurchaseOrders: async (venueId: string, filters?: { status?: PurchaseOrderStatus[]; supplierId?: string }) => {
    const { data } = await axios.get(`/venues/${venueId}/inventory/purchase-orders`, { params: filters })
    return data
  },

  getPurchaseOrder: async (venueId: string, poId: string) => {
    const { data } = await axios.get(`/venues/${venueId}/inventory/purchase-orders/${poId}`)
    return data
  },

  createPurchaseOrder: async (venueId: string, dto: CreatePurchaseOrderDto) => {
    const { data } = await axios.post(`/venues/${venueId}/inventory/purchase-orders`, dto)
    return data
  },

  updatePurchaseOrder: async (venueId: string, poId: string, dto: UpdatePurchaseOrderDto) => {
    const { data } = await axios.put(`/venues/${venueId}/inventory/purchase-orders/${poId}`, dto)
    return data
  },

  approvePurchaseOrder: async (venueId: string, poId: string) => {
    const { data } = await axios.post(`/venues/${venueId}/inventory/purchase-orders/${poId}/approve`)
    return data
  },

  receivePurchaseOrder: async (venueId: string, poId: string, dto: ReceivePurchaseOrderDto) => {
    const { data } = await axios.post(`/venues/${venueId}/inventory/purchase-orders/${poId}/receive`, dto)
    return data
  },

  cancelPurchaseOrder: async (venueId: string, poId: string, reason: string) => {
    const { data } = await axios.post(`/venues/${venueId}/inventory/purchase-orders/${poId}/cancel`, { reason })
    return data
  },

  getStats: async (venueId: string) => {
    const { data } = await axios.get(`/venues/${venueId}/inventory/purchase-orders/stats`)
    return data
  },
}
```

#### 1.2 Create MSW Handlers

**File:** `src/test/mocks/handlers.ts` (MODIFY - add to existing handlers)

```typescript
import { http, HttpResponse } from 'msw'

// In-memory stores
export const mockStore = {
  // ... existing stores
  suppliers: new Map<string, any>(),
  purchaseOrders: new Map<string, any>(),
  supplierPricing: new Map<string, any>(),

  reset() {
    // ... existing resets
    this.suppliers.clear()
    this.purchaseOrders.clear()
    this.supplierPricing.clear()
  },
}

// Factory functions
export function createMockSupplier(overrides = {}) {
  return {
    id: `sup_${Date.now()}`,
    venueId: 'test-venue-id',
    name: 'Test Supplier',
    contactName: 'John Doe',
    email: 'john@supplier.com',
    phone: '+1234567890',
    rating: 4.5,
    reliabilityScore: 0.95,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

export function createMockPurchaseOrder(overrides = {}) {
  return {
    id: `po_${Date.now()}`,
    venueId: 'test-venue-id',
    supplierId: 'sup_123',
    orderNumber: `PO${Date.now()}`,
    orderDate: new Date().toISOString(),
    status: 'DRAFT',
    subtotal: '100.00',
    taxRate: 0.16,
    taxAmount: '16.00',
    total: '116.00',
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// Handlers
export const suppliersHandlers = [
  // GET /suppliers
  http.get('/api/v1/dashboard/venues/:venueId/inventory/suppliers', ({ params }) => {
    const suppliers = Array.from(mockStore.suppliers.values()).filter(s => s.venueId === params.venueId)
    return HttpResponse.json({ success: true, data: suppliers })
  }),

  // GET /suppliers/:id
  http.get('/api/v1/dashboard/venues/:venueId/inventory/suppliers/:supplierId', ({ params }) => {
    const supplier = mockStore.suppliers.get(params.supplierId as string)
    if (!supplier) {
      return HttpResponse.json({ success: false, error: 'Supplier not found' }, { status: 404 })
    }
    return HttpResponse.json({ success: true, data: supplier })
  }),

  // POST /suppliers
  http.post('/api/v1/dashboard/venues/:venueId/inventory/suppliers', async ({ request, params }) => {
    const body = await request.json()
    const supplier = createMockSupplier({ ...body, venueId: params.venueId })
    mockStore.suppliers.set(supplier.id, supplier)
    return HttpResponse.json({ success: true, data: supplier }, { status: 201 })
  }),

  // PUT /suppliers/:id
  http.put('/api/v1/dashboard/venues/:venueId/inventory/suppliers/:supplierId', async ({ request, params }) => {
    const body = await request.json()
    const existing = mockStore.suppliers.get(params.supplierId as string)
    if (!existing) {
      return HttpResponse.json({ success: false, error: 'Supplier not found' }, { status: 404 })
    }
    const updated = { ...existing, ...body, updatedAt: new Date().toISOString() }
    mockStore.suppliers.set(params.supplierId as string, updated)
    return HttpResponse.json({ success: true, data: updated })
  }),

  // DELETE /suppliers/:id
  http.delete('/api/v1/dashboard/venues/:venueId/inventory/suppliers/:supplierId', ({ params }) => {
    const deleted = mockStore.suppliers.delete(params.supplierId as string)
    if (!deleted) {
      return HttpResponse.json({ success: false, error: 'Supplier not found' }, { status: 404 })
    }
    return HttpResponse.json({ success: true, message: 'Supplier deleted' })
  }),

  // POST /suppliers/:id/pricing
  http.post('/api/v1/dashboard/venues/:venueId/inventory/suppliers/:supplierId/pricing', async ({ request, params }) => {
    const body = await request.json()
    const pricing = { id: `pricing_${Date.now()}`, supplierId: params.supplierId, ...body }
    mockStore.supplierPricing.set(pricing.id, pricing)
    return HttpResponse.json({ success: true, data: pricing }, { status: 201 })
  }),

  // GET /suppliers/:id/performance
  http.get('/api/v1/dashboard/venues/:venueId/inventory/suppliers/:supplierId/performance', () => {
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
  }),
]

export const purchaseOrdersHandlers = [
  // GET /purchase-orders
  http.get('/api/v1/dashboard/venues/:venueId/inventory/purchase-orders', ({ params }) => {
    const orders = Array.from(mockStore.purchaseOrders.values()).filter(po => po.venueId === params.venueId)
    return HttpResponse.json({ success: true, data: orders })
  }),

  // GET /purchase-orders/:id
  http.get('/api/v1/dashboard/venues/:venueId/inventory/purchase-orders/:poId', ({ params }) => {
    const order = mockStore.purchaseOrders.get(params.poId as string)
    if (!order) {
      return HttpResponse.json({ success: false, error: 'Purchase order not found' }, { status: 404 })
    }
    return HttpResponse.json({ success: true, data: order })
  }),

  // POST /purchase-orders
  http.post('/api/v1/dashboard/venues/:venueId/inventory/purchase-orders', async ({ request, params }) => {
    const body = await request.json()
    const order = createMockPurchaseOrder({ ...body, venueId: params.venueId })
    mockStore.purchaseOrders.set(order.id, order)
    return HttpResponse.json({ success: true, data: order }, { status: 201 })
  }),

  // PUT /purchase-orders/:id
  http.put('/api/v1/dashboard/venues/:venueId/inventory/purchase-orders/:poId', async ({ request, params }) => {
    const body = await request.json()
    const existing = mockStore.purchaseOrders.get(params.poId as string)
    if (!existing) {
      return HttpResponse.json({ success: false, error: 'Purchase order not found' }, { status: 404 })
    }
    const updated = { ...existing, ...body, updatedAt: new Date().toISOString() }
    mockStore.purchaseOrders.set(params.poId as string, updated)
    return HttpResponse.json({ success: true, data: updated })
  }),

  // POST /purchase-orders/:id/approve
  http.post('/api/v1/dashboard/venues/:venueId/inventory/purchase-orders/:poId/approve', ({ params }) => {
    const order = mockStore.purchaseOrders.get(params.poId as string)
    if (!order) {
      return HttpResponse.json({ success: false, error: 'Purchase order not found' }, { status: 404 })
    }
    order.status = 'APPROVED'
    order.updatedAt = new Date().toISOString()
    return HttpResponse.json({ success: true, data: order })
  }),

  // POST /purchase-orders/:id/receive
  http.post('/api/v1/dashboard/venues/:venueId/inventory/purchase-orders/:poId/receive', async ({ request, params }) => {
    const body = await request.json()
    const order = mockStore.purchaseOrders.get(params.poId as string)
    if (!order) {
      return HttpResponse.json({ success: false, error: 'Purchase order not found' }, { status: 404 })
    }
    order.status = body.partial ? 'PARTIALLY_RECEIVED' : 'RECEIVED'
    order.updatedAt = new Date().toISOString()
    return HttpResponse.json({ success: true, data: order })
  }),

  // POST /purchase-orders/:id/cancel
  http.post('/api/v1/dashboard/venues/:venueId/inventory/purchase-orders/:poId/cancel', async ({ request, params }) => {
    const body = await request.json()
    const order = mockStore.purchaseOrders.get(params.poId as string)
    if (!order) {
      return HttpResponse.json({ success: false, error: 'Purchase order not found' }, { status: 404 })
    }
    order.status = 'CANCELLED'
    order.notes = body.reason
    order.updatedAt = new Date().toISOString()
    return HttpResponse.json({ success: true, data: order })
  }),

  // GET /purchase-orders/stats
  http.get('/api/v1/dashboard/venues/:venueId/inventory/purchase-orders/stats', () => {
    return HttpResponse.json({
      success: true,
      data: {
        totalOrders: 25,
        draftOrders: 5,
        pendingOrders: 10,
        completedOrders: 8,
        cancelledOrders: 2,
      },
    })
  }),
]

// Add to existing handlers array
export const handlers = [
  // ... existing handlers
  ...suppliersHandlers,
  ...purchaseOrdersHandlers,
]
```

#### 1.3 Create Test Suite

**File:** `src/test/suppliers-purchase-orders.test.ts` (NEW)

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { supplierService } from '@/services/supplier.service'
import { purchaseOrderService, PurchaseOrderStatus } from '@/services/purchaseOrder.service'
import { mockStore } from './mocks/handlers'

describe('Suppliers & Purchase Orders', () => {
  const venueId = 'test-venue-id'

  beforeEach(() => {
    mockStore.reset()
  })

  describe('Suppliers CRUD', () => {
    it('should create a supplier', async () => {
      const response = await supplierService.createSupplier(venueId, {
        name: 'Premium Foods Inc',
        email: 'contact@premiumfoods.com',
        phone: '+1234567890',
      })

      expect(response.success).toBe(true)
      expect(response.data).toMatchObject({
        id: expect.any(String),
        name: 'Premium Foods Inc',
        email: 'contact@premiumfoods.com',
      })
    })

    it('should list suppliers', async () => {
      // Create 2 suppliers
      await supplierService.createSupplier(venueId, { name: 'Supplier 1' })
      await supplierService.createSupplier(venueId, { name: 'Supplier 2' })

      const response = await supplierService.getSuppliers(venueId)

      expect(response.success).toBe(true)
      expect(response.data).toHaveLength(2)
    })

    it('should update a supplier', async () => {
      const created = await supplierService.createSupplier(venueId, { name: 'Old Name' })
      const supplierId = created.data.id

      const response = await supplierService.updateSupplier(venueId, supplierId, {
        name: 'New Name',
      })

      expect(response.success).toBe(true)
      expect(response.data.name).toBe('New Name')
    })

    it('should delete a supplier', async () => {
      const created = await supplierService.createSupplier(venueId, { name: 'To Delete' })
      const supplierId = created.data.id

      const response = await supplierService.deleteSupplier(venueId, supplierId)

      expect(response.success).toBe(true)

      // Verify it's deleted
      const list = await supplierService.getSuppliers(venueId)
      expect(list.data).toHaveLength(0)
    })

    it('should filter suppliers by active status', async () => {
      await supplierService.createSupplier(venueId, { name: 'Active', active: true })
      await supplierService.createSupplier(venueId, { name: 'Inactive', active: false })

      const response = await supplierService.getSuppliers(venueId, { active: true })

      expect(response.success).toBe(true)
      expect(response.data).toHaveLength(1)
      expect(response.data[0].name).toBe('Active')
    })
  })

  describe('Supplier Pricing', () => {
    it('should add pricing for a supplier', async () => {
      const supplier = await supplierService.createSupplier(venueId, { name: 'Supplier' })
      const supplierId = supplier.data.id

      const response = await supplierService.addPricing(venueId, supplierId, {
        rawMaterialId: 'rm_123',
        unitPrice: 2.5,
        minimumQuantity: 10,
      })

      expect(response.success).toBe(true)
      expect(response.data).toMatchObject({
        supplierId,
        rawMaterialId: 'rm_123',
        unitPrice: 2.5,
      })
    })

    it('should get supplier performance metrics', async () => {
      const supplier = await supplierService.createSupplier(venueId, { name: 'Supplier' })
      const supplierId = supplier.data.id

      const response = await supplierService.getPerformance(venueId, supplierId)

      expect(response.success).toBe(true)
      expect(response.data).toHaveProperty('totalOrders')
      expect(response.data).toHaveProperty('onTimeDeliveryRate')
    })
  })

  describe('Purchase Orders CRUD', () => {
    it('should create a purchase order', async () => {
      const supplier = await supplierService.createSupplier(venueId, { name: 'Supplier' })
      const supplierId = supplier.data.id

      const response = await purchaseOrderService.createPurchaseOrder(venueId, {
        supplierId,
        orderDate: new Date().toISOString(),
        taxRate: 0.16,
        items: [
          {
            rawMaterialId: 'rm_123',
            quantityOrdered: 50,
            unit: 'KILOGRAM' as any,
            unitPrice: 2.5,
          },
        ],
      })

      expect(response.success).toBe(true)
      expect(response.data).toMatchObject({
        id: expect.any(String),
        supplierId,
        status: 'DRAFT',
      })
    })

    it('should list purchase orders', async () => {
      const supplier = await supplierService.createSupplier(venueId, { name: 'Supplier' })
      const supplierId = supplier.data.id

      // Create 2 orders
      await purchaseOrderService.createPurchaseOrder(venueId, {
        supplierId,
        orderDate: new Date().toISOString(),
        taxRate: 0.16,
        items: [],
      })
      await purchaseOrderService.createPurchaseOrder(venueId, {
        supplierId,
        orderDate: new Date().toISOString(),
        taxRate: 0.16,
        items: [],
      })

      const response = await purchaseOrderService.getPurchaseOrders(venueId)

      expect(response.success).toBe(true)
      expect(response.data).toHaveLength(2)
    })

    it('should update a purchase order', async () => {
      const supplier = await supplierService.createSupplier(venueId, { name: 'Supplier' })
      const supplierId = supplier.data.id

      const created = await purchaseOrderService.createPurchaseOrder(venueId, {
        supplierId,
        orderDate: new Date().toISOString(),
        taxRate: 0.16,
        items: [],
      })
      const poId = created.data.id

      const response = await purchaseOrderService.updatePurchaseOrder(venueId, poId, {
        notes: 'Updated notes',
      })

      expect(response.success).toBe(true)
      expect(response.data.notes).toBe('Updated notes')
    })
  })

  describe('Purchase Order Workflow', () => {
    it('should approve a purchase order', async () => {
      const supplier = await supplierService.createSupplier(venueId, { name: 'Supplier' })
      const supplierId = supplier.data.id

      const created = await purchaseOrderService.createPurchaseOrder(venueId, {
        supplierId,
        orderDate: new Date().toISOString(),
        taxRate: 0.16,
        items: [],
      })
      const poId = created.data.id

      const response = await purchaseOrderService.approvePurchaseOrder(venueId, poId)

      expect(response.success).toBe(true)
      expect(response.data.status).toBe('APPROVED')
    })

    it('should receive a purchase order', async () => {
      const supplier = await supplierService.createSupplier(venueId, { name: 'Supplier' })
      const supplierId = supplier.data.id

      const created = await purchaseOrderService.createPurchaseOrder(venueId, {
        supplierId,
        orderDate: new Date().toISOString(),
        taxRate: 0.16,
        items: [
          {
            rawMaterialId: 'rm_123',
            quantityOrdered: 50,
            unit: 'KILOGRAM' as any,
            unitPrice: 2.5,
          },
        ],
      })
      const poId = created.data.id
      const itemId = created.data.items[0].id

      const response = await purchaseOrderService.receivePurchaseOrder(venueId, poId, {
        items: [
          {
            purchaseOrderItemId: itemId,
            quantityReceived: 50,
          },
        ],
        partial: false,
      })

      expect(response.success).toBe(true)
      expect(response.data.status).toBe('RECEIVED')
    })

    it('should partially receive a purchase order', async () => {
      const supplier = await supplierService.createSupplier(venueId, { name: 'Supplier' })
      const supplierId = supplier.data.id

      const created = await purchaseOrderService.createPurchaseOrder(venueId, {
        supplierId,
        orderDate: new Date().toISOString(),
        taxRate: 0.16,
        items: [
          {
            rawMaterialId: 'rm_123',
            quantityOrdered: 50,
            unit: 'KILOGRAM' as any,
            unitPrice: 2.5,
          },
        ],
      })
      const poId = created.data.id
      const itemId = created.data.items[0].id

      const response = await purchaseOrderService.receivePurchaseOrder(venueId, poId, {
        items: [
          {
            purchaseOrderItemId: itemId,
            quantityReceived: 30, // Only 30 out of 50
          },
        ],
        partial: true,
      })

      expect(response.success).toBe(true)
      expect(response.data.status).toBe('PARTIALLY_RECEIVED')
    })

    it('should cancel a purchase order', async () => {
      const supplier = await supplierService.createSupplier(venueId, { name: 'Supplier' })
      const supplierId = supplier.data.id

      const created = await purchaseOrderService.createPurchaseOrder(venueId, {
        supplierId,
        orderDate: new Date().toISOString(),
        taxRate: 0.16,
        items: [],
      })
      const poId = created.data.id

      const response = await purchaseOrderService.cancelPurchaseOrder(venueId, poId, 'Out of stock')

      expect(response.success).toBe(true)
      expect(response.data.status).toBe('CANCELLED')
    })
  })

  describe('Edge Cases & Error Handling', () => {
    it('should return 404 for non-existent supplier', async () => {
      try {
        await supplierService.getSupplier(venueId, 'non-existent-id')
        expect.fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.response.status).toBe(404)
      }
    })

    it('should return 404 for non-existent purchase order', async () => {
      try {
        await purchaseOrderService.getPurchaseOrder(venueId, 'non-existent-id')
        expect.fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.response.status).toBe(404)
      }
    })

    it('should validate negative quantities', async () => {
      const supplier = await supplierService.createSupplier(venueId, { name: 'Supplier' })
      const supplierId = supplier.data.id

      // This should fail backend validation (to be tested in backend tests)
      // Frontend should also validate before sending
      const invalidOrder = {
        supplierId,
        orderDate: new Date().toISOString(),
        taxRate: 0.16,
        items: [
          {
            rawMaterialId: 'rm_123',
            quantityOrdered: -10, // Invalid
            unit: 'KILOGRAM' as any,
            unitPrice: 2.5,
          },
        ],
      }

      // This test documents expected behavior
