// components/TableSkeleton.tsx
import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

interface TableSkeletonProps {
  columns: number
  rows?: number
}

const TableSkeleton: React.FC<TableSkeletonProps> = ({ columns, rows = 10 }) => {
  const skeletonRows = Array.from({ length: rows })

  return (
    <div className="animate-pulse">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, idx) => (
              <th key={idx} className="p-4 bg-muted">
                <Skeleton className="w-3/4 h-4" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {skeletonRows.map((_, rowIdx) => (
            <tr key={rowIdx} className="border-t">
              {Array.from({ length: columns }).map((_, colIdx) => (
                <td key={colIdx} className="p-4">
                  <Skeleton className="w-full h-4" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default TableSkeleton
