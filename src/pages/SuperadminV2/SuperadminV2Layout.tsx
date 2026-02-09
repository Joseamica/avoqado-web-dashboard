import React, { useState, useEffect, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import SuperadminV2Sidebar from './components/SuperadminV2Sidebar'
import SuperadminHeader from '../Superadmin/components/SuperadminHeader'
import SuperadminV2CommandPalette from './components/SuperadminV2CommandPalette'

const SuperadminV2Layout: React.FC = () => {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  const openCommandPalette = useCallback(() => {
    setCommandPaletteOpen(true)
  }, [])

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(prev => !prev)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className={cn('h-screen bg-card')}>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <SuperadminV2Sidebar onOpenCommandPalette={openCommandPalette} />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Header - reuse existing */}
          <SuperadminHeader />

          {/* Content */}
          <main className="flex-1 overflow-y-auto">
            <div className="p-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* Command Palette */}
      <SuperadminV2CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />
    </div>
  )
}

export default SuperadminV2Layout
