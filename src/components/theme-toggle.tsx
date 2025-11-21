import { Moon, Sun, Laptop } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/context/ThemeContext'
import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function ThemeToggle() {
  const { theme, themeSetting, setTheme } = useTheme()
  const { t } = useTranslation()

  const Icon = themeSetting === 'system' ? Laptop : theme === 'light' ? Moon : Sun

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label={t('toggle_theme')} className=" bg-transparent hover:bg-accent/80">
          <Icon className="h-[1.2rem] w-[1.2rem] text-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40" sideOffset={5}>
        <DropdownMenuRadioGroup value={themeSetting} onValueChange={v => setTheme(v as any)}>
          <DropdownMenuRadioItem value="system">
            <span className="inline-flex items-center gap-2">
              <Laptop className="h-4 w-4" /> {t('system')}
            </span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <span className="inline-flex items-center gap-2">
              <Sun className="h-4 w-4" /> {t('light')}
            </span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <span className="inline-flex items-center gap-2">
              <Moon className="h-4 w-4" /> {t('dark')}
            </span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
