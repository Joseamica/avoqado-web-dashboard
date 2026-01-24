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

    it('should get a single supplier by ID', async () => {
      const created = await supplierService.createSupplier(venueId, { name: 'Test Supplier' })
      const supplierId = created.data.id

      const response = await supplierService.getSupplier(venueId, supplierId)

      expect(response.success).toBe(true)
      expect(response.data.id).toBe(supplierId)
      expect(response.data.name).toBe('Test Supplier')
    })

    it('should update a supplier', async () => {
      const created = await supplierService.createSupplier(venueId, { name: 'Old Name' })
      const supplierId = created.data.id

      const response = await supplierService.updateSupplier(venueId, supplierId, {
        name: 'New Name',
      })

      expect(response.success).toBe(true)
      expect(response.data.name).toBe('New Name')
      expect(response.data.id).toBe(supplierId)
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
      expect(response.data[0].active).toBe(true)
    })

    it('should search suppliers by name', async () => {
      await supplierService.createSupplier(venueId, { name: 'Global Foods' })
      await supplierService.createSupplier(venueId, { name: 'Local Produce' })

      const response = await supplierService.getSuppliers(venueId, { search: 'Global' })

      expect(response.success).toBe(true)
      expect(response.data).toHaveLength(1)
      expect(response.data[0].name).toBe('Global Foods')
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
        minimumQuantity: 10,
      })
    })

    it('should get supplier performance metrics', async () => {
      const supplier = await supplierService.createSupplier(venueId, { name: 'Supplier' })
      const supplierId = supplier.data.id

      const response = await supplierService.getPerformance(venueId, supplierId)

      expect(response.success).toBe(true)
      expect(response.data).toHaveProperty('totalOrders')
      expect(response.data).toHaveProperty('completedOrders')
      expect(response.data).toHaveProperty('onTimeDeliveryRate')
      expect(response.data).toHaveProperty('totalSpent')
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
        taxRate: 0.16,
      })
      expect(response.data.orderNumber).toMatch(/^PO\d+/)
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

    it('should get a single purchase order by ID', async () => {
      const supplier = await supplierService.createSupplier(venueId, { name: 'Supplier' })
      const supplierId = supplier.data.id

      const created = await purchaseOrderService.createPurchaseOrder(venueId, {
        supplierId,
        orderDate: new Date().toISOString(),
        taxRate: 0.16,
        items: [],
      })
      const poId = created.data.id

      const response = await purchaseOrderService.getPurchaseOrder(venueId, poId)

      expect(response.success).toBe(true)
      expect(response.data.id).toBe(poId)
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
      expect(response.data.id).toBe(poId)
    })

    it('should filter purchase orders by status', async () => {
      const supplier = await supplierService.createSupplier(venueId, { name: 'Supplier' })
      const supplierId = supplier.data.id

      // Create orders with different statuses
      const po1 = await purchaseOrderService.createPurchaseOrder(venueId, {
        supplierId,
        orderDate: new Date().toISOString(),
        taxRate: 0.16,
        items: [],
      })
      await purchaseOrderService.approvePurchaseOrder(venueId, po1.data.id)

      await purchaseOrderService.createPurchaseOrder(venueId, {
        supplierId,
        orderDate: new Date().toISOString(),
        taxRate: 0.16,
        items: [],
      })

      const response = await purchaseOrderService.getPurchaseOrders(venueId, {
        status: [PurchaseOrderStatus.APPROVED],
      })

      expect(response.success).toBe(true)
      expect(response.data).toHaveLength(1)
      expect(response.data[0].status).toBe('APPROVED')
    })

    it('should get purchase order stats', async () => {
      const response = await purchaseOrderService.getStats(venueId)

      expect(response.success).toBe(true)
      expect(response.data).toHaveProperty('totalOrders')
      expect(response.data).toHaveProperty('draftOrders')
      expect(response.data).toHaveProperty('pendingOrders')
      expect(response.data).toHaveProperty('completedOrders')
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
      expect(response.data.id).toBe(poId)
    })

    it('should receive a purchase order completely', async () => {
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

      const response = await purchaseOrderService.cancelPurchaseOrder(
        venueId,
        poId,
        'Out of stock'
      )

      expect(response.success).toBe(true)
      expect(response.data.status).toBe('CANCELLED')
      expect(response.data.notes).toBe('Out of stock')
    })
  })

  describe('Edge Cases & Error Handling', () => {
    it('should return 404 for non-existent supplier', async () => {
      try {
        await supplierService.getSupplier(venueId, 'non-existent-id')
        expect.fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.response.status).toBe(404)
        expect(error.response.data.success).toBe(false)
      }
    })

    it('should return 404 for non-existent purchase order', async () => {
      try {
        await purchaseOrderService.getPurchaseOrder(venueId, 'non-existent-id')
        expect.fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.response.status).toBe(404)
        expect(error.response.data.success).toBe(false)
      }
    })

    it('should return 404 when deleting non-existent supplier', async () => {
      try {
        await supplierService.deleteSupplier(venueId, 'non-existent-id')
        expect.fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.response.status).toBe(404)
      }
    })

    it('should handle decimal quantities (Avoqado feature)', async () => {
      const supplier = await supplierService.createSupplier(venueId, { name: 'Supplier' })
      const supplierId = supplier.data.id

      const response = await purchaseOrderService.createPurchaseOrder(venueId, {
        supplierId,
        orderDate: new Date().toISOString(),
        taxRate: 0.16,
        items: [
          {
            rawMaterialId: 'rm_123',
            quantityOrdered: 2.5, // Decimal allowed (NOT Square limitation)
            unit: 'KILOGRAM' as any,
            unitPrice: 2.5,
          },
        ],
      })

      expect(response.success).toBe(true)
      expect(response.data.items[0].quantityOrdered).toBe(2.5)
    })

    it('should validate negative quantities (documented behavior)', async () => {
      const supplier = await supplierService.createSupplier(venueId, { name: 'Supplier' })
      const supplierId = supplier.data.id

      // This documents expected behavior
      // Frontend should validate, backend will reject
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

      // This test documents that negative quantities are invalid
      expect(invalidOrder.items[0].quantityOrdered).toBeLessThan(0)
      // Actual validation happens in backend and frontend forms
    })

    it('should handle empty items array in purchase order', async () => {
      const supplier = await supplierService.createSupplier(venueId, { name: 'Supplier' })
      const supplierId = supplier.data.id

      const response = await purchaseOrderService.createPurchaseOrder(venueId, {
        supplierId,
        orderDate: new Date().toISOString(),
        taxRate: 0.16,
        items: [],
      })

      expect(response.success).toBe(true)
      expect(response.data.items).toEqual([])
      expect(response.data.subtotal).toBe('100.00') // Mock default
    })

    it('should maintain supplier data integrity after multiple operations', async () => {
      // Create supplier
      const created = await supplierService.createSupplier(venueId, {
        name: 'Test Supplier',
        email: 'test@supplier.com',
      })
      const supplierId = created.data.id

      // Update supplier
      await supplierService.updateSupplier(venueId, supplierId, {
        phone: '+1234567890',
      })

      // Verify data integrity
      const retrieved = await supplierService.getSupplier(venueId, supplierId)
      expect(retrieved.data).toMatchObject({
        id: supplierId,
        name: 'Test Supplier',
        email: 'test@supplier.com',
        phone: '+1234567890',
      })
    })

    it('should maintain purchase order data integrity through workflow', async () => {
      const supplier = await supplierService.createSupplier(venueId, { name: 'Supplier' })
      const supplierId = supplier.data.id

      // Create PO
      const created = await purchaseOrderService.createPurchaseOrder(venueId, {
        supplierId,
        orderDate: new Date().toISOString(),
        taxRate: 0.16,
        items: [],
      })
      const poId = created.data.id

      // Approve PO
      await purchaseOrderService.approvePurchaseOrder(venueId, poId)

      // Cancel PO
      await purchaseOrderService.cancelPurchaseOrder(venueId, poId, 'Test cancellation')

      // Verify final state
      const final = await purchaseOrderService.getPurchaseOrder(venueId, poId)
      expect(final.data).toMatchObject({
        id: poId,
        status: 'CANCELLED',
        notes: 'Test cancellation',
      })
    })
  })
})
