// Common theme classes for consistent styling across components

export const themeClasses = {
  // Backgrounds
  pageBg: 'bg-background',
  cardBg: 'bg-card',
  inputBg: 'bg-input',
  contentBg: 'bg-muted/50',

  // Text
  text: 'text-foreground',
  textMuted: 'text-muted-foreground',
  textSubtle: 'text-foreground/80',

  // Borders
  border: 'border-border',

  // Status colors
  success: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  warning: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
  },
  error: {
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    border: 'border-destructive/30',
  },
  info: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  neutral: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    border: 'border-border',
  },

  // Interactive elements
  hover: 'hover:bg-muted/50',

  // Tables
  table: {
    bg: 'bg-card',
    border: 'border-border',
    headerBg: 'bg-muted',
    rowHover: 'hover:bg-muted/50',
    cell: 'text-foreground',
  },
}
