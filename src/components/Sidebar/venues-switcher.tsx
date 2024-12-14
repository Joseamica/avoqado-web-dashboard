import { useEffect, useState } from 'react'
import { ChevronsUpDown, Plus } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import { Navigate, useLocation, useNavigate, useNavigation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function VenuesSwitcher({ venues }: { venues: any[] }) {
  const location = useLocation()
  const navigate = useNavigate()

  const { isMobile } = useSidebar()
  const [activeVenue, setActiveVenue] = useState(venues.length > 0 ? venues[0] : null)

  // useEffect(() => {
  //   console.log(location.pathname.split('/')[2])
  //     navigate({})
  // }, [activeTeam])
  // console.log(location)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              <div className="flex items-center justify-center rounded-lg aspect-square size-8 text-sidebar-primary-foreground">
                <img src={activeVenue.logo} alt={`${activeVenue.name} Logo`} className="rounded-full" />{' '}
              </div>
              <div className="grid flex-1 text-sm leading-tight text-left">
                <span className="font-semibold truncate">{activeVenue.name}</span>
                <span className="text-xs truncate">{activeVenue.plan}</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-zinc-500 dark:text-zinc-400">User.venues</DropdownMenuLabel>
            {venues.map((team, index) => (
              <DropdownMenuItem key={team.name} onClick={() => setActiveVenue(team)} className="gap-2 p-2">
                <div className="flex items-center justify-center border rounded-sm size-6">
                  <team.logo className="size-4 shrink-0" />
                </div>
                {team.name}
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2">
              <div className="flex items-center justify-center bg-white border rounded-md size-6 border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950">
                <Plus className="size-4" />
              </div>
              <div className="font-medium text-zinc-500 dark:text-zinc-400">Add team</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
