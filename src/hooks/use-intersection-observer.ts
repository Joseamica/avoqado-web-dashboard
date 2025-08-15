import { useEffect, useRef, useState } from 'react'

interface UseIntersectionObserverOptions extends IntersectionObserverInit {
  freezeOnceVisible?: boolean
  triggerOnce?: boolean
}

export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {}
): [React.RefObject<HTMLDivElement>, boolean] {
  const {
    threshold = 0.1,
    root = null,
    rootMargin = '50px',
    freezeOnceVisible = false,
    triggerOnce = false,
  } = options

  const [isIntersecting, setIsIntersecting] = useState(false)
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = elementRef.current

    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isElementIntersecting = entry.isIntersecting
        
        if (isElementIntersecting) {
          setIsIntersecting(true)
          
          // If triggerOnce is true, disconnect observer after first trigger
          if (triggerOnce) {
            observer.unobserve(element)
          }
        } else if (!freezeOnceVisible) {
          setIsIntersecting(false)
        }
      },
      { threshold, root, rootMargin }
    )

    observer.observe(element)

    return () => {
      observer.unobserve(element)
    }
  }, [threshold, root, rootMargin, freezeOnceVisible, triggerOnce])

  return [elementRef, isIntersecting]
}

// Hook specifically for progressive loading
export function useProgressiveLoader(options: UseIntersectionObserverOptions = {}) {
  return useIntersectionObserver({
    triggerOnce: true,
    freezeOnceVisible: true,
    threshold: 0.1,
    rootMargin: '100px',
    ...options,
  })
}

// Hook for infinite scroll trigger
export function useInfiniteScroll(
  callback: () => void,
  hasMore: boolean,
  options: UseIntersectionObserverOptions = {}
) {
  const [ref, isIntersecting] = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '50px',
    ...options,
  })

  useEffect(() => {
    if (isIntersecting && hasMore) {
      callback()
    }
  }, [isIntersecting, hasMore, callback])

  return ref
}