import { useState, useEffect } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/Sidebar/collapsible'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { ChevronRight, Eye, EyeOff, Lock, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import avoqadoIsotipo from '@/assets/Isotipo.png'

export type NavSubItem = {
  title: string
  url: string
  superadminOnly?: boolean
  permission?: string | null
  comingSoon?: boolean
}

export type NavItem = {
  title: string
  url: string
  icon?: LucideIcon
  isActive?: boolean
  superadminOnly?: boolean
  locked?: boolean
  permission?: string
  isAvoqadoCore?: boolean
  items?: NavSubItem[]
  group?: string
  comingSoon?: boolean
}

type SuperadminNavItem = {
  title: string
  url: string
  icon?: LucideIcon
  isActive?: boolean
  superadminOnly?: boolean
  items?: {
    title: string
    url: string
    superadminOnly?: boolean
  }[]
}

export function NavMain({
  items,
  superadminItems,
  hiddenSidebarItems = [],
  isSuperadmin = false,
  onToggleVisibility,
}: {
  items: NavItem[]
  superadminItems?: SuperadminNavItem[]
  hiddenSidebarItems?: string[]
  isSuperadmin?: boolean
  onToggleVisibility?: (url: string) => void
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation('sidebar')
  const { state: sidebarState, isMobile } = useSidebar()
  const isCollapsed = sidebarState === 'collapsed' && !isMobile
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

  const isSuperadminPath = (url: string) => url.startsWith('/superadmin')
  const superadminButtonClass =
    'hover:bg-amber-500/10 dark:hover:bg-amber-500/20 focus-visible:ring-amber-400/60 data-[active=true]:bg-amber-500/15 dark:data-[active=true]:bg-amber-500/25 data-[active=true]:shadow-[0_0_14px_rgba(251,191,36,0.35)]'
  const superadminSubButtonClass =
    'hover:bg-amber-500/10 dark:hover:bg-amber-500/20 focus-visible:ring-amber-400/60 data-[active=true]:bg-amber-500/15 dark:data-[active=true]:bg-amber-500/25'
  const superadminGradientTextClass =
    'inline-block bg-linear-to-r from-amber-300 via-orange-400 to-pink-500 bg-clip-text text-transparent font-semibold drop-shadow-[0_0_12px_rgba(251,191,36,0.35)] dark:from-amber-200 dark:via-orange-300 dark:to-pink-400'
  const superadminIconClass =
    'text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.35)] dark:text-amber-200 dark:drop-shadow-[0_0_10px_rgba(251,191,36,0.45)]'

  // Determine if a primary item is active based on current pathname.
  const isItemActive = (url: string) => {
    const path = location.pathname
    if (!url) return false
    // Absolute routes
    if (url.startsWith('/')) return path === url || path.startsWith(url)
    // Relative routes: match segment-wise
    const seg = `/${url.replace(/^\/+|\/+$/g, '')}`
    return path === seg || path.startsWith(`${seg}/`) || path.endsWith(seg) || path.includes(`${seg}/`)
  }

  const isSubItemActive = (url: string) => {
    const path = location.pathname
    if (!url) return false
    if (url.startsWith('/')) return path === url || path.startsWith(url)
    const seg = `/${url.replace(/^\/+|\/+$/g, '')}`
    return path === seg || path.startsWith(`${seg}/`) || path.endsWith(seg) || path.includes(`${seg}/`)
  }

  // Check if a URL is hidden
  const isHidden = (url: string) => hiddenSidebarItems.includes(url)

  // Auto-open collapsible sections when navigating to a nested route
  useEffect(() => {
    const allItems = [...items, ...(superadminItems ?? [])]
    for (const item of allItems) {
      if (item.items?.some(s => isSubItemActive(s.url))) {
        setOpenSections(prev => {
          if (prev[item.url]) return prev
          return { ...prev, [item.url]: true }
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  // Tiny Avoqado badge for core platform items in white-label venues
  const AvoqadoBadge = () => <img src={avoqadoIsotipo} alt="Avoqado" className="w-2.5 shrink-0 object-contain opacity-50" />

  // Eye toggle button for superadmin visibility control
  const VisibilityToggle = ({ url, className }: { url: string; className?: string }) => {
    if (!isSuperadmin || !onToggleVisibility) return null
    const hidden = isHidden(url)
    return (
      <button
        type="button"
        onClick={e => {
          e.preventDefault()
          e.stopPropagation()
          onToggleVisibility(url)
        }}
        className={cn(
          'shrink-0 rounded-sm p-0.5 transition-opacity',
          hidden
            ? 'opacity-100 text-muted-foreground'
            : 'opacity-0 group-hover/sidebar-item:opacity-100 text-muted-foreground hover:text-foreground',
          className,
        )}
        title={hidden ? 'Mostrar para usuarios' : 'Ocultar para usuarios'}
      >
        {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    )
  }

  // Sub-item visibility toggle (smaller)
  const SubItemVisibilityToggle = ({ url }: { url: string }) => {
    if (!isSuperadmin || !onToggleVisibility) return null
    const hidden = isHidden(url)
    return (
      <button
        type="button"
        onClick={e => {
          e.preventDefault()
          e.stopPropagation()
          onToggleVisibility(url)
        }}
        className={cn(
          'absolute right-1 top-1/2 -translate-y-1/2 z-10 rounded-sm p-0.5 transition-opacity',
          hidden
            ? 'opacity-100 text-muted-foreground'
            : 'opacity-0 group-hover/sub-item:opacity-100 text-muted-foreground hover:text-foreground',
        )}
        title={hidden ? 'Mostrar para usuarios' : 'Ocultar para usuarios'}
      >
        {hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </button>
    )
  }

  // Group items by their `group` field, preserving order
  const GROUP_ORDER = ['main', 'operations', 'people', 'reports', 'settings']
  const GROUP_LABELS: Record<string, string> = {
    main: '', // No label for top items
    operations: t('groups.operations', { defaultValue: 'Operaciones' }),
    people: t('groups.people', { defaultValue: 'Personas' }),
    reports: t('groups.reports', { defaultValue: 'Reportes' }),
    settings: t('groups.settings', { defaultValue: 'Configuración' }),
  }

  const groupedItems = GROUP_ORDER.reduce<Record<string, typeof items>>((acc, group) => {
    const groupItems = items.filter(item => (item.group || 'main') === group)
    if (groupItems.length > 0) acc[group] = groupItems
    return acc
  }, {})

  // Catch any items with unknown groups
  const knownGroups = new Set(GROUP_ORDER)
  const ungroupedItems = items.filter(item => item.group && !knownGroups.has(item.group))
  if (ungroupedItems.length > 0) {
    groupedItems['other'] = ungroupedItems
  }

  const renderItem = (item: NavItem) => {
            const isSuperadminItem = isSuperadminPath(item.url) || !!item.superadminOnly
            const itemHidden = isHidden(item.url)

            // Non-superadmin: skip hidden items entirely
            if (!isSuperadmin && itemHidden) return null

            if (item.items) {
              // Filter sub-items for non-superadmin
              const visibleSubItems = isSuperadmin ? item.items : item.items.filter(sub => !isHidden(sub.url))

              // If all sub-items are hidden and item itself is hidden, skip
              if (!isSuperadmin && visibleSubItems.length === 0) return null

              // When collapsed, use DropdownMenu instead of Collapsible
              if (isCollapsed) {
                const hasActiveChild = visibleSubItems?.some(s => isSubItemActive(s.url))
                return (
                  <SidebarMenuItem key={item.url} className={cn(itemHidden && isSuperadmin && 'opacity-40')}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                          tooltip={item.title}
                          isActive={isItemActive(item.url) && !hasActiveChild}
                          className={cn('relative', isSuperadminItem ? superadminButtonClass : undefined)}
                        >
                          {item.icon && <item.icon className={isSuperadminItem ? superadminIconClass : undefined} />}
                          <span
                            className={cn(
                              'absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full transition-colors',
                              hasActiveChild ? 'bg-foreground' : 'bg-muted-foreground/40',
                            )}
                          />
                        </SidebarMenuButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start" sideOffset={4}>
                        {visibleSubItems.map(subItem => {
                          const isSuperadminSubItem = isSuperadminPath(subItem.url) || !!subItem.superadminOnly
                          const subHidden = isHidden(subItem.url)
                          if (subItem.comingSoon) {
                            return (
                              <DropdownMenuItem
                                key={subItem.url}
                                disabled
                                className={cn('flex items-center gap-2 opacity-60', subHidden && isSuperadmin && 'opacity-40')}
                              >
                                <span>{subItem.title}</span>
                                <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                                  Pronto
                                </span>
                              </DropdownMenuItem>
                            )
                          }
                          return (
                            <DropdownMenuItem
                              key={subItem.url}
                              asChild
                              className={cn(isSubItemActive(subItem.url) ? 'bg-accent' : '', subHidden && isSuperadmin && 'opacity-40')}
                            >
                              <NavLink
                                to={subItem.url}
                                className={isSuperadminSubItem ? superadminGradientTextClass : undefined}
                                onClick={e => {
                                  if (!subItem.url.startsWith('/') && !subItem.url.startsWith('#')) {
                                    e.preventDefault()
                                    navigate(subItem.url)
                                  }
                                }}
                              >
                                {subItem.title}
                              </NavLink>
                            </DropdownMenuItem>
                          )
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                )
              }

              // When expanded, use Collapsible
              const hasActiveChild = visibleSubItems?.some(s => isSubItemActive(s.url)) ?? false
              return (
                <Collapsible
                  key={item.url}
                  asChild
                  open={openSections[item.url] ?? (item.isActive || hasActiveChild)}
                  onOpenChange={isOpen => setOpenSections(prev => ({ ...prev, [item.url]: isOpen }))}
                  className="group/collapsible"
                >
                  <SidebarMenuItem className={cn('group/sidebar-item', itemHidden && isSuperadmin && 'opacity-40')}>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip={item.title}
                        isActive={isItemActive(item.url) && !hasActiveChild}
                        className={isSuperadminItem ? superadminButtonClass : undefined}
                      >
                        {item.isAvoqadoCore && !isCollapsed && <AvoqadoBadge />}
                        {item.icon && <item.icon className={isSuperadminItem ? superadminIconClass : undefined} />}
                        <span className={isSuperadminItem ? superadminGradientTextClass : undefined}>{item.title}</span>
                        <VisibilityToggle url={item.url} className="ml-auto" />
                        <ChevronRight className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {visibleSubItems.map(subItem => {
                          const isSuperadminSubItem = isSuperadminPath(subItem.url) || !!subItem.superadminOnly
                          const subHidden = isHidden(subItem.url)

                          if (subItem.comingSoon) {
                            return (
                              <SidebarMenuSubItem key={subItem.url} className={cn(subHidden && isSuperadmin && 'opacity-40')}>
                                <SidebarMenuSubButton className="opacity-50 cursor-not-allowed pointer-events-none h-auto py-1.5">
                                  <span className="flex flex-col items-start gap-0.5 leading-tight">
                                    <span>{subItem.title}</span>
                                    <span className="rounded-full bg-muted-foreground/10 px-1.5 py-px text-[9px] font-medium text-muted-foreground">
                                      Muy pronto
                                    </span>
                                  </span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            )
                          }
                          return (
                            <SidebarMenuSubItem
                              key={subItem.url}
                              className={cn('group/sub-item relative', subHidden && isSuperadmin && 'opacity-40')}
                            >
                              <SidebarMenuSubButton
                                asChild
                                isActive={isSubItemActive(subItem.url)}
                                className={isSuperadminSubItem ? superadminSubButtonClass : undefined}
                              >
                                <NavLink
                                  to={subItem.url}
                                  onClick={e => {
                                    // For non-absolute paths, ensure navigation works
                                    if (!subItem.url.startsWith('/') && !subItem.url.startsWith('#')) {
                                      e.preventDefault()
                                      navigate(subItem.url)
                                    }
                                  }}
                                >
                                  <span className={isSuperadminSubItem ? superadminGradientTextClass : undefined}>{subItem.title}</span>
                                  <SubItemVisibilityToggle url={subItem.url} />
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          )
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )
            }

            // Coming soon items — disabled with badge
            if (item.comingSoon) {
              return (
                <SidebarMenuItem key={item.url} className={cn('group/sidebar-item', itemHidden && isSuperadmin && 'opacity-40')}>
                  <SidebarMenuButton tooltip={item.title} className="opacity-50 cursor-not-allowed pointer-events-none">
                    {item.icon && <item.icon />}
                    <span className="flex items-center gap-2">
                      {item.title}
                      <span className="rounded-full bg-muted-foreground/10 px-1.5 py-px text-[9px] font-medium text-muted-foreground">
                        Muy pronto
                      </span>
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            }

            return (
              // Render direct link for items without sub-items
              <SidebarMenuItem key={item.url} className={cn('group/sidebar-item', itemHidden && isSuperadmin && 'opacity-40')}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={isItemActive(item.url)}
                  className={isSuperadminItem ? superadminButtonClass : undefined}
                >
                  <NavLink
                    to={item.locked ? 'kyc-required' : item.url}
                    className="flex items-center gap-2"
                    onClick={e => {
                      // For locked items, redirect to KYC required page
                      if (item.locked) {
                        e.preventDefault()
                        navigate('kyc-required')
                        return
                      }
                      // For superadmin routes, prevent default and navigate manually
                      if (item.url.startsWith('/superadmin')) {
                        e.preventDefault()
                        navigate(item.url)
                      }
                    }}
                  >
                    {item.isAvoqadoCore && !isCollapsed && <AvoqadoBadge />}
                    {item.icon && <item.icon className={isSuperadminItem ? superadminIconClass : undefined} />}
                    <span className={isSuperadminItem ? superadminGradientTextClass : undefined}>{item.title}</span>
                    {item.locked && (
                      <Lock className="ml-auto h-3 w-3 text-muted-foreground opacity-70" aria-label={t('requiresKycVerification')} />
                    )}
                    {!item.locked && <VisibilityToggle url={item.url} className="ml-auto" />}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
  }

  return (
    <>
      {Object.entries(groupedItems).map(([group, groupItems]) => (
        <SidebarGroup key={group}>
          {GROUP_LABELS[group] && <SidebarGroupLabel>{GROUP_LABELS[group]}</SidebarGroupLabel>}
          <SidebarMenu>
            {groupItems.map(item => renderItem(item))}
          </SidebarMenu>
        </SidebarGroup>
      ))}

      {superadminItems && superadminItems.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel>{t('superadmin')}</SidebarGroupLabel>
          <SidebarMenu>
            {superadminItems.map(item => {
              if (item.items) {
                // When collapsed, use DropdownMenu
                if (isCollapsed) {
                  const hasActiveChild = item.items?.some(s => isSubItemActive(s.url))
                  return (
                    <SidebarMenuItem key={item.url}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <SidebarMenuButton
                            tooltip={item.title}
                            isActive={isItemActive(item.url) && !hasActiveChild}
                            className={cn('relative', superadminButtonClass)}
                          >
                            {item.icon && <item.icon className={superadminIconClass} />}
                            <span
                              className={cn(
                                'absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full transition-colors',
                                hasActiveChild ? 'bg-amber-400' : 'bg-amber-400/40',
                              )}
                            />
                          </SidebarMenuButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="right" align="start" sideOffset={4}>
                          {item.items.map(subItem => (
                            <DropdownMenuItem key={subItem.url} asChild className={isSubItemActive(subItem.url) ? 'bg-accent' : ''}>
                              <NavLink to={subItem.url} className={superadminGradientTextClass}>
                                {subItem.title}
                              </NavLink>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </SidebarMenuItem>
                  )
                }

                // When expanded, use Collapsible
                const hasActiveChild = item.items?.some(s => isSubItemActive(s.url)) ?? false
                return (
                  <Collapsible
                    key={item.url}
                    asChild
                    open={openSections[item.url] ?? (item.isActive || hasActiveChild)}
                    onOpenChange={isOpen => setOpenSections(prev => ({ ...prev, [item.url]: isOpen }))}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={item.title}
                          isActive={isItemActive(item.url) && !hasActiveChild}
                          className={superadminButtonClass}
                        >
                          {item.icon && <item.icon className={superadminIconClass} />}
                          <span className={superadminGradientTextClass}>{item.title}</span>
                          <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items.map(subItem => (
                            <SidebarMenuSubItem key={subItem.url}>
                              <SidebarMenuSubButton asChild isActive={isSubItemActive(subItem.url)} className={superadminSubButtonClass}>
                                <NavLink to={subItem.url}>
                                  <span className={superadminGradientTextClass}>{subItem.title}</span>
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                )
              }

              return (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild tooltip={item.title} isActive={isItemActive(item.url)} className={superadminButtonClass}>
                    <NavLink
                      to={item.url}
                      className="flex items-center"
                      onClick={e => {
                        if (item.url.startsWith('/superadmin')) {
                          e.preventDefault()
                          navigate(item.url)
                        }
                      }}
                    >
                      {item.icon && <item.icon className={superadminIconClass} />}
                      <span className={superadminGradientTextClass}>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      )}
    </>
  )
}
