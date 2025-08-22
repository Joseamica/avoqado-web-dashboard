import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import SuperadminSidebar from './components/SuperadminSidebar'
import SuperadminHeader from './components/SuperadminHeader'

const SuperadminLayout: React.FC = () => {
  const location = useLocation()

  return (
    <div className={cn('min-h-screen bg-background')}>
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <SuperadminSidebar />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <SuperadminHeader />

          {/* Content */}
          <main className="flex-1 overflow-y-auto">
            <div className="p-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default SuperadminLayout