import api from '@/api'
import type { Menu, MenuCategory, CreateMenuDto, UpdateMenuDto, CloneMenuDto, Product, ModifierGroup, Modifier } from '@/types'

// ==========================================
// MENU OPERATIONS
// ==========================================

/**
 * Get all menus for a venue
 */
export const getMenus = async (venueId: string): Promise<Menu[]> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/menus`)
  return response.data
}

/**
 * Get a single menu by ID
 */
export const getMenu = async (venueId: string, menuId: string): Promise<Menu> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/menus/${menuId}`)
  return response.data
}

/**
 * Create a new menu
 */
export const createMenu = async (venueId: string, menuData: CreateMenuDto): Promise<Menu> => {
  const response = await api.post(`/api/v1/dashboard/venues/${venueId}/menus`, menuData)
  return response.data
}

/**
 * Update an existing menu
 */
export const updateMenu = async (venueId: string, menuId: string, menuData: UpdateMenuDto): Promise<Menu> => {
  const response = await api.put(`/api/v1/dashboard/venues/${venueId}/menus/${menuId}`, menuData)
  return response.data
}

/**
 * Delete a menu
 */
export const deleteMenu = async (venueId: string, menuId: string): Promise<void> => {
  await api.delete(`/api/v1/dashboard/venues/${venueId}/menus/${menuId}`)
}

/**
 * Clone a menu
 */
export const cloneMenu = async (venueId: string, menuId: string, cloneData: CloneMenuDto): Promise<Menu> => {
  const response = await api.post(`/api/v1/dashboard/venues/${venueId}/menus/${menuId}/clone`, cloneData)
  return response.data
}

/**
 * Reorder menus by display order
 */
export const reorderMenus = async (venueId: string, menuIds: string[]): Promise<void> => {
  await api.put(`/api/v1/dashboard/venues/${venueId}/menus/reorder`, { menuIds })
}

/**
 * Assign a category to a menu
 */
export const assignCategoryToMenu = async (venueId: string, menuId: string, categoryId: string): Promise<void> => {
  await api.post(`/api/v1/dashboard/venues/${venueId}/menus/${menuId}/menucategories/${categoryId}`)
}

/**
 * Remove a category from a menu
 */
export const removeCategoryFromMenu = async (venueId: string, menuId: string, categoryId: string): Promise<void> => {
  await api.delete(`/api/v1/dashboard/venues/${venueId}/menus/${menuId}/menucategories/${categoryId}`)
}

// ==========================================
// MENU CATEGORIES OPERATIONS
// ==========================================

/**
 * Get all menu categories for a venue
 */
export const getMenuCategories = async (venueId: string): Promise<MenuCategory[]> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/menucategories`)
  return response.data
}

/**
 * Get a single menu category by ID
 */
export const getMenuCategory = async (venueId: string, categoryId: string): Promise<MenuCategory> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/menucategories/${categoryId}`)
  return response.data
}

/**
 * Create a new menu category
 */
export const createMenuCategory = async (venueId: string, categoryData: any): Promise<MenuCategory> => {
  const response = await api.post(`/api/v1/dashboard/venues/${venueId}/menucategories`, categoryData)
  return response.data
}

/**
 * Update an existing menu category
 */
export const updateMenuCategory = async (venueId: string, categoryId: string, categoryData: any): Promise<MenuCategory> => {
  const response = await api.patch(`/api/v1/dashboard/venues/${venueId}/menucategories/${categoryId}`, categoryData)
  return response.data
}

/**
 * Delete a menu category
 */
export const deleteMenuCategory = async (venueId: string, categoryId: string): Promise<void> => {
  await api.delete(`/api/v1/dashboard/venues/${venueId}/menucategories/${categoryId}`)
}

/**
 * Reorder menu categories
 */
export const reorderMenuCategories = async (venueId: string, categories: { id: string; displayOrder: number }[]): Promise<void> => {
  await api.put(`/api/v1/dashboard/venues/${venueId}/menucategories/reorder`, { categories })
}

// ===========================
// PRODUCT SERVICES
// ===========================

/**
 * Get all products for a venue
 */
export const getProducts = async (venueId: string): Promise<Product[]> => {
  const response = await api.get(`/api/v1/venues/${venueId}/products`)
  return (response.data?.data ?? response.data) as Product[]
}

/**
 * Get a specific product by ID
 */
export const getProduct = async (venueId: string, productId: string): Promise<Product> => {
  const response = await api.get(`/api/v1/venues/${venueId}/products/${productId}`)
  return (response.data?.data ?? response.data) as Product
}

/**
 * Create a new product
 */
