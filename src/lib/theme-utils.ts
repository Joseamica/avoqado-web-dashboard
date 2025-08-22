// Common theme classes for consistent styling across components

export const themeClasses = {
  // Backgrounds
  pageBg: 'bg-muted dark:bg-[hsl(240_5.9%_10%)]',
  cardBg: 'bg-card dark:bg-[hsl(240_3.7%_15.9%)]',
  inputBg: 'bg-input dark:bg-muted',
  contentBg: 'bg-muted/50 dark:bg-[hsl(240_5.9%_10%)]',

  // Text
  text: 'text-foreground',
  textMuted: 'text-muted-foreground',
  textSubtle: 'text-foreground/80',

  // Borders
  border: 'border-border',

  // Status colors
  success: {
    bg: 'bg-green-100 dark:bg-green-950/60',
    text: 'text-green-700 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
  },
  warning: {
    bg: 'bg-[#FAF5D4] dark:bg-yellow-950/60',
    text: 'text-[#DDB082] dark:text-yellow-400',
    border: 'border-yellow-200 dark:border-yellow-800',
  },
  error: {
    bg: 'bg-[#FDE2E2] dark:bg-red-950/60',
    text: 'text-[#D64545] dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
  },
  info: {
    bg: 'bg-blue-100 dark:bg-blue-950/60',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
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
