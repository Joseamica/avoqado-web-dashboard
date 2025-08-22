import React from 'react'

import { cn } from '@/lib/utils'
import { NavLink, Outlet } from 'react-router-dom'

export default function MenuMakerLayout() {
  return (
    <div className="pb-4 bg-background">
      <MenuNav className="sticky top-0 bg-card h-14 z-50 shadow-sm" />
      <Outlet />
    </div>
  )
}

export function MenuNav({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <nav className={cn("flex items-center space-x-6 lg:space-x-8 border-y border-border p-4", className)} {...props}>
      <NavLink
        to="overview"
        className={({ isActive }) =>
          `text-sm font-medium transition-colors ${
            isActive ? 'text-foreground' : 'text-muted-foreground hover:text-primary'
          }`
        }
      >
        Resumen
      </NavLink>
      <NavLink
        to="menus"
        className={({ isActive }) =>
          `text-sm font-medium transition-colors ${
            isActive ? 'text-foreground' : 'text-muted-foreground hover:text-primary'
          }`
        }
      >
        Menús
      </NavLink>
      <NavLink
        to="categories"
        className={({ isActive }) =>
          `text-sm font-medium transition-colors ${
            isActive ? 'text-foreground' : 'text-muted-foreground hover:text-primary'
          }`
        }
      >
        Categorias
      </NavLink>
      <NavLink
        to="products"
        className={({ isActive }) =>
          `text-sm font-medium transition-colors ${
            isActive ? 'text-foreground' : 'text-muted-foreground hover:text-primary'
          }`
        }
      >
        Productos
      </NavLink>
      <NavLink
        to="modifier-groups"
        className={({ isActive }) =>
          `text-sm font-medium transition-colors ${
            isActive ? 'text-foreground' : 'text-muted-foreground hover:text-primary'
          }`
        }
      >
        Grupos Modificadores
      </NavLink>
      <NavLink
        to="/examples/dashboard"
        className={({ isActive }) =>
          `text-sm font-medium transition-colors ${
            isActive ? 'text-foreground' : 'text-muted-foreground hover:text-primary'
          }`
        }
      >
        Customers
      </NavLink>
    </nav>
  )
}
