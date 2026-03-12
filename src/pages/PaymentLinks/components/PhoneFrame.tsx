import type { ReactNode } from 'react'

interface PhoneFrameProps {
  children: ReactNode
  footer?: ReactNode
}

/**
 * Device-preview frame for checkout previews (Square-style).
 * Fixed height, rounded rectangle, subtle border, internal scroll.
 */
export function PhoneFrame({ children, footer }: PhoneFrameProps) {
  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-[340px]">
        {/* Height fills viewport minus modal header (64px) + padding (48px) + tabs area (48px) */}
        <div className="h-[calc(100vh-160px)] rounded-xl border border-border bg-background shadow-md overflow-hidden flex flex-col">
          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">{children}</div>

          {/* Pinned footer */}
          {footer}
        </div>
      </div>
    </div>
  )
}
