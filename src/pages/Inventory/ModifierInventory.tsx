/**
 * Modifier Inventory Page
 *
 * Displays modifier inventory analytics including:
 * - Usage statistics
 * - Low stock alerts
 * - Cost impact analysis
 */

import { ModifierInventoryAnalytics } from './components/ModifierInventoryAnalytics'

export default function ModifierInventory() {
  return (
    <div className="p-4 space-y-6">
      <ModifierInventoryAnalytics />
    </div>
  )
}
