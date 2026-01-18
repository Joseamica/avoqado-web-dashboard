// src/services/menuImport.service.ts

import api from '@/api'
import Papa from 'papaparse'

export interface BasicCSVRow {
  name: string
  sku: string
  price: string
  category: string
  description?: string
  type?: string
}

export interface AdvancedCSVRow extends BasicCSVRow {
  cost?: string
  tags?: string
  allergens?: string
  track_inventory?: string
  unit?: string
  current_stock?: string
  min_stock?: string
  modifier_groups?: string
  modifiers?: string
}

export interface ParsedCategory {
  name: string
  slug: string
  products: ParsedProduct[]
}

export interface ParsedProduct {
  name: string
  sku: string
  price: number
  cost?: number
  description?: string
  type: 'FOOD' | 'BEVERAGE' | 'ALCOHOL' | 'RETAIL' | 'SERVICE'
  tags?: string[]
  allergens?: string[]
  trackInventory?: boolean
  unit?: string
  currentStock?: number
  minStock?: number
  modifierGroups?: ParsedModifierGroup[]
}

export interface ParsedModifierGroup {
  name: string
  required: boolean
  allowMultiple: boolean
  minSelections: number
  maxSelections: number | null
  modifiers: ParsedModifier[]
}

export interface ParsedModifier {
  name: string
  price: number
}

export interface ImportResult {
  success: boolean
  message: string
  stats?: {
    categories: number
    products: number
    modifierGroups: number
    modifiers: number
  }
  errors?: string[]
}

/**
 * Parse CSV file and return structured data
 */
export function parseCSV(file: File): Promise<{ data: AdvancedCSVRow[]; isAdvanced: boolean }> {
  return new Promise((resolve, reject) => {
    Papa.parse<AdvancedCSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      complete: results => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`))
          return
        }

        if (!results.data || results.data.length === 0) {
          reject(new Error('CSV file is empty'))
          return
        }

        // Detect if it's advanced or basic template
        const firstRow = results.data[0]
        const isAdvanced = 'modifier_groups' in firstRow || 'modifiers' in firstRow || 'cost' in firstRow

        resolve({ data: results.data, isAdvanced })
      },
      error: error => {
        reject(new Error(`Failed to parse CSV: ${error.message}`))
      },
    })
  })
}

/**
 * Parse CSV strictly for preview/mapping purposes
 */
export function previewCSV(file: File): Promise<{ headers: string[]; data: any[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      preview: 5, // Only read first 5 rows for preview
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      complete: results => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`))
          return
        }
        if (!results.meta.fields) {
          reject(new Error('Could not parse CSV headers'))
          return
        }
        resolve({ headers: results.meta.fields, data: results.data })
      },
      error: error => {
        reject(new Error(`Failed to parse CSV: ${error.message}`))
      },
    })
  })
}

/**
 * Full parse of raw CSV data
 */
