import { useTheme } from '@/context/ThemeContext'

/**
 * Hook that provides theme-aware utility classes
 * Use this for dynamic styling based on theme state
 */
export function useThemeClasses() {
  const { isDark } = useTheme()

  return {
    // State-based colors that need dynamic theming
    success: 'status-badge status-success',
    warning: 'status-badge status-warning',
    info: 'status-badge status-info',
    error: 'status-badge status-critical',

    // Priority colors for notifications, badges, etc.
    priority: {
      low: 'text-muted-foreground',
      normal: 'text-[var(--color-info)]',
      high: 'text-[var(--color-warning)]',
      urgent: 'text-[var(--color-destructive)]',
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
      active: 'bg-[var(--color-success)]',
      inactive: 'bg-muted-foreground',
      pending: 'bg-[var(--color-warning)]',
      error: 'bg-[var(--color-destructive)]',
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
    success: 'text-[color:var(--color-success)]',
    warning: 'text-[color:var(--color-warning)]',
    info: 'text-[color:var(--color-info)]',
    error: 'text-[color:var(--color-destructive)]',
  }
  return colors[status]
}

/**
 * Get theme-aware background for status/priority
 */
export function getStatusBackground(status: 'success' | 'warning' | 'info' | 'error'): string {
  const backgrounds = {
    success: 'status-badge status-success',
    warning: 'status-badge status-warning', 
    info: 'status-badge status-info',
    error: 'status-badge status-critical',
  }
  return backgrounds[status]
}
