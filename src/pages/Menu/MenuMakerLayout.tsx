import { createContext, useContext, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'
import { NavTabs } from '@/components/ui/nav-tabs'

// Context so child pages can push their title + action buttons into the layout header
interface MenuMakerHeaderContextType {
  setHeader: (header: { title?: ReactNode; actions?: ReactNode }) => void
}

const MenuMakerHeaderContext = createContext<MenuMakerHeaderContextType | undefined>(undefined)

export const useMenuMakerHeader = () => {
  const ctx = useContext(MenuMakerHeaderContext)
  if (!ctx) throw new Error('useMenuMakerHeader must be used within MenuMakerLayout')
  return ctx
}

export default function MenuMakerLayout() {
  const { t } = useTranslation('menu')
  const [header, setHeader] = useState<{ title?: ReactNode; actions?: ReactNode }>({})

  return (
    <MenuMakerHeaderContext.Provider value={{ setHeader }}>
      <div className="pb-4 bg-background">
        {/* Header — populated by child pages via useMenuMakerHeader */}
        {(header.title || header.actions) && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-6 pt-6 pb-4">
            <div>{header.title}</div>
            {header.actions && <div className="flex items-center gap-2">{header.actions}</div>}
          </div>
        )}

        {/* Tabs */}
        <NavTabs
          className="sticky top-0 bg-background h-14 z-50"
          items={[
            { to: 'overview', label: t('menumaker.nav.overview', { defaultValue: 'Overview' }) },
            { to: 'menus', label: t('menumaker.nav.menus', { defaultValue: 'Menus' }) },
            { to: 'categories', label: t('menumaker.nav.categories', { defaultValue: 'Categories' }) },
            { to: 'products', label: t('menumaker.nav.products', { defaultValue: 'Products' }) },
            { to: 'services', label: t('menumaker.nav.services', { defaultValue: 'Services' }) },
            { to: 'modifier-groups', label: t('menumaker.nav.modifierGroups', { defaultValue: 'Modifier Groups' }) },
          ]}
        />
        <Outlet />
      </div>
    </MenuMakerHeaderContext.Provider>
  )
}
