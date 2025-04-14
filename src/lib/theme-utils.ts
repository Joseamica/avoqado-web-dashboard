// Common theme classes for consistent styling across components

export const themeClasses = {
  // Backgrounds
  pageBg: 'bg-gray-50 dark:bg-[hsl(240_5.9%_10%)]',
  cardBg: 'bg-white dark:bg-[hsl(240_3.7%_15.9%)]',
  inputBg: 'bg-bg-input dark:bg-gray-800',
  contentBg: 'bg-muted/50 dark:bg-[hsl(240_5.9%_10%)]',

  // Text
  text: 'text-gray-900 dark:text-white',
  textMuted: 'text-gray-500 dark:text-gray-400',
  textSubtle: 'text-gray-700 dark:text-gray-300',

  // Borders
  border: 'border-gray-200 dark:border-gray-700',

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
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-700 dark:text-gray-300',
    border: 'border-gray-200 dark:border-gray-700',
  },

  // Interactive elements
  hover: 'hover:bg-gray-100 dark:hover:bg-gray-800',

  // Tables
  table: {
    bg: 'bg-white dark:bg-[hsl(240_3.7%_15.9%)]',
    border: 'border-gray-200 dark:border-gray-700',
    headerBg: 'bg-gray-50 dark:bg-gray-800',
    rowHover: 'hover:bg-gray-50 dark:hover:bg-gray-800',
    cell: 'text-gray-900 dark:text-white',
  },
}
