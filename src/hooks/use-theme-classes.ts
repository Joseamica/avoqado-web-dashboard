import { useTheme } from '@/context/ThemeContext'

/**
 * Hook that provides theme-aware utility classes
 * Use this for dynamic styling based on theme state
 */
export function useThemeClasses() {
  const { isDark } = useTheme()

  return {
    // State-based colors that need dynamic theming
    success: 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
    warning: 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-200',
    info: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
    error: 'bg-destructive/10 border-destructive/20 text-destructive',

    // Priority colors for notifications, badges, etc.
    priority: {
      low: 'text-muted-foreground',
      normal: 'text-blue-500 dark:text-blue-400',
      high: 'text-orange-500 dark:text-orange-400',
      urgent: 'text-destructive',
    },

    // Common component combinations
    card: 'bg-card border-border text-card-foreground',
    input: 'bg-background border-input text-foreground placeholder:text-muted-foreground',
    button: {
      primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      outline: 'border-border bg-background text-foreground hover:bg-accent',
    },

    // Utility for checking theme
    isDark,
    
    // Status indicators
    statusDot: {
      active: 'bg-green-500 dark:bg-green-400',
      inactive: 'bg-muted-foreground',
      pending: 'bg-orange-500 dark:bg-orange-400',
      error: 'bg-destructive',
    }
  }
}

/**
 * Utility function to combine theme-aware classes
 */
export function themeClasses(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * Get theme-aware color for status/priority
 */
export function getStatusColor(status: 'success' | 'warning' | 'info' | 'error'): string {
  const colors = {
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-orange-600 dark:text-orange-400',
    info: 'text-blue-600 dark:text-blue-400',
    error: 'text-destructive',
  }
  return colors[status]
}

/**
 * Get theme-aware background for status/priority
 */
export function getStatusBackground(status: 'success' | 'warning' | 'info' | 'error'): string {
  const backgrounds = {
    success: 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800',
    warning: 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800', 
    info: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
    error: 'bg-destructive/10 border-destructive/20',
  }
  return backgrounds[status]
}