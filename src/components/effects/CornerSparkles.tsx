import type { CSSProperties, ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Decorative sparkles that twinkle in alternating corners — bottom-right first,
 * then top-left, and so on, traveling around the box. Wrap any element. Purely
 * decorative (aria-hidden, pointer-events-none). Reusable across the app.
 */
export function CornerSparkles({ children, className }: { children: ReactNode; className?: string }) {
  const base = 'pointer-events-none absolute text-primary animate-[corner-twinkle_3.2s_ease-in-out_infinite]'
  // The two big sparkles (BR @0s, TL @half-cycle) give the bottom-right → top-left
  // alternation; the two small ones fill the cycle so the twinkle travels around.
  const spark = (corner: string, size: string, delay: string, faded = false): [string, CSSProperties] => [
    cn(base, corner, size, faded && 'text-primary/55'),
    { animationDelay: delay },
  ]
  const [c1, s1] = spark('bottom-2 right-3', 'h-3.5 w-3.5', '0s')
  const [c2, s2] = spark('left-3 top-2', 'h-3.5 w-3.5', '1.6s')
  const [c3, s3] = spark('right-6 top-2.5', 'h-2.5 w-2.5', '0.8s', true)
  const [c4, s4] = spark('bottom-2.5 left-6', 'h-2.5 w-2.5', '2.4s', true)

  return (
    <div className={cn('relative', className)}>
      {children}
      <Sparkles aria-hidden className={c1} style={s1} />
      <Sparkles aria-hidden className={c2} style={s2} />
      <Sparkles aria-hidden className={c3} style={s3} />
      <Sparkles aria-hidden className={c4} style={s4} />
    </div>
  )
}
