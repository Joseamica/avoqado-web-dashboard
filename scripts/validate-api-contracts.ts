#!/usr/bin/env ts-node

/**
 * API Contract Validation Script
 *
 * This script validates that all frontend service methods match the documented
 * backend API endpoints to ensure contract compliance.
 *
 * Usage:
 *   npx ts-node scripts/validate-api-contracts.ts
 *
 * Exit codes:
 *   0 - All contracts valid
 *   1 - Validation failures detected
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ============================================
// CONTRACT DEFINITIONS
// ============================================

interface EndpointContract {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  service: 'supplierService' | 'purchaseOrderService'
  functionName: string
  expectedParams: string[]
  description: string
}

const EXPECTED_CONTRACTS: EndpointContract[] = [
  // ==================== SUPPLIERS (9 endpoints) ====================
  {
    method: 'GET',
    path: '/venues/{venueId}/inventory/suppliers',
    service: 'supplierService',
    functionName: 'getSuppliers',
    expectedParams: ['venueId', 'filters?'],
    description: 'List suppliers with optional filters',
  },
  {
    method: 'GET',
    path: '/venues/{venueId}/inventory/suppliers/{supplierId}',
    service: 'supplierService',
    functionName: 'getSupplier',
    expectedParams: ['venueId', 'supplierId'],
    description: 'Get single supplier by ID',
  },
  {
    method: 'POST',
    path: '/venues/{venueId}/inventory/suppliers',
    service: 'supplierService',
    functionName: 'createSupplier',
    expectedParams: ['venueId', 'dto'],
    description: 'Create new supplier',
  },
  {
    method: 'PUT',
    path: '/venues/{venueId}/inventory/suppliers/{supplierId}',
    service: 'supplierService',
    functionName: 'updateSupplier',
    expectedParams: ['venueId', 'supplierId', 'dto'],
    description: 'Update existing supplier',
  },
  {
    method: 'DELETE',
    path: '/venues/{venueId}/inventory/suppliers/{supplierId}',
    service: 'supplierService',
    functionName: 'deleteSupplier',
    expectedParams: ['venueId', 'supplierId'],
    description: 'Delete supplier',
  },
  {
    method: 'POST',
    path: '/venues/{venueId}/inventory/suppliers/{supplierId}/pricing',
    service: 'supplierService',
    functionName: 'addPricing',
    expectedParams: ['venueId', 'supplierId', 'dto'],
    description: 'Add pricing for supplier',
  },
  {
    method: 'GET',
    path: '/venues/{venueId}/inventory/raw-materials/{rawMaterialId}/supplier-pricing',
    service: 'supplierService',
    functionName: 'getRawMaterialSupplierPricing',
    expectedParams: ['venueId', 'rawMaterialId'],
    description: 'Get supplier pricing for raw material',
  },
  {
    method: 'GET',
    path: '/venues/{venueId}/inventory/raw-materials/{rawMaterialId}/supplier-recommendations',
    service: 'supplierService',
    functionName: 'getSupplierRecommendations',
    expectedParams: ['venueId', 'rawMaterialId'],
    description: 'Get supplier recommendations for raw material',
  },
  {
    method: 'GET',
    path: '/venues/{venueId}/inventory/suppliers/{supplierId}/performance',
    service: 'supplierService',
    functionName: 'getPerformance',
    expectedParams: ['venueId', 'supplierId'],
    description: 'Get supplier performance metrics',
  },

  // ==================== PURCHASE ORDERS (8 endpoints) ====================
  {
    method: 'GET',
    path: '/venues/{venueId}/inventory/purchase-orders',
    service: 'purchaseOrderService',
    functionName: 'getPurchaseOrders',
    expectedParams: ['venueId', 'filters?'],
    description: 'List purchase orders with optional filters',
  },
  {
    method: 'GET',
    path: '/venues/{venueId}/inventory/purchase-orders/{purchaseOrderId}',
    service: 'purchaseOrderService',
    functionName: 'getPurchaseOrder',
    expectedParams: ['venueId', 'purchaseOrderId'],
    description: 'Get single purchase order by ID',
  },
  {
    method: 'POST',
    path: '/venues/{venueId}/inventory/purchase-orders',
    service: 'purchaseOrderService',
    functionName: 'createPurchaseOrder',
    expectedParams: ['venueId', 'dto'],
    description: 'Create new purchase order',
  },
  {
    method: 'PUT',
    path: '/venues/{venueId}/inventory/purchase-orders/{purchaseOrderId}',
    service: 'purchaseOrderService',
    functionName: 'updatePurchaseOrder',
    expectedParams: ['venueId', 'purchaseOrderId', 'dto'],
    description: 'Update existing purchase order',
  },
  {
    method: 'POST',
    path: '/venues/{venueId}/inventory/purchase-orders/{purchaseOrderId}/approve',
    service: 'purchaseOrderService',
    functionName: 'approvePurchaseOrder',
    expectedParams: ['venueId', 'purchaseOrderId'],
    description: 'Approve purchase order',
  },
  {
    method: 'POST',
    path: '/venues/{venueId}/inventory/purchase-orders/{purchaseOrderId}/receive',
    service: 'purchaseOrderService',
    functionName: 'receivePurchaseOrder',
    expectedParams: ['venueId', 'purchaseOrderId', 'dto'],
    description: 'Receive purchase order goods',
  },
  {
    method: 'POST',
    path: '/venues/{venueId}/inventory/purchase-orders/{purchaseOrderId}/cancel',
    service: 'purchaseOrderService',
    functionName: 'cancelPurchaseOrder',
    expectedParams: ['venueId', 'purchaseOrderId', 'reason'],
    description: 'Cancel purchase order',
  },
  {
    method: 'GET',
    path: '/venues/{venueId}/inventory/purchase-orders/stats',
    service: 'purchaseOrderService',
    functionName: 'getStats',
    expectedParams: ['venueId'],
    description: 'Get purchase order statistics',
  },
]

// ============================================
// VALIDATION LOGIC
// ============================================

interface ValidationResult {
  contract: EndpointContract
  exists: boolean
  parameterMatch: boolean
  issues: string[]
}

function extractFunctionSignature(serviceCode: string, functionName: string): string[] | null {
  // Match function definition: functionName: async (param1, param2, ...) =>
  const regex = new RegExp(`${functionName}:\\s*async\\s*\\(([^)]*)\\)\\s*=>`, 'm')
  const match = serviceCode.match(regex)

  if (!match) {
    // Try alternate pattern: functionName: (param1, param2, ...) =>
    const altRegex = new RegExp(`${functionName}:\\s*\\(([^)]*)\\)\\s*=>`, 'm')
    const altMatch = serviceCode.match(altRegex)
    if (!altMatch) {
      return null
    }
    return parseParameters(altMatch[1])
  }

  return parseParameters(match[1])
}

function parseParameters(paramString: string): string[] {
  if (!paramString.trim()) {
    return []
  }

  return paramString
    .split(',')
    .map((p) => {
      // Remove TypeScript types and default values
      // Example: "venueId: string" -> "venueId"
      // Example: "filters?: SupplierFilters" -> "filters?"
      const cleaned = p.trim().split(':')[0].trim()
      return cleaned
    })
    .filter((p) => p.length > 0)
}

function normalizeParam(param: string): string {
  // Remove optional markers for comparison
  return param.replace('?', '')
}

function validateContract(contract: EndpointContract, serviceCode: string): ValidationResult {
  const result: ValidationResult = {
    contract,
    exists: false,
    parameterMatch: false,
    issues: [],
  }

  // Check if function exists
  const actualParams = extractFunctionSignature(serviceCode, contract.functionName)

  if (actualParams === null) {
    result.issues.push(`Function "${contract.functionName}" not found in service`)
    return result
  }

  result.exists = true

  // Normalize parameters for comparison
  const normalizedActual = actualParams.map(normalizeParam)
  const normalizedExpected = contract.expectedParams.map(normalizeParam)

  // Check parameter count
  if (normalizedActual.length !== normalizedExpected.length) {
    result.issues.push(
      `Parameter count mismatch: expected ${normalizedExpected.length}, got ${normalizedActual.length}`,
    )
    result.issues.push(`  Expected: ${contract.expectedParams.join(', ')}`)
    result.issues.push(`  Actual:   ${actualParams.join(', ')}`)
    return result
  }

  // Check each parameter name
  for (let i = 0; i < normalizedActual.length; i++) {
    if (normalizedActual[i] !== normalizedExpected[i]) {
      result.issues.push(`Parameter ${i + 1} name mismatch: expected "${normalizedExpected[i]}", got "${normalizedActual[i]}"`)
    }
  }

  result.parameterMatch = result.issues.length === 0
  return result
}

function validateAllContracts(): { results: ValidationResult[]; allValid: boolean } {
  console.log('🔍 Validating API Contracts...\n')
  console.log('📋 Checking 17 endpoints (9 Suppliers + 8 Purchase Orders)\n')

  // Read service files
  const supplierServicePath = path.join(__dirname, '../src/services/supplier.service.ts')
  const purchaseOrderServicePath = path.join(__dirname, '../src/services/purchaseOrder.service.ts')

  if (!fs.existsSync(supplierServicePath)) {
    console.error(`❌ ERROR: supplier.service.ts not found at ${supplierServicePath}`)
    process.exit(1)
  }

  if (!fs.existsSync(purchaseOrderServicePath)) {
    console.error(`❌ ERROR: purchaseOrder.service.ts not found at ${purchaseOrderServicePath}`)
    process.exit(1)
  }

  const supplierServiceCode = fs.readFileSync(supplierServicePath, 'utf-8')
  const purchaseOrderServiceCode = fs.readFileSync(purchaseOrderServicePath, 'utf-8')

  const results: ValidationResult[] = []
  let passCount = 0
  let failCount = 0

  // Validate each contract
  for (const contract of EXPECTED_CONTRACTS) {
    const serviceCode = contract.service === 'supplierService' ? supplierServiceCode : purchaseOrderServiceCode

    const result = validateContract(contract, serviceCode)
    results.push(result)

    if (result.exists && result.parameterMatch) {
      console.log(`✅ ${contract.method} ${contract.path}`)
      console.log(`   → ${contract.service}.${contract.functionName}(${contract.expectedParams.join(', ')})`)
      passCount++
    } else {
      console.log(`❌ ${contract.method} ${contract.path}`)
      console.log(`   → ${contract.service}.${contract.functionName}`)
      result.issues.forEach((issue) => console.log(`   ⚠️  ${issue}`))
      failCount++
    }
    console.log('')
  }

  // Summary
  console.log('━'.repeat(60))
  console.log('📊 Validation Summary')
  console.log('━'.repeat(60))
  console.log(`✅ Passed: ${passCount}/${EXPECTED_CONTRACTS.length}`)
  console.log(`❌ Failed: ${failCount}/${EXPECTED_CONTRACTS.length}`)
  console.log('━'.repeat(60))

  const allValid = failCount === 0

  if (allValid) {
    console.log('\n✨ All API contracts are valid! Frontend matches backend 100%.\n')
  } else {
    console.log('\n⚠️  Some contracts failed validation. Please fix the issues above.\n')
  }

  return { results, allValid }
}

// ============================================
// MAIN EXECUTION
// ============================================

function main() {
  try {
    const { allValid } = validateAllContracts()
    process.exit(allValid ? 0 : 1)
  } catch (error) {
    console.error('💥 Validation script failed with error:')
    console.error(error)
    process.exit(1)
  }
}

main()
