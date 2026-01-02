import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/Sidebar/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { ChevronRight, Lock, type LucideIcon } from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function NavMain({
  items,
  superadminItems,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
    isActive?: boolean
    superadminOnly?: boolean
    locked?: boolean
    permission?: string
    items?: {
      title: string
      url: string
      superadminOnly?: boolean
      permission?: string | null
    }[]
  }[]
  superadminItems?: {
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
  }[]
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation('sidebar')
  const { state: sidebarState, isMobile } = useSidebar()
  const isCollapsed = sidebarState === 'collapsed' && !isMobile

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
  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>{t('platform')}</SidebarGroupLabel>
        <SidebarMenu>
          {items.map(item => {
            const isSuperadminItem = isSuperadminPath(item.url) || !!item.superadminOnly

            if (item.items) {
              // When collapsed, use DropdownMenu instead of Collapsible
              if (isCollapsed) {
                return (
                  <SidebarMenuItem key={item.url}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                          tooltip={item.title}
                          isActive={isItemActive(item.url) || item.items?.some(s => isSubItemActive(s.url))}
                          className={`relative ${isSuperadminItem ? superadminButtonClass : ''}`}
                        >
                          {item.icon && <item.icon className={isSuperadminItem ? superadminIconClass : undefined} />}
                          <ChevronRight className="absolute -right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        </SidebarMenuButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start" sideOffset={4}>
                        {item.items.map(subItem => {
                          const isSuperadminSubItem = isSuperadminPath(subItem.url) || !!subItem.superadminOnly
                          return (
                            <DropdownMenuItem
                              key={subItem.url}
                              asChild
                              className={isSubItemActive(subItem.url) ? 'bg-accent' : ''}
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
              return (
                <Collapsible
                  key={item.url}
                  asChild
                  defaultOpen={item.isActive || (item.items?.some(s => isSubItemActive(s.url)) ?? false)}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip={item.title}
                        isActive={isItemActive(item.url)}
                        className={isSuperadminItem ? superadminButtonClass : undefined}
                      >
                        {item.icon && <item.icon className={isSuperadminItem ? superadminIconClass : undefined} />}
                        <span className={isSuperadminItem ? superadminGradientTextClass : undefined}>{item.title}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items.map(subItem => {
                          const isSuperadminSubItem = isSuperadminPath(subItem.url) || !!subItem.superadminOnly
                          return (
                            <SidebarMenuSubItem key={subItem.url}>
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

            return (
              // Render direct link for items without sub-items
              <SidebarMenuItem key={item.url}>
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
                    {item.icon && <item.icon className={isSuperadminItem ? superadminIconClass : undefined} />}
                    <span className={isSuperadminItem ? superadminGradientTextClass : undefined}>{item.title}</span>
                    {item.locked && (
                      <Lock className="ml-auto h-3 w-3 text-muted-foreground opacity-70" aria-label={t('requiresKycVerification')} />
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroup>

      {superadminItems && superadminItems.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel>{t('superadmin')}</SidebarGroupLabel>
          <SidebarMenu>
            {superadminItems.map(item => {
              if (item.items) {
                // When collapsed, use DropdownMenu
                if (isCollapsed) {
                  return (
                    <SidebarMenuItem key={item.url}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <SidebarMenuButton
                            tooltip={item.title}
                            isActive={isItemActive(item.url) || item.items?.some(s => isSubItemActive(s.url))}
                            className={`relative ${superadminButtonClass}`}
                          >
                            {item.icon && <item.icon className={superadminIconClass} />}
                            <ChevronRight className="absolute -right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-amber-400/70" />
                          </SidebarMenuButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="right" align="start" sideOffset={4}>
                          {item.items.map(subItem => (
                            <DropdownMenuItem
                              key={subItem.url}
                              asChild
                              className={isSubItemActive(subItem.url) ? 'bg-accent' : ''}
                            >
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
                return (
                  <Collapsible
                    key={item.url}
                    asChild
                    defaultOpen={item.isActive || (item.items?.some(s => isSubItemActive(s.url)) ?? false)}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip={item.title} isActive={isItemActive(item.url)} className={superadminButtonClass}>
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
