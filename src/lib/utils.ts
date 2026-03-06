import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Strip diacritics: ñ→n, á→a, é→e, etc. */
function stripDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Normalize for search comparison: lowercase + strip diacritics. */
export function normalizeSearch(str: string): string {
  return stripDiacritics(str.toLowerCase())
}

/** Accent-insensitive substring check. */
export function includesNormalized(haystack: string, needle: string): boolean {
  return normalizeSearch(haystack).includes(normalizeSearch(needle))
}
