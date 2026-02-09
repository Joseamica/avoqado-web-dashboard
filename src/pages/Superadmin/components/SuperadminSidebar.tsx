import React, { useState, useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Shield, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getSuperadminNavigation } from '../constants/navigation'

interface SuperadminSidebarProps {
  onOpenCommandPalette?: () => void
}

const SuperadminSidebar: React.FC<SuperadminSidebarProps> = ({ onOpenCommandPalette }) => {
  const { t } = useTranslation('superadmin')
  const { t: tSidebar } = useTranslation('sidebar')
  const [filterTerm, setFilterTerm] = useState('')

  const navigationItems = useMemo(() => getSuperadminNavigation(tSidebar), [tSidebar])

  const filteredSections = useMemo(() => {
    if (!filterTerm.trim()) return navigationItems

    const term = filterTerm.toLowerCase()
    return navigationItems
      .map(section => ({
        ...section,
        items: section.items.filter(
          item =>
            item.name.toLowerCase().includes(term) ||
            item.keywords.some(kw => kw.includes(term)),
        ),
      }))
      .filter(section => section.items.length > 0)
  }, [navigationItems, filterTerm])

  return (
    <div className={cn('h-full border-r bg-card border-border flex flex-col')}>
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-linear-to-r from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-emerald-600">{t('header.brand')}</h1>
            <p className="text-xs text-muted-foreground">{t('header.title')}</p>
          </div>
        </div>
      </div>

      {/* Search area */}
      <div className="px-4 pt-4 pb-2 space-y-2">
        {/* Cmd+K button */}
        {onOpenCommandPalette && (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="flex items-center w-full gap-2 px-3 py-2 text-sm text-muted-foreground bg-muted/50 border border-border rounded-lg hover:bg-muted transition-colors"
          >
            <Search className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left truncate">Buscar...</span>
            <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">&#8984;</span>K
            </kbd>
          </button>
        )}
        {/* Inline filter */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={filterTerm}
            onChange={e => setFilterTerm(e.target.value)}
            placeholder="Filtrar menú..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-transparent border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-6 flex-1 overflow-y-auto">
        {filteredSections.map(section => (
          <div key={section.title}>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{section.title}</h2>
            <ul className="space-y-1">
              {section.items.map(item => (
                <li key={item.href}>
                  <NavLink
                    to={item.href}
                    end={item.href === '/superadmin'}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border-r-2 border-emerald-500'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                      )
                    }
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span>{item.name}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  )
}

export default SuperadminSidebar
