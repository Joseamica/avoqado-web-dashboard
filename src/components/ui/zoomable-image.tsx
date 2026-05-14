import { useCallback, useEffect, useRef, useState } from 'react'
import { Maximize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const MIN_ZOOM = 1
const MAX_ZOOM = 5
const ZOOM_STEP = 0.5
const DOUBLE_CLICK_ZOOM = 2.5

interface ZoomableImageProps {
  src: string
  alt?: string
  className?: string
  imageClassName?: string
  /**
   * Overlays rendered on top of the image container. They stay anchored
   * to the viewport (not affected by zoom/pan) — ideal for badges, GPS, time.
   */
  children?: React.ReactNode
}

export function ZoomableImage({ src, alt = '', className, imageClassName, children }: ZoomableImageProps) {
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)

  const reset = useCallback(() => {
    setZoom(MIN_ZOOM)
    setPan({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    reset()
  }, [src, reset])

  const zoomIn = useCallback(() => {
    setZoom(z => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))
  }, [])

  const zoomOut = useCallback(() => {
    setZoom(z => {
      const next = Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2))
      if (next === MIN_ZOOM) setPan({ x: 0, y: 0 })
      return next
    })
  }, [])

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY === 0) return
    e.preventDefault()
    if (e.deltaY < 0) zoomIn()
    else zoomOut()
  }

  const handleDoubleClick = () => {
    if (zoom > MIN_ZOOM) reset()
    else setZoom(DOUBLE_CLICK_ZOOM)
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoom <= MIN_ZOOM) return
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y }
    setIsDragging(true)
  }

  useEffect(() => {
    if (!isDragging) return
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      setPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy })
    }
    const handleMouseUp = () => {
      dragRef.current = null
      setIsDragging(false)
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  const cursor = zoom > MIN_ZOOM ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in'

  return (
    <div className={cn('relative', className)}>
      <div
        className="relative h-full w-full overflow-hidden select-none flex items-center justify-center"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        style={{ cursor }}
        role="img"
        aria-label={alt}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className={cn('max-h-[400px] w-auto object-contain transition-transform duration-150 ease-out', imageClassName)}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            willChange: zoom > MIN_ZOOM ? 'transform' : undefined,
          }}
        />
        {children}
      </div>

      <div className="absolute bottom-3 right-3 flex items-center gap-0.5 rounded-full border border-neutral-50/10 bg-neutral-900/60 p-1 backdrop-blur-md">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={zoomOut}
          disabled={zoom <= MIN_ZOOM}
          className="h-7 w-7 cursor-pointer rounded-full text-neutral-50 hover:bg-neutral-50/15 hover:text-neutral-50 disabled:opacity-40"
          aria-label="Alejar"
          title="Alejar"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="min-w-[2.5rem] text-center text-[10px] font-semibold tabular-nums text-neutral-50">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={zoomIn}
          disabled={zoom >= MAX_ZOOM}
          className="h-7 w-7 cursor-pointer rounded-full text-neutral-50 hover:bg-neutral-50/15 hover:text-neutral-50 disabled:opacity-40"
          aria-label="Acercar"
          title="Acercar"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        {zoom > MIN_ZOOM ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={reset}
            className="h-7 w-7 cursor-pointer rounded-full text-neutral-50 hover:bg-neutral-50/15 hover:text-neutral-50"
            aria-label="Restablecer zoom"
            title="Restablecer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setZoom(DOUBLE_CLICK_ZOOM)}
            className="h-7 w-7 cursor-pointer rounded-full text-neutral-50 hover:bg-neutral-50/15 hover:text-neutral-50"
            aria-label="Ampliar"
            title="Ampliar (doble click)"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}