export function parseRawCSV(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      complete: results => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`))
          return
        }
        resolve(results.data)
      },
      error: error => {
        reject(new Error(`Failed to parse CSV: ${error.message}`))
      },
    })
  })
}

export const SYSTEM_FIELDS = [
  { key: 'name', label: 'Product Name', required: true, description: 'The name of the item' },
  { key: 'sku', label: 'SKU', required: true, description: 'Unique identifier code' },
  { key: 'price', label: 'Price', required: true, description: 'Selling price' },
  { key: 'category', label: 'Category', required: true, description: 'Menu category' },
  { key: 'description', label: 'Description', required: false, description: 'Item details' },
  { key: 'type', label: 'Type', required: false, description: 'FOOD, BEVERAGE, etc.' },
  { key: 'cost', label: 'Cost', required: false, description: 'Item cost' },
  { key: 'tags', label: 'Tags', required: false, description: 'Pipe separated tags' },
  { key: 'modifier_groups', label: 'Modifier Groups', required: false, description: 'Complex modifier string' },
  { key: 'modifiers', label: 'Modifiers', required: false, description: 'Complex modifiers string' },
] as const

/**
 * Remap raw CSV data to System format based on user mapping
 */
export function remapData(rawData: any[], mapping: Record<string, string>): AdvancedCSVRow[] {
  return rawData.map(row => {
    const newRow: any = {}
    Object.entries(mapping).forEach(([systemKey, csvHeader]) => {
      if (csvHeader && row[csvHeader] !== undefined) {
        newRow[systemKey] = row[csvHeader]
      }
    })
    return newRow as AdvancedCSVRow
  })
}

/**
 * Validate CSV structure
 */
export function validateCSV(data: AdvancedCSVRow[]): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Required fields for all templates
  const requiredFields = ['name', 'sku', 'price', 'category']

  // Track SKUs to detect duplicates within the CSV
  const skuMap = new Map<string, number>()

  data.forEach((row, index) => {
    const rowNum = index + 2 // +2 because index starts at 0 and we skip header

    // Check required fields
    requiredFields.forEach(field => {
      if (!row[field as keyof AdvancedCSVRow]) {
        errors.push(`Row ${rowNum}: Missing required field '${field}'`)
      }
    })

    // Check for duplicate SKUs within the CSV
    if (row.sku) {
      const sku = row.sku.trim()
      if (skuMap.has(sku)) {
        errors.push(`Row ${rowNum}: Duplicate SKU '${sku}' (already found in row ${skuMap.get(sku)})`)
      } else {
        skuMap.set(sku, rowNum)
      }
    }

    // Validate price is a number
    if (row.price && isNaN(parseFloat(row.price))) {
      errors.push(`Row ${rowNum}: Invalid price '${row.price}'`)
    }

    // Validate cost if present
    if (row.cost && isNaN(parseFloat(row.cost))) {
      errors.push(`Row ${rowNum}: Invalid cost '${row.cost}'`)
    }

    // Validate stock if present
    if (row.current_stock && isNaN(parseInt(row.current_stock))) {
      errors.push(`Row ${rowNum}: Invalid current_stock '${row.current_stock}'`)
    }

    if (row.min_stock && isNaN(parseInt(row.min_stock))) {
      errors.push(`Row ${rowNum}: Invalid min_stock '${row.min_stock}'`)
    }
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Parse modifier groups from Advanced CSV format
 * Format: "Size:required:false:1:1|Toppings:optional:true:0:5"
 */
function parseModifierGroups(modifierGroupsStr: string, modifiersStr: string): ParsedModifierGroup[] {
  if (!modifierGroupsStr || !modifiersStr) return []

  const groups = modifierGroupsStr.split('|').map(g => g.trim())
  const modifiersByGroup = modifiersStr.split('|').map(m => m.trim())

  return groups.map((groupStr, index) => {
    const [name, requiredStr, allowMultipleStr, minStr, maxStr] = groupStr.split(':')

    // Parse modifiers for this group
    // Format: "Size>Small:0.00>Medium:2.00>Large:4.00"
    const groupModifiersStr = modifiersByGroup[index] || ''
    const [, ...modifierParts] = groupModifiersStr.split('>') // Skip group name, we already have it

    const modifiers: ParsedModifier[] = modifierParts.map(modStr => {
      const [modName, priceStr] = modStr.split(':')
      return {
        name: modName.trim(),
        price: parseFloat(priceStr) || 0,
      }
    })

    return {
      name: name.trim(),
      required: requiredStr === 'required',
      allowMultiple: allowMultipleStr === 'true',
      minSelections: parseInt(minStr) || 0,
      maxSelections: maxStr ? parseInt(maxStr) : null,
      modifiers,
    }
  })
}

/**
 * Transform CSV data to structured categories and products
 */
export function transformCSVData(data: AdvancedCSVRow[], isAdvanced: boolean): ParsedCategory[] {
  const categoriesMap = new Map<string, ParsedCategory>()

  data.forEach(row => {
    const categoryName = row.category.trim()
    const categorySlug = categoryName.toLowerCase().replace(/\s+/g, '-')

    // Get or create category
    if (!categoriesMap.has(categorySlug)) {
      categoriesMap.set(categorySlug, {
        name: categoryName,
        slug: categorySlug,
        products: [],
      })
    }

    const category = categoriesMap.get(categorySlug)!

    // Validate and parse product type
    const validTypes = ['FOOD', 'BEVERAGE', 'ALCOHOL', 'RETAIL', 'SERVICE'] as const
    const rawType = row.type?.trim().toUpperCase() || 'FOOD'
    const productType = validTypes.includes(rawType as any) ? (rawType as typeof validTypes[number]) : 'FOOD'

    // Parse product
    const product: ParsedProduct = {
      name: row.name.trim(),
      sku: row.sku.trim(),
      price: parseFloat(row.price) || 0,
      description: row.description?.trim() || '',
      type: productType,
    }

    // Add advanced fields if present
    if (isAdvanced) {
      if (row.cost) product.cost = parseFloat(row.cost)
      if (row.tags) product.tags = row.tags.split('|').map(t => t.trim())
      if (row.allergens) product.allergens = row.allergens.split('|').map(a => a.trim())
      if (row.track_inventory) product.trackInventory = row.track_inventory.toLowerCase() === 'true'
      if (row.unit) product.unit = row.unit.trim()
      if (row.current_stock) product.currentStock = parseInt(row.current_stock)
      if (row.min_stock) product.minStock = parseInt(row.min_stock)

      // Parse modifier groups
      if (row.modifier_groups && row.modifiers) {
        product.modifierGroups = parseModifierGroups(row.modifier_groups, row.modifiers)
      }
    }

    category.products.push(product)
  })

  return Array.from(categoriesMap.values())
}

/**
 * Import menu to backend
 */
export async function importMenu(
  venueId: string,
  categories: ParsedCategory[],
  mode: 'merge' | 'replace' = 'merge',
): Promise<ImportResult> {
  try {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/menu/import`, {
      mode,
      categories,
    })

    return response.data
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to import menu')
  }
}

