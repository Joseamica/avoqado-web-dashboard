import * as React from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

export interface NavTabItem {
  to: string
  label: string
  icon?: React.ReactNode
  badge?: string | number
}

export interface NavTabsProps extends React.HTMLAttributes<HTMLElement> {
  items: NavTabItem[]
}

/**
 * NavTabs — Stripe-style underline tab navigation using React Router NavLinks.
 *
 * Renders a horizontal nav bar with underline indicators on the active route.
 * Background, sticky positioning, and z-index are controlled by the parent via `className`.
 *
 * @example
 * <NavTabs
 *   className="sticky top-0 bg-card h-14 z-50"
 *   items={[
 *     { to: 'overview', label: t('nav.overview') },
 *     { to: 'products', label: t('nav.products'), badge: 12 },
 *   ]}
 * />
 */
const NavTabs = React.forwardRef<HTMLElement, NavTabsProps>(
  ({ items, className, ...props }, ref) => (
    <nav
      ref={ref}
      className={cn(
        'flex items-center gap-6 lg:gap-8 border-b border-border px-4 sm:px-6 pt-3 overflow-x-auto',
        className,
      )}
      {...props}
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              'text-sm font-medium transition-colors whitespace-nowrap pb-3 -mb-px border-b-2',
              'flex items-center gap-1.5',
              isActive
                ? 'text-primary border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground',
            )
          }
        >
          {item.icon}
          {item.label}
          {item.badge !== undefined && (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs bg-muted text-muted-foreground">
              {item.badge}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  ),
)
NavTabs.displayName = 'NavTabs'

export { NavTabs }
