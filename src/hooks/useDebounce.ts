import { useState, useEffect } from 'react'

/**
 * Debounces a value by the specified delay.
 * Used for search inputs to avoid making API calls on every keystroke.
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns The debounced value
 *
 * @example
 * const [searchTerm, setSearchTerm] = useState('')
 * const debouncedSearch = useDebounce(searchTerm, 300)
 *
 * // Use debouncedSearch in your query, not searchTerm
 * useQuery({
 *   queryKey: ['data', debouncedSearch],
 *   queryFn: () => fetchData(debouncedSearch),
 * })
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}
