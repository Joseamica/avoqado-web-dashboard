import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/context/ThemeContext'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className="rounded-full bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 border-0"
    >
      {theme === 'light' ? (
        <Moon className="h-[1.2rem] w-[1.2rem] text-gray-700" />
      ) : (
        <Sun className="h-[1.2rem] w-[1.2rem] text-yellow-400" />
      )}
    </Button>
  )
}
