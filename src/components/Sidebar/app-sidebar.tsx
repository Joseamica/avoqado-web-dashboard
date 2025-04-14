import {
  AudioWaveform,
  Banknote,
  BookOpen,
  Command,
  Frame,
  GalleryVerticalEnd,
  Home,
  Map,
  PieChart,
  Settings2,
  Smartphone,
  Star,
  Ungroup,
  Users,
} from 'lucide-react'
import * as React from 'react'

import { NavMain } from '@/components/Sidebar/nav-main'
import { NavProjects } from '@/components/Sidebar/nav-projects'
import { NavUser } from '@/components/Sidebar/nav-user'
import { VenuesSwitcher } from '@/components/Sidebar/venues-switcher'
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from '@/components/ui/sidebar'
import { useAuth } from '@/context/AuthContext'
import { User } from '@/types'

// This is sample data.
const data = {
  user: {
    name: 'shadcn',
    email: 'm@example.com',
    avatar: '/avatars/shadcn.jpg',
  },

  venues: [
    {
      name: 'Acme Inc',
      logo: GalleryVerticalEnd,
      plan: 'Enterprise',
    },
    {
      name: 'Acme Corp.',
      logo: AudioWaveform,
      plan: 'Startup',
    },
    {
      name: 'e.',
      logo: Command,
      plan: 'Free',
    },
  ],
  navMain: [
    {
      title: 'Home',
      isActive: true,
      url: 'home', // Update the URL if necessary
      icon: Home,
    },
    {
      title: 'Menú',
      url: 'menumaker/overview',
      icon: BookOpen,
      isActive: true,

      // items: [
      //   {
      //     title: 'Menus',
      //     url: 'menus/overview',
      //   },
      //   {
      //     title: 'Categorías',
      //     url: 'categories',
      //   },
      //   {
      //     title: 'Products',
      //     url: 'products',
      //   },
      //   {
      //     title: 'Modificadores',
      //     url: 'modifiers',
      //   },
      // ],
    },
    {
      title: 'Pagos',
      isActive: true,
      url: 'payments', // Update the URL if necessary
      icon: Banknote,
    },
    {
      title: 'Turnos',
      isActive: true,
      url: 'shifts', // Update the URL if necessary
      icon: Ungroup,
    },
    {
      title: 'TPV',
      isActive: true,
      url: 'tpv', // Update the URL if necessary
      icon: Smartphone,
    },

    {
      title: 'Meseros',
      isActive: true,
      url: 'waiters', // Update the URL if necessary
      icon: Users,
    },
    {
      title: 'Reseñas',
      isActive: true,
      url: 'reviews', // Update the URL if necessary
      icon: Star,
    },
    // {
    //   title: 'Operaciones',
    //   url: '#',
    //   icon: Bot,
    //   isActive: true,

    //   items: [
    //     {
    //       title: 'Ordenes',
    //       url: '#',
    //     },
    //     {
    //       title: 'Pagos',
    //       url: '#',
    //     },
    //     {
    //       title: 'Quantum',
    //       url: '#',
    //     },
    //   ],
    // },

    // {
    //   title: 'Documentation',
    //   url: '#',
    //   icon: BookOpen,
    //   items: [
    //     {
    //       title: 'Introduction',
    //       url: '#',
    //     },
    //     {
    //       title: 'Get Started',
    //       url: '#',
    //     },
    //     {
    //       title: 'Tutorials',
    //       url: '#',
    //     },
    //     {
    //       title: 'Changelog',
    //       url: '#',
    //     },
    //   ],
    // },
    {
      title: 'Configuración',
      url: '#',
      icon: Settings2,
      items: [
        {
          title: 'General',
          url: 'editVenue',
        },
        {
          title: 'Team',
          url: '#',
        },
        {
          title: 'Billing',
          url: '#',
        },
        {
          title: 'Limits',
          url: '#',
        },
      ],
    },
  ],
  projects: [
    {
      name: 'Design Engineering',
      url: '#',
      icon: Frame,
    },
    {
      name: 'Sales & Marketing',
      url: '#',
      icon: PieChart,
    },
    {
      name: 'Travel',
      url: '#',
      icon: Map,
    },
  ],
}

export function AppSidebar({ user, ...props }: React.ComponentProps<typeof Sidebar> & { user: User }) {
  const { allVenues } = useAuth()

  const superAdminRoutes = [
    {
      title: 'Admin Panel',
      isActive: true,
      url: 'admin',
      icon: Settings2,
    },
    {
      title: 'User Management',
      isActive: true,
      url: 'admin/users',
      icon: Users,
    },
    {
      title: 'System Logs',
      isActive: true,
      url: 'admin/logs',
      icon: BookOpen,
    },
    {
      title: 'Advanced Settings',
      isActive: true,
      url: 'admin/settings',
      icon: Settings2,
    },
  ]

  // Use all venues for SUPERADMIN, otherwise use user's assigned venues
  const venuesToShow = user.role === 'SUPERADMIN' && allVenues.length > 0 ? allVenues : user.venues
  const defaultVenue = venuesToShow.length > 0 ? venuesToShow[0] : null

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>{defaultVenue && <VenuesSwitcher venues={venuesToShow} defaultVenue={defaultVenue} />}</SidebarHeader>
      <SidebarContent>
        <NavMain items={user.role === 'SUPERADMIN' ? [...data.navMain, ...superAdminRoutes] : data.navMain} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
