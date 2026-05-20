import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { ChevronLeft, CirclePlus } from 'lucide-react'
import {
  Children,
  ReactElement,
  ReactNode,
  cloneElement,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

interface FilterPillBarProps {
  children: ReactNode
  /** Called when the user clicks the reset link at the right of the bar. Hides the link when omitted. */
  onReset?: () => void
  resetLabel?: string
  moreLabel?: string
  className?: string
}

const isActivePill = (item: ReactElement): boolean => {
  const p = item.props as { activeValue?: unknown; activeLabel?: unknown; isActive?: unknown }
  return !!p.activeValue || !!p.activeLabel || !!p.isActive
}

const getPillLabel = (item: ReactElement): string => {
  const p = item.props as { label?: string }
  return p.label ?? ''
}

const getPillChildren = (item: ReactElement): ReactNode => {
  const p = item.props as { children?: ReactNode }
  return p.children
}

/**
 * Stripe-style filter bar.
 *
 * Default behavior: pills laid out in a single row. When the row gets too narrow, overflowing
 * inactive pills collapse into a "Más filtros" popover (with a sub-menu pattern — clicking a
 * filter in the popover shows that filter's picker inline). Active pills always stay visible.
 *
 * Fallback: the outer container uses `flex-wrap` so that if even "Más filtros" + the reset link
 * can't fit (e.g. when the search bar is expanded and the container is very narrow), the items
 * wrap to a second row instead of getting visually clipped.
 */
export function FilterPillBar({
  children,
  onReset,
  resetLabel = 'Borrar filtros',
  moreLabel = 'Más filtros',
  className,
}: FilterPillBarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState<number | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [subFilterIdx, setSubFilterIdx] = useState<number | null>(null)

  const items = useMemo(
    () => Children.toArray(children).filter(isValidElement) as ReactElement[],
    [children],
  )

  const hasActive = items.some(isActivePill)
  const showReset = !!onReset && hasActive

  const itemsActiveKey = items.map(it => (isActivePill(it) ? '1' : '0')).join('')

  useEffect(() => {
    if (!moreOpen) setSubFilterIdx(null)
  }, [moreOpen])

  useLayoutEffect(() => {
    const container = containerRef.current
    const measure = measureRef.current
    if (!container || !measure) return

    const compute = () => {
      const containerWidth = container.clientWidth
      if (containerWidth === 0) return

      const pillEls = Array.from(measure.querySelectorAll('[data-pill-slot]')) as HTMLElement[]
      const moreEl = measure.querySelector('[data-more-slot]') as HTMLElement | null
      const moreWidth = moreEl ? moreEl.offsetWidth : 100
      const gap = 8
      const safetyBuffer = 12

      let used = 0
      let visCount = 0
      for (let i = 0; i < pillEls.length; i++) {
        const w = pillEls[i].offsetWidth
        const sep = i > 0 ? gap : 0
        const willHaveMore = i < pillEls.length - 1
        const moreReserve = willHaveMore ? moreWidth + gap : 0
        if (used + sep + w + moreReserve + safetyBuffer <= containerWidth) {
          used += sep + w
          visCount = i + 1
        } else {
          break
        }
      }

      const next = visCount === pillEls.length ? null : visCount
      setVisibleCount(prev => (prev === next ? prev : next))
    }

    const raf = requestAnimationFrame(compute)
    const ro = new ResizeObserver(() => requestAnimationFrame(compute))
    ro.observe(container)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [items.length, itemsActiveKey])

  const { visible, hidden } = useMemo(() => {
    if (visibleCount === null) {
      return { visible: items, hidden: [] as ReactElement[] }
    }
    const vis = items.slice(0, visibleCount)
    const hid = items.slice(visibleCount)

    const swappedVisIdxs = new Set<number>()
    hid.forEach((hi, hidIdx) => {
      if (!isActivePill(hi)) return
      for (let vi = vis.length - 1; vi >= 0; vi--) {
        if (!isActivePill(vis[vi]) && !swappedVisIdxs.has(vi)) {
          const swap = vis[vi]
          vis[vi] = hi
          hid[hidIdx] = swap
          swappedVisIdxs.add(vi)
          return
        }
      }
    })

    return { visible: vis, hidden: hid }
  }, [items, visibleCount])

  const subFilterContent = useMemo<ReactNode>(() => {
    if (subFilterIdx === null) return null
    const item = items[subFilterIdx]
    if (!item) return null
    const content = getPillChildren(item)
    if (!isValidElement(content)) return content
    return cloneElement(content as ReactElement, {
      onClose: () => {
        setSubFilterIdx(null)
        setMoreOpen(false)
      },
    } as Partial<{ onClose: () => void }>)
  }, [subFilterIdx, items])

  return (
    <div className={cn('relative flex w-full items-center gap-2', className)}>
      {/* Measurement layer — natural-width snapshot used to compute how many pills fit in one row */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute -left-[9999px] top-0 flex items-center gap-2"
      >
        {items.map((item, i) => (
          <div key={i} data-pill-slot>
            {item}
          </div>
        ))}
        <div data-more-slot>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 rounded-full border-dashed font-normal text-xs px-2.5"
          >
            <CirclePlus className="h-3 w-3" />
            <span>{moreLabel}</span>
          </Button>
        </div>
      </div>

      {/* Display layer — flex-wrap is a safety net for when the container is so narrow that even
          Más filtros + reset can't fit on one row. In the common case, my Más filtros logic keeps
          everything in one row and wrapping never triggers. */}
      <div ref={containerRef} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-2">
        {visible.map(item => {
          const origIdx = items.indexOf(item)
          return (
            <div key={origIdx} className="contents">
              {item}
            </div>
          )
        })}
        {hidden.length > 0 && (
          <Popover open={moreOpen} onOpenChange={setMoreOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 shrink-0 gap-1.5 rounded-full border-dashed px-2.5 text-xs font-normal text-muted-foreground hover:border-foreground/40 hover:text-foreground"
              >
                <CirclePlus className="h-3 w-3 text-muted-foreground/70" />
                <span>{moreLabel}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className={cn('p-0', subFilterIdx === null ? 'w-[240px]' : 'w-[300px]')}
              sideOffset={8}
            >
              {subFilterIdx === null ? (
                <div className="max-h-[320px] overflow-y-auto p-1">
                  {hidden.map(item => {
                    const origIdx = items.indexOf(item)
                    return (
                      <button
                        key={origIdx}
                        type="button"
                        onClick={() => setSubFilterIdx(origIdx)}
                        className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60"
                      >
                        <CirclePlus className="h-3 w-3 text-muted-foreground/70" />
                        <span>{getPillLabel(item)}</span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => setSubFilterIdx(null)}
                      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Volver"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-medium">{getPillLabel(items[subFilterIdx])}</span>
                  </div>
                  {subFilterContent}
                </>
              )}
            </PopoverContent>
          </Popover>
        )}
        {showReset && (
          <button
            type="button"
            onClick={onReset}
            className="shrink-0 whitespace-nowrap text-xs font-medium text-destructive hover:underline cursor-pointer"
          >
            {resetLabel}
          </button>
        )}
      </div>
    </div>
  )
}
