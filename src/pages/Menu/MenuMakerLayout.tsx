import React from 'react'

import { themeClasses } from '@/lib/theme-utils'
import { cn } from '@/lib/utils'
import { NavLink, Outlet } from 'react-router-dom'

export default function MenuMakerLayout() {
  return (
    <div className={`pb-4 ${themeClasses.pageBg}`}>
      <MenuNav className={`sticky top-0 ${themeClasses.cardBg} h-14 z-50 shadow-sm`} />
      <Outlet />
    </div>
  )
}

export function MenuNav({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <nav className={cn(`flex items-center space-x-6 lg:space-x-8 border-y ${themeClasses.border} p-4`, className)} {...props}>
      <NavLink
        to="overview"
        className={({ isActive }) =>
          `text-sm font-medium transition-colors ${
            isActive ? themeClasses.text : `${themeClasses.textMuted} hover:text-primary dark:hover:text-primary-foreground`
          }`
        }
      >
        Resumen
      </NavLink>
      <NavLink
        to="menus"
        className={({ isActive }) =>
          `text-sm font-medium transition-colors ${
            isActive ? themeClasses.text : `${themeClasses.textMuted} hover:text-primary dark:hover:text-primary-foreground`
          }`
        }
      >
        Menús
      </NavLink>
      <NavLink
        to="categories"
        className={({ isActive }) =>
          `text-sm font-medium transition-colors ${
            isActive ? themeClasses.text : `${themeClasses.textMuted} hover:text-primary dark:hover:text-primary-foreground`
          }`
        }
      >
        Categorias
      </NavLink>
      <NavLink
        to="products"
        className={({ isActive }) =>
          `text-sm font-medium transition-colors ${
            isActive ? themeClasses.text : `${themeClasses.textMuted} hover:text-primary dark:hover:text-primary-foreground`
          }`
        }
      >
        Productos
      </NavLink>
      <NavLink
        to="modifier-groups"
        className={({ isActive }) =>
          `text-sm font-medium transition-colors ${
            isActive ? themeClasses.text : `${themeClasses.textMuted} hover:text-primary dark:hover:text-primary-foreground`
          }`
        }
      >
        Grupos Modificadores
      </NavLink>
      <NavLink
        to="/examples/dashboard"
        className={({ isActive }) =>
          `text-sm font-medium transition-colors ${
            isActive ? themeClasses.text : `${themeClasses.textMuted} hover:text-primary dark:hover:text-primary-foreground`
          }`
        }
      >
        Customers
      </NavLink>
    </nav>
  )
}
