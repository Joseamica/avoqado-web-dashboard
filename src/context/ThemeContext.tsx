import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

type Theme = 'light' | 'dark'
type ThemeSetting = Theme | 'system'

type ThemeContextType = {
  theme: Theme // resolved theme
  themeSetting: ThemeSetting // user setting
  setTheme: (theme: ThemeSetting) => void
  toggleTheme: () => void
  useSystem: () => void
  isDark: boolean
}

const STORAGE_KEY = 'vite-ui-theme'

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeSetting, setThemeSetting] = useState<ThemeSetting>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeSetting | null
    return saved ?? 'system'
  })

  const [resolvedTheme, setResolvedTheme] = useState<Theme>(() => (themeSetting === 'system' ? getSystemTheme() : themeSetting))

  // Apply class on document and persist setting
  useEffect(() => {
    const next = themeSetting === 'system' ? getSystemTheme() : themeSetting
    setResolvedTheme(next)
    if (next === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    localStorage.setItem(STORAGE_KEY, themeSetting)
  }, [themeSetting])

  // Listen to system changes when in `system` mode
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (themeSetting === 'system') {
        const next = getSystemTheme()
        setResolvedTheme(next)
        if (next === 'dark') document.documentElement.classList.add('dark')
        else document.documentElement.classList.remove('dark')
      }
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [themeSetting])

  const isDark = resolvedTheme === 'dark'

  const setTheme = (value: ThemeSetting) => setThemeSetting(value)

  // Default behavior: clicking toggler prefers system.
  const toggleTheme = () => {
    setThemeSetting(prev => (prev === 'system' ? (getSystemTheme() === 'dark' ? 'light' : 'dark') : 'system'))
  }

  const useSystem = () => setThemeSetting('system')

  const value = useMemo<ThemeContextType>(
    () => ({ theme: resolvedTheme, themeSetting, setTheme, toggleTheme, useSystem, isDark }),
    [resolvedTheme, themeSetting, isDark],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
