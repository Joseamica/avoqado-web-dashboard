# Design System Guide (2025/2026)

Inspired by: Stripe Dashboard, Linear, Vercel.
Reference implementation: `src/pages/Venue/VenuePaymentConfig.tsx`

## GlassCard — Glassmorphism Wrapper

```typescript
const GlassCard: React.FC<{
  children: React.ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}> = ({ children, className, hover = false, onClick }) => (
  <div
    onClick={onClick}
    className={cn(
      'relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm',
      'shadow-sm transition-all duration-300',
      hover && 'cursor-pointer hover:shadow-md hover:border-border hover:bg-card/90 hover:-translate-y-0.5',
      onClick && 'cursor-pointer',
      className
    )}
  >
    {children}
  </div>
)
```

## StatusPulse — Animated Status Indicator

```typescript
const StatusPulse: React.FC<{ status: 'success' | 'warning' | 'error' | 'neutral' }> = ({ status }) => {
  const colors = {
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    neutral: 'bg-gray-400',
  }
  return (
    <span className="relative flex h-3 w-3">
      <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', colors[status])} />
      <span className={cn('relative inline-flex rounded-full h-3 w-3', colors[status])} />
    </span>
  )
}
```

## MetricCard — Bento Grid Metric Display

```typescript
// Icon with gradient background + large value + label
<div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
  <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
</div>
<p className="text-2xl font-bold tracking-tight">{value}</p>
<p className="text-sm text-muted-foreground">{label}</p>
```

## Collapsible Sections — Progressive Disclosure

```typescript
<Collapsible open={isOpen} onOpenChange={setIsOpen}>
  <GlassCard>
    <CollapsibleTrigger asChild>
      <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
            <Calculator className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="font-medium text-sm">Section Title</h3>
            <p className="text-xs text-muted-foreground">Description</p>
          </div>
        </div>
        <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform', isOpen && 'rotate-90')} />
      </div>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div className="px-4 pb-4 space-y-4">
        <div className="h-px bg-border/50" />
        {/* Content */}
      </div>
    </CollapsibleContent>
  </GlassCard>
</Collapsible>
```

## Aligned Grid Rows

Header and rows MUST use same grid template:

```typescript
<div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-2">
  <div>Column 1</div>
  <div className="text-right min-w-[120px]">Column 2</div>
  <div className="text-right min-w-[70px]">Column 3</div>
</div>
```

## Color Accents

| Context | Gradient | Text |
|---------|----------|------|
| Success, profit | `from-green-500/20 to-green-500/5` | `text-green-600 dark:text-green-400` |
| Info, primary | `from-blue-500/20 to-blue-500/5` | `text-blue-600 dark:text-blue-400` |
| Features, tools | `from-purple-500/20 to-purple-500/5` | `text-purple-600 dark:text-purple-400` |
| Warnings | `from-orange-500/20 to-orange-500/5` | `text-orange-600 dark:text-orange-400` |

## Bento Grid Layout

```typescript
// 12-column grid
<div className="grid grid-cols-12 gap-4">
  <div className="col-span-12 lg:col-span-8">{/* Main content */}</div>
  <div className="col-span-12 lg:col-span-4">{/* Side metrics */}</div>
</div>
```

## Status/Feedback Patterns

```typescript
// Error
<div className="bg-destructive/10 border border-destructive/20 text-destructive">

// Success
<div className="bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200">

// Info
<div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200">
```