/**
 * Download template file
 */
export function downloadTemplate(type: 'basic' | 'advanced') {
  const filename = type === 'basic' ? 'menu-template-basic.csv' : 'menu-template-advanced.csv'
  const link = document.createElement('a')
  link.href = `/templates/${filename}`
  link.download = filename
  link.click()
}

/**
 * Export current menu to CSV
 */
export async function exportCurrentMenu(
  venueId: string,
  categories: any[],
  products: any[],
  modifierGroups: any[],
  type: 'basic' | 'advanced',
) {
  // Group products by category
  const productsByCategory = new Map<string, any[]>()
  products.forEach(product => {
    if (!productsByCategory.has(product.categoryId)) {
      productsByCategory.set(product.categoryId, [])
    }
    productsByCategory.get(product.categoryId)!.push(product)
  })

  const rows: string[][] = []

  if (type === 'basic') {
    // Basic template header
    rows.push(['name', 'sku', 'price', 'category', 'description', 'type'])

    // Add products grouped by category
    categories.forEach(category => {
      const categoryProducts = productsByCategory.get(category.id) || []
      categoryProducts.forEach(product => {
        rows.push([
          product.name,
          product.sku,
          Number(product.price).toFixed(2),
          category.name,
          product.description || '',
          product.type || 'FOOD',
        ])
      })
    })
  } else {
    // Advanced template header
    rows.push([
      'name',
      'sku',
      'price',
      'cost',
      'category',
      'description',
      'type',
      'tags',
      'allergens',
      'track_inventory',
      'unit',
      'current_stock',
      'min_stock',
      'modifier_groups',
      'modifiers',
    ])

    // Add products with full details
    categories.forEach(category => {
      const categoryProducts = productsByCategory.get(category.id) || []
      categoryProducts.forEach(product => {
        // Get modifier groups for this product
        const productModifierGroups = product.modifierGroups || []
        let modifierGroupsStr = ''
        let modifiersStr = ''

        if (productModifierGroups.length > 0) {
          // Format: "Size:required:false:1:1|Toppings:optional:true:0:5"
          modifierGroupsStr = productModifierGroups
            .map((pmg: any) => {
              const group = modifierGroups.find(mg => mg.id === pmg.groupId)
              if (!group) return ''
              return `${group.name}:${group.required ? 'required' : 'optional'}:${group.allowMultiple}:${group.minSelections}:${group.maxSelections || ''}`
            })
            .filter(Boolean)
            .join('|')

          // Format: "Size>Small:0.00>Medium:2.00|Toppings>Cheese:1.50>Bacon:2.00"
          modifiersStr = productModifierGroups
            .map((pmg: any) => {
              const group = modifierGroups.find(mg => mg.id === pmg.groupId)
              if (!group) return ''
              const modifiersForGroup = group.modifiers
                .map((mod: any) => `${mod.name}:${Number(mod.price).toFixed(2)}`)
                .join('>')
              return `${group.name}>${modifiersForGroup}`
            })
            .filter(Boolean)
            .join('|')
        }

        rows.push([
          product.name,
          product.sku,
          Number(product.price).toFixed(2),
          product.cost ? Number(product.cost).toFixed(2) : '',
          category.name,
          product.description || '',
          product.type || 'FOOD',
          (product.tags || []).join('|'),
          (product.allergens || []).join('|'),
          product.inventory ? 'true' : 'false',
          '', // unit - not stored in product
          product.inventory?.currentStock?.toString() || '',
          product.inventory?.minimumStock?.toString() || '',
          modifierGroupsStr,
          modifiersStr,
        ])
      })
    })
  }

  // Convert to CSV string
  const csvContent = rows
    .map(row =>
      row
        .map(cell => {
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          const cellStr = String(cell)
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`
          }
          return cellStr
        })
        .join(','),
    )
    .join('\n')

  // Download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  const date = new Date().toISOString().split('T')[0]
  const filename = `menu-export-${type}-${date}.csv`

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
