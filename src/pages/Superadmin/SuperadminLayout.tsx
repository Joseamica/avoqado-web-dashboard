import React from 'react'
import { Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import SuperadminSidebar from './components/SuperadminSidebar'
import SuperadminHeader from './components/SuperadminHeader'

const SuperadminLayout: React.FC = () => {
  return (
    <div className={cn('min-h-screen bg-card')}>
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <SuperadminSidebar />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
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
