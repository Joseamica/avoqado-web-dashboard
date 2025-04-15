import React from 'react'

import { cn } from '@/lib/utils'
import { TimerReset } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { themeClasses } from '@/lib/theme-utils'

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
        Resumen <TimerReset className="w-3 h-3" />
      </NavLink>
      <NavLink
        to="menus"
        className={({ isActive }) =>
          `text-sm font-medium transition-colors ${
            isActive ? themeClasses.text : `${themeClasses.textMuted} hover:text-primary dark:hover:text-primary-foreground`
          }`
        }
      >
        Menús <TimerReset className="w-3 h-3" />
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
        to="modifiers"
        className={({ isActive }) =>
          `text-sm font-medium transition-colors ${
            isActive ? themeClasses.text : `${themeClasses.textMuted} hover:text-primary dark:hover:text-primary-foreground`
          }`
        }
      >
        Modificadores <TimerReset className="w-3 h-3" />
      </NavLink>
      <NavLink
        to="/examples/dashboard"
        className={({ isActive }) =>
          `text-sm font-medium transition-colors ${
            isActive ? themeClasses.text : `${themeClasses.textMuted} hover:text-primary dark:hover:text-primary-foreground`
          }`
        }
      >
        Customers <TimerReset className="w-3 h-3" />
      </NavLink>
    </nav>
  )
}
