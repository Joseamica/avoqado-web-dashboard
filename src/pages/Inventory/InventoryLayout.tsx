import { Outlet } from 'react-router-dom'
import { InventorySetupChecklist } from '@/components/onboarding/InventorySetupChecklist'
import { useAutoLaunchWelcomeTour } from '@/hooks/useAutoLaunchWelcomeTour'

export default function InventoryLayout() {
  useAutoLaunchWelcomeTour()

  return (
    <div className="pb-4 bg-background min-h-[calc(100vh-4rem)]">
      <Outlet />
      <InventorySetupChecklist />
    </div>
  )
}