export const createProduct = async (venueId: string, productData: any): Promise<Product> => {
  const response = await api.post(`/api/v1/venues/${venueId}/products`, productData)
  return (response.data?.data ?? response.data) as Product
}

/**
 * Update an existing product
 */
export const updateProduct = async (venueId: string, productId: string, productData: any): Promise<Product> => {
  const response = await api.put(`/api/v1/venues/${venueId}/products/${productId}`, productData)
  return (response.data?.data ?? response.data) as Product
}

/**
 * Delete a product
 */
export const deleteProduct = async (venueId: string, productId: string): Promise<void> => {
  await api.delete(`/api/v1/venues/${venueId}/products/${productId}`)
}

/**
 * Reorder products
 */
export const reorderProducts = async (venueId: string, products: { id: string; displayOrder: number }[]): Promise<void> => {
  await api.put(`/api/v1/dashboard/venues/${venueId}/products/reorder`, { products })
}

// ===========================
// MODIFIER GROUP SERVICES
// ===========================

/**
 * Get all modifier groups for a venue
 */
export const getModifierGroups = async (venueId: string): Promise<ModifierGroup[]> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/modifier-groups`)
  return response.data
}

/**
 * Get a specific modifier group by ID
 */
export const getModifierGroup = async (venueId: string, modifierGroupId: string): Promise<ModifierGroup> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/modifier-groups/${modifierGroupId}`)
  return response.data
}

/**
 * Create a new modifier group
 */
export const createModifierGroup = async (venueId: string, modifierGroupData: any): Promise<ModifierGroup> => {
  const response = await api.post(`/api/v1/dashboard/venues/${venueId}/modifier-groups`, modifierGroupData)
  return response.data
}

/**
 * Update an existing modifier group
 */
export const updateModifierGroup = async (venueId: string, modifierGroupId: string, modifierGroupData: any): Promise<ModifierGroup> => {
  const response = await api.put(`/api/v1/dashboard/venues/${venueId}/modifier-groups/${modifierGroupId}`, modifierGroupData)
  return response.data
}

/**
 * Delete a modifier group
 */
export const deleteModifierGroup = async (venueId: string, modifierGroupId: string): Promise<void> => {
  await api.delete(`/api/v1/dashboard/venues/${venueId}/modifier-groups/${modifierGroupId}`)
}

// ===========================
// MODIFIER SERVICES
// ===========================

/**
 * Get all modifiers for a modifier group
 */
export const getModifiers = async (venueId: string, modifierGroupId: string): Promise<Modifier[]> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/modifier-groups/${modifierGroupId}/modifiers`)
  return response.data
}

/**
 * Get a specific modifier by ID
 */
export const getModifier = async (venueId: string, modifierGroupId: string, modifierId: string): Promise<Modifier> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/modifier-groups/${modifierGroupId}/modifiers/${modifierId}`)
  return response.data
}

/**
 * Create a new modifier
 */
export const createModifier = async (venueId: string, modifierGroupId: string, modifierData: any): Promise<Modifier> => {
  const response = await api.post(`/api/v1/dashboard/venues/${venueId}/modifier-groups/${modifierGroupId}/modifiers`, modifierData)
  return response.data
}

/**
 * Update an existing modifier
 */
export const updateModifier = async (
  venueId: string,
  modifierGroupId: string,
  modifierId: string,
  modifierData: any,
): Promise<Modifier> => {
  const response = await api.put(
    `/api/v1/dashboard/venues/${venueId}/modifier-groups/${modifierGroupId}/modifiers/${modifierId}`,
    modifierData,
  )
  return response.data
}

/**
 * Delete a modifier
 */
export const deleteModifier = async (venueId: string, modifierGroupId: string, modifierId: string): Promise<void> => {
  await api.delete(`/api/v1/dashboard/venues/${venueId}/modifier-groups/${modifierGroupId}/modifiers/${modifierId}`)
}

// ===========================
// PRODUCT <-> MODIFIER GROUP ASSIGNMENTS
// ===========================

/**
 * Assign a modifier group to a product
 */
export const assignModifierGroupToProduct = async (
  venueId: string,
  productId: string,
  data: { modifierGroupId: string; displayOrder?: number },
): Promise<unknown> => {
  const response = await api.post(
    `/api/v1/dashboard/venues/${venueId}/products/${productId}/modifier-groups`,
    data,
  )
  return response.data
}

/**
 * Remove a modifier group from a product
 */
export const removeModifierGroupFromProduct = async (
  venueId: string,
  productId: string,
  modifierGroupId: string,
): Promise<void> => {
  await api.delete(
    `/api/v1/dashboard/venues/${venueId}/products/${productId}/modifier-groups/${modifierGroupId}`,
  )
}
