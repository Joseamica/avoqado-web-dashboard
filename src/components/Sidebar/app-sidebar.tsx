import {
  AudioWaveform,
  Banknote,
  BookOpen,
  Building,
  Command,
  Frame,
  GalleryVerticalEnd,
  Globe,
  Home,
  Server,
  Settings2,
  ShieldAlert,
  Smartphone,
  Star,
  Ungroup,
  Users,
} from 'lucide-react'
import * as React from 'react'

import { NavMain } from '@/components/Sidebar/nav-main'
import { NavUser } from '@/components/Sidebar/nav-user'
import { VenuesSwitcher } from '@/components/Sidebar/venues-switcher'
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from '@/components/ui/sidebar'
import { useAuth } from '@/context/AuthContext'
import { User, SessionVenue, Venue } from '@/types'

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
      title: 'Cuentas',
      isActive: true,
      url: 'orders',
      icon: Frame,
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
      title: 'Reseñas',
      isActive: true,
      url: 'reviews', // Update the URL if necessary
      icon: Star,
    },
    {
      title: 'Equipo',
      isActive: true,
      url: 'teams',
      icon: Users,
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
          url: 'teams',
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
  // projects: [
  //   {
  //     name: 'Design Engineering',
  //     url: '#',
  //     icon: Frame,
  //   },
  //   {
  //     name: 'Sales & Marketing',
  //     url: '#',
  //     icon: PieChart,
  //   },
  //   {
  //     name: 'Travel',
  //     url: '#',
  //     icon: Map,
  //   },
  // ],
}

export function AppSidebar({ user, ...props }: React.ComponentProps<typeof Sidebar> & { user: User }) {
  const { allVenues } = useAuth()

  const superAdminRoutes = [
    {
      title: 'Admin Dashboard',
      isActive: true,
      url: '/admin',
      icon: Settings2,
    },
    {
      title: 'User Management',
      isActive: true,
      url: '/admin/users',
      icon: Users,
    },
    {
      title: 'Venue Management',
      isActive: true,
      url: '/admin/venues',
      icon: Building,
    },
    {
      title: 'System Settings',
      isActive: true,
      url: '/admin/system',
      icon: Server,
    },
    {
      title: 'Global Config',
      isActive: true,
      url: '/admin/global',
      icon: Globe,
    },
    {
      title: 'SuperAdmin Management',
      isActive: true,
      url: '/admin/superadmins',
      icon: ShieldAlert,
    },
  ]

  // Use all venues for SUPERADMIN, otherwise use user's assigned venues
  const venuesToShow: Array<Venue | SessionVenue> =
    user.role === 'SUPERADMIN' && allVenues.length > 0 ? allVenues : user.venues
  const defaultVenue: Venue | SessionVenue | null = venuesToShow.length > 0 ? venuesToShow[0] : null

  // Map app User -> NavUser expected shape
  const navUser = React.useMemo(
    () => ({
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      image: user.photoUrl ?? '',
    }),
    [user.firstName, user.lastName, user.email, user.photoUrl],
  )

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        {defaultVenue && <VenuesSwitcher venues={venuesToShow} defaultVenue={defaultVenue} />}
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={user.role === 'SUPERADMIN' ? [...data.navMain, ...superAdminRoutes] : data.navMain} />
        {/* <NavProjects projects={data.projects} /> */}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={navUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
