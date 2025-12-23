import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

type TableProps = React.HTMLAttributes<HTMLTableElement> & {
  containerClassName?: string
  /** Enable sticky first column with shadow indicator on scroll */
  stickyFirstColumn?: boolean
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, containerClassName, stickyFirstColumn = false, ...props }, ref) => {
    const scrollContainerRef = React.useRef<HTMLDivElement>(null)
    const [isScrolled, setIsScrolled] = React.useState(false)

    // Detect horizontal scroll to show/hide shadow
    React.useEffect(() => {
      if (!stickyFirstColumn) return

      const container = scrollContainerRef.current
      if (!container) return

      const handleScroll = () => {
        setIsScrolled(container.scrollLeft > 0)
      }

      container.addEventListener('scroll', handleScroll, { passive: true })
      return () => container.removeEventListener('scroll', handleScroll)
    }, [stickyFirstColumn])

    return (
      // Outer container: handles border-radius clipping
      <div className={cn('relative w-full', containerClassName)}>
        {/* Inner container: handles horizontal scroll */}
        <div
          ref={scrollContainerRef}
          className={cn(
            'w-full overflow-x-auto',
            isScrolled && 'table-scrolled'
          )}
        >
          <table
            ref={ref}
            className={cn(
              'w-full caption-bottom text-sm',
              stickyFirstColumn && 'table-sticky-col-first',
              className
            )}
            {...props}
          />
        </div>
      </div>
    )
  },
)
Table.displayName = 'Table'

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />,
)
TableHeader.displayName = 'TableHeader'

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />,
)
TableBody.displayName = 'TableBody'

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot
      ref={ref}
      className={cn('border-t bg-muted font-medium last:[&>tr]:border-b-0', className)}
      {...props}
    />
  ),
)
TableFooter.displayName = 'TableFooter'

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b border-border transition-colors hover:bg-muted data-[state=selected]:bg-muted',
      className,
    )}
    {...props}
  />
))
TableRow.displayName = 'TableRow'

interface ClickableTableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  to: string
  state?: Record<string, any>
}

const ClickableTableRow = React.forwardRef<HTMLTableRowElement, ClickableTableRowProps>(
  ({ className, to, state, children, ...props }, ref) => {
    const navigate = useNavigate()

    const handleClick = () => {
      navigate(to, { state })
    }

    return (
      <tr
        ref={ref}
        onClick={handleClick}
        className={cn(
          'border-b border-border transition-colors hover:bg-muted data-[state=selected]:bg-muted cursor-pointer',
          className,
        )}
        {...props}
      >
        {children}
      </tr>
    )
  },
)
ClickableTableRow.displayName = 'ClickableTableRow'

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
      className,
    )}
    {...props}
  />
))
TableHead.displayName = 'TableHead'

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]', className)}
    {...props}
  />
))
TableCell.displayName = 'TableCell'

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
  ),
)
TableCaption.displayName = 'TableCaption'

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, ClickableTableRow, TableCell, TableCaption }
