import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/Sidebar/collapsible'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom' // Import Link

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
    isActive?: boolean
    items?: {
      title: string
      url: string
    }[]
  }[]
}) {
  const navigate = useNavigate()
  const location = useLocation()

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
    <SidebarGroup>
      <SidebarGroupLabel>Plataforma</SidebarGroupLabel>
      <SidebarMenu>
        {items.map(item =>
          item.items ? (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={item.isActive || (item.items?.some(s => isSubItemActive(s.url)) ?? false)}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={item.title} isActive={isItemActive(item.url)}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items.map(subItem => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton asChild isActive={isSubItemActive(subItem.url)}>
                          <NavLink to={subItem.url}>
                            <span>{subItem.title}</span>
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          ) : (
            // Render direct link for items without sub-items
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild tooltip={item.title} isActive={isItemActive(item.url)}>
                <NavLink
                  to={item.url}
                  className="flex items-center"
                  onClick={e => {
                    // For superadmin routes, prevent default and navigate manually
                    if (item.url.startsWith('/superadmin')) {
                      e.preventDefault()
                      navigate(item.url)
                    }
                  }}
                >
                  {item.icon && <item.icon />}
                  <span className="">{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ),
        )}
      </SidebarMenu>
    </SidebarGroup>
  )
}
