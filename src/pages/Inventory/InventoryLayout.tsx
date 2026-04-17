import { Outlet } from 'react-router-dom'
import { useAutoLaunchWelcomeTour } from '@/hooks/useAutoLaunchWelcomeTour'

export default function InventoryLayout() {
  useAutoLaunchWelcomeTour()

  // InventorySetupChecklist moved to dashboard.tsx header so it's visible on
  // every page (not just /inventory/*) and doesn't collide with floating
  // elements like PaymentSetupAlert and DataTable pagination.
  return (
    <div className="pb-4 bg-background min-h-[calc(100vh-4rem)]">
      <Outlet />
    </div>
  )
}
