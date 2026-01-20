import React from 'react'
import { Outlet } from 'react-router-dom'

export default function InventoryLayout() {
  return (
    <div className="pb-4 bg-background min-h-[calc(100vh-4rem)]">
      <Outlet />
    </div>
  )
}
