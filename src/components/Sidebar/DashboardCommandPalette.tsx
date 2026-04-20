import React from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, UserCog } from 'lucide-react'
import { useCommandState } from 'cmdk'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command'
import { normalizeSearch, includesNormalized } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import type { NavItem } from '@/components/Sidebar/nav-main'

interface DashboardCommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  navItems: NavItem[]
  hiddenSidebarItems?: string[]
  isSuperadmin?: boolean
  /** Opens the SUPERADMIN impersonation picker popover in the header. */
  onOpenImpersonation?: () => void
}

/** Substring-based filter: every search word must appear in the value (accent-insensitive). */
function substringFilter(value: string, search: string): number {
  const v = normalizeSearch(value)
  const words = normalizeSearch(search).trim().split(/\s+/)
  return words.every(word => v.includes(word)) ? 1 : 0
}

function SynonymHint({ title, parentTitle, keywords, parentKeywords }: { title: string; parentTitle?: string; keywords?: string[]; parentKeywords?: string[] }) {
  const search = useCommandState(state => state.search)
  if (!search) return null
  const s = normalizeSearch(search).trim()
  if (!s) return null
  // If search matches the title or parent title directly, no hint needed
  if (normalizeSearch(title).includes(s)) return null
  if (parentTitle && normalizeSearch(parentTitle).includes(s)) return null
  // Check if it matches a sub-item keyword → show sub-item title
  if (keywords?.some(kw => includesNormalized(kw, s))) {
    return (
      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
        &ldquo;{search.trim()}&rdquo; → {title}
      </span>
    )
  }
  // Check if it matches a parent keyword → show parent title
  if (parentTitle && parentKeywords?.some(kw => includesNormalized(kw, s))) {
    return (
      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
        &ldquo;{search.trim()}&rdquo; → {parentTitle}
      </span>
    )
  }
  return null
}

const DashboardCommandPalette: React.FC<DashboardCommandPaletteProps> = ({
  open,
  onOpenChange,
  navItems,
  hiddenSidebarItems = [],
  isSuperadmin = false,
  onOpenImpersonation,
}) => {
  const navigate = useNavigate()
  const { logout } = useAuth()

  const handleSelect = (url: string) => {
    onOpenChange(false)
    navigate(url)
  }

  // Filter out hidden items (non-superadmin) and locked items
  const visibleItems = navItems.filter(item => {
    if (item.locked) return false
    if (!isSuperadmin && hiddenSidebarItems.includes(item.url)) return false
    return true
  })

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} contentClassName="max-w-2xl" filter={substringFilter}>
      <CommandInput placeholder="Buscar páginas, secciones..." />
      <CommandList className="max-h-[min(60vh,500px)]">
        <CommandEmpty>Sin resultados.</CommandEmpty>

        <CommandGroup heading="Navegación">
          {visibleItems.map(item => {
            const Icon = item.icon
            const hasSubItems = item.items && item.items.length > 0

            // Filter sub-items: remove hidden (non-SA) and comingSoon
            const visibleSubItems = hasSubItems
              ? item.items!.filter(sub => {
                  if (sub.comingSoon) return false
                  if (!isSuperadmin && hiddenSidebarItems.includes(sub.url)) return false
                  return true
                })
              : []

            // For items with sub-items, render each sub-item individually
            if (visibleSubItems.length > 0) {
              return (
                <React.Fragment key={item.url}>
                  {visibleSubItems.map(sub => {
                    const allKeywords = [...(sub.keywords || []), ...(item.keywords || [])]
                    return (
                      <CommandItem
                        key={sub.url}
                        value={[item.title, sub.title, ...allKeywords].join(' ')}
                        onSelect={() => handleSelect(sub.url)}
                      >
                        {Icon && <Icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />}
                        <span className="text-muted-foreground">{item.title}</span>
                        <span className="mx-1 text-muted-foreground/50">/</span>
                        <span>{sub.title}</span>
                        <SynonymHint title={sub.title} parentTitle={item.title} keywords={sub.keywords} parentKeywords={item.keywords} />
                      </CommandItem>
                    )
                  })}
                </React.Fragment>
              )
            }

            // Items without sub-items (direct links)
            // Skip anchor-only URLs like #sales, #customers
            if (item.url.startsWith('#')) return null

            return (
              <CommandItem
                key={item.url}
                value={[item.title, ...(item.keywords || [])].join(' ')}
                onSelect={() => handleSelect(item.url)}
              >
                {Icon && <Icon className="mr-2 h-4 w-4 shrink-0" />}
                <span>{item.title}</span>
                <SynonymHint title={item.title} keywords={item.keywords} parentKeywords={[]} />
              </CommandItem>
            )
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Acciones rápidas">
          {isSuperadmin && onOpenImpersonation ? (
            <CommandItem
              value="impersonar usuario rol ver como cliente superadmin"
              onSelect={() => {
                onOpenChange(false)
                onOpenImpersonation()
              }}
            >
              <UserCog className="mr-2 h-4 w-4 shrink-0" />
              <span>Impersonar usuario o rol</span>
            </CommandItem>
          ) : null}
          <CommandItem
            value="cerrar sesion logout salir"
            onSelect={() => {
              onOpenChange(false)
              logout()
            }}
          >
            <LogOut className="mr-2 h-4 w-4 shrink-0" />
            <span>Cerrar sesión</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

export default DashboardCommandPalette
