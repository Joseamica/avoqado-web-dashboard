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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('common.toggle_theme')}
          className="rounded-full bg-transparent hover:bg-accent/80 border-0"
        >
          <Icon className="h-[1.2rem] w-[1.2rem] text-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup value={themeSetting} onValueChange={(v) => setTheme(v as any)}>
          <DropdownMenuRadioItem value="system">
            <span className="inline-flex items-center gap-2">
              <Laptop className="h-4 w-4" /> {t('common.system')}
            </span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <span className="inline-flex items-center gap-2">
              <Sun className="h-4 w-4" /> {t('common.light')}
            </span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <span className="inline-flex items-center gap-2">
              <Moon className="h-4 w-4" /> {t('common.dark')}
            </span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
