import React from 'react'

import { cn } from '@/lib/utils'
import { TimerReset } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
export default function MenuMakerLayout() {
  return (
    <div className="pb-4 ">
      <MenuNav className="sticky top-0 bg-white h-14" />
      <Outlet />
    </div>
  )
}

export function MenuNav({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <nav className={cn('flex items-center space-x-6 lg:space-x-8 border-y p-4 ', className)} {...props}>
      <NavLink to="overview" className="text-sm font-medium transition-colors text-muted-foreground hover:text-primary">
        Resumen <TimerReset className="w-3 h-3" />
      </NavLink>
      <NavLink to="menus" className="text-sm font-medium transition-colors text-muted-foreground hover:text-primary">
        Menús <TimerReset className="w-3 h-3" />
      </NavLink>
      <NavLink to="categories" className="text-sm font-medium transition-colors hover:text-primary">
        Categorias
      </NavLink>
      <NavLink to="products" className="text-sm font-medium transition-colors text-muted-foreground hover:text-primary">
        Productos
      </NavLink>
      <NavLink to="modifiers" className="text-sm font-medium transition-colors text-muted-foreground hover:text-primary">
        Modificadores <TimerReset className="w-3 h-3" />
      </NavLink>
      <NavLink to="/examples/dashboard" className="text-sm font-medium transition-colors text-muted-foreground hover:text-primary">
        Customers <TimerReset className="w-3 h-3" />
      </NavLink>
    </nav>
  )
}
