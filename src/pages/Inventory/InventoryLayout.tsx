import React from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { NavLink, Outlet } from 'react-router-dom'

export default function InventoryLayout() {
  return (
    <div className="pb-4 bg-background">
      <InventoryNav className="sticky top-0 bg-card h-14 z-50 shadow-sm" />
      <Outlet />
    </div>
  )
}

export function InventoryNav({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  const { t } = useTranslation('inventory')
  return (
    <nav className={cn('flex items-center space-x-6 lg:space-x-8 border-y border-border p-4', className)} {...props}>
      <NavLink
        to="raw-materials"
        className={({ isActive }) =>
          `text-sm font-medium transition-colors ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-primary'}`
        }
      >
        {t('nav.rawMaterials')}
      </NavLink>
      <NavLink
        to="product-stock"
        className={({ isActive }) =>
          `text-sm font-medium transition-colors ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-primary'}`
        }
      >
        {t('nav.productStock')}
      </NavLink>
      <NavLink
        to="recipes"
        className={({ isActive }) =>
          `text-sm font-medium transition-colors ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-primary'}`
        }
      >
        {t('nav.recipes')}
      </NavLink>
      <NavLink
        to="pricing"
        className={({ isActive }) =>
          `text-sm font-medium transition-colors ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-primary'}`
        }
      >
        {t('nav.pricing')}
      </NavLink>
    </nav>
  )
}
